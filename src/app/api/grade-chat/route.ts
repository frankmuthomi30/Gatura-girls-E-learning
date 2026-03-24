import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { getSupabaseUrl } from '@/lib/supabase-env';

const CHAT_RETENTION_DAYS = 1;
const VALID_GRADES = [10, 11, 12];

// Blocked words/patterns for chat content filtering (school-appropriate)
const BLOCKED_PATTERNS: RegExp[] = [
  /\b(fuck|f+u+c+k+|fuk|fck|fcuk|phuck|phuk)\w*/i,
  /\b(shit|sh[1i!]t|bullshit|sh\*t)\w*/i,
  /\b(ass|a[s$]{2}|a\$\$)\b/i,
  /\b(asshole|a[s$]{2}hole)\w*/i,
  /\b(bitch|b[1i!]tch|b\*tch)\w*/i,
  /\b(damn|dammit|damnit)\w*/i,
  /\b(dick|d[1i!]ck)\b/i,
  /\b(pussy|pu[s$]{2}y)\b/i,
  /\b(cock|cok)\b/i,
  /\b(bastard|b[a@]stard)\w*/i,
  /\b(slut|wh[o0]re|h[o0]e)\b/i,
  /\b(nigga|n[1i!]gger|n[1i!]gga)\w*/i,
  /\b(cunt)\b/i,
  /\b(retard|retarded)\w*/i,
  /\b(stfu|gtfo|lmfao)\b/i,
  /\b(porn|p[o0]rn)\w*/i,
  /\b(sex|s[e3]x)\b/i,
  /\b(nude|nudes|naked)\b/i,
  /\b(kill\s+(your|my|him|her|them)self)\b/i,
  /\b(idiot|stupid|dumb)\s+(ass|bitch|fuck)/i,
];

function containsBlockedContent(text: string): boolean {
  const normalized = text.replace(/[_\-.*#@!$]/g, '').replace(/\s{2,}/g, ' ');
  return BLOCKED_PATTERNS.some(pattern => pattern.test(text) || pattern.test(normalized));
}

type ChatRole = 'student' | 'teacher' | 'admin';

type ChatProfile = {
  id: string;
  role: ChatRole;
  grade: number | null;
  full_name: string;
};

function parseGrade(value: string | null) {
  const parsed = value ? parseInt(value, 10) : NaN;
  return VALID_GRADES.includes(parsed) ? parsed : null;
}

function getDisplayName(sender: { full_name?: string | null; role?: string | null } | null | undefined) {
  if (!sender) return 'Learner';
  if (sender.role === 'admin') return 'Admin';
  if (sender.role === 'teacher') return sender.full_name || 'Teacher';
  return sender.full_name || 'Learner';
}

function isMissingColumnError(error: unknown, column: string) {
  if (!error || typeof error !== 'object') return false;
  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  return message.includes(column);
}

async function getContext() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const dataClient = serviceRole ? createClient(getSupabaseUrl(), serviceRole) : supabase;

  const { data: profile } = await dataClient
    .from('profiles')
    .select('id, role, grade, full_name')
    .eq('id', user.id)
    .single();

  if (!profile || !['student', 'teacher', 'admin'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return {
    canPruneMessages: Boolean(serviceRole),
    dataClient,
    profile: profile as ChatProfile,
  };
}

async function pruneOldMessages(adminClient: any, enabled: boolean) {
  if (!enabled) {
    return;
  }

  const cutoff = new Date(Date.now() - CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await adminClient.from('grade_chat_messages').delete().lt('created_at', cutoff);
}

async function isGradeMuted(client: any, grade: number): Promise<boolean> {
  const { data } = await client
    .from('chat_grade_settings')
    .select('muted')
    .eq('grade', grade)
    .single();
  return data?.muted === true;
}

function resolveGrade(profile: ChatProfile, requestedGrade: number | null) {
  if (profile.role === 'student') {
    return profile.grade;
  }

  return requestedGrade || 10;
}

async function loadMessages(adminClient: any, grade: number, profile: ChatProfile) {
  const queryWithReplies = await adminClient
    .from('grade_chat_messages')
    .select('id, grade, sender_id, message, reply_to_id, created_at, sender:profiles(id, full_name, role)')
    .eq('grade', grade)
    .order('created_at', { ascending: true })
    .limit(200);

  const supportsReplies = !queryWithReplies.error;
  const fallbackQuery = supportsReplies
    ? null
    : await adminClient
        .from('grade_chat_messages')
        .select('id, grade, sender_id, message, created_at, sender:profiles(id, full_name, role)')
        .eq('grade', grade)
        .order('created_at', { ascending: true })
        .limit(200);

  if (queryWithReplies.error && !isMissingColumnError(queryWithReplies.error, 'reply_to_id')) {
    throw new Error('Failed to load chat messages');
  }

  if (fallbackQuery?.error) {
    throw new Error('Failed to load chat messages');
  }

  const rawMessages = ((supportsReplies ? queryWithReplies.data : fallbackQuery?.data) || []).map((message: any) => ({
    ...message,
    reply_to_id: message.reply_to_id || null,
  }));

  const messageLookup = new Map<string, any>(rawMessages.map((message: any) => [message.id, message]));

  const messages = rawMessages.map((message: any) => ({
    ...message,
    canEdit: profile.role === 'student' && message.sender_id === profile.id,
    canDelete:
      (profile.role === 'student' && message.sender_id === profile.id) ||
      profile.role === 'admin',
    replyTo: message.reply_to_id
      ? (() => {
          const parentMessage = messageLookup.get(message.reply_to_id);
          if (!parentMessage) return null;

          return {
            id: parentMessage.id,
            message: parentMessage.message,
            sender_name: getDisplayName(parentMessage.sender),
            sender_role: parentMessage.sender?.role || 'student',
          };
        })()
      : null,
    sender: message.sender
      ? {
          ...message.sender,
          display_name: getDisplayName(message.sender),
        }
      : null,
  }));

  return {
    messages,
    supportsReplies,
  };
}

export async function GET(request: NextRequest) {
  const context = await getContext();
  if ('error' in context) return context.error;

  await pruneOldMessages(context.dataClient, context.canPruneMessages);

  const grade = resolveGrade(context.profile, parseGrade(request.nextUrl.searchParams.get('grade')));
  if (!grade) {
    return NextResponse.json({ error: 'Grade is not configured' }, { status: 400 });
  }

  try {
    const [result, muted] = await Promise.all([
      loadMessages(context.dataClient, grade, context.profile),
      isGradeMuted(context.dataClient, grade).catch(() => false),
    ]);
    return NextResponse.json({
      role: context.profile.role,
      grade,
      muted,
      retentionDays: CHAT_RETENTION_DAYS,
      supportsReplies: result.supportsReplies,
      messages: result.messages,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load chat messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const context = await getContext();
  if ('error' in context) return context.error;

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const replyToMessageId = typeof body?.replyToMessageId === 'string' ? body.replyToMessageId : '';
  const requestedGrade = parseGrade(body?.grade ? String(body.grade) : null);
  const grade = resolveGrade(context.profile, requestedGrade);

  if (!grade) {
    return NextResponse.json({ error: 'Grade is not configured' }, { status: 400 });
  }

  // Students cannot post when grade chat is muted
  if (context.profile.role === 'student') {
    const muted = await isGradeMuted(context.dataClient, grade).catch(() => false);
    if (muted) {
      return NextResponse.json({ error: 'Chat is currently muted by admin. You cannot send messages right now.' }, { status: 403 });
    }
  }

  if (!message) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 });
  }

  if (message.length > 800) {
    return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
  }

  if (containsBlockedContent(message)) {
    return NextResponse.json({ error: 'Your message contains inappropriate language. Please keep the chat respectful.' }, { status: 400 });
  }

  if (replyToMessageId) {
    const { data: replyTarget, error: replyTargetError } = await context.dataClient
      .from('grade_chat_messages')
      .select('id, grade')
      .eq('id', replyToMessageId)
      .single();

    if (replyTargetError || !replyTarget || replyTarget.grade !== grade) {
      return NextResponse.json({ error: 'You can only reply to a message in this room' }, { status: 400 });
    }
  }

  await pruneOldMessages(context.dataClient, context.canPruneMessages);

  const insertPayload: Record<string, string | number> = {
    grade,
    sender_id: context.profile.id,
    message,
  };

  if (replyToMessageId) {
    insertPayload.reply_to_id = replyToMessageId;
  }

  const { error } = await context.dataClient.from('grade_chat_messages').insert(insertPayload);

  if (error) {
    if (replyToMessageId && isMissingColumnError(error, 'reply_to_id')) {
      return NextResponse.json({ error: 'Chat replies require the latest database migration. Run migration-grade-chat.sql in Supabase.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }

  const result = await loadMessages(context.dataClient, grade, context.profile);
  const postMuted = await isGradeMuted(context.dataClient, grade).catch(() => false);
  return NextResponse.json({
    role: context.profile.role,
    grade,
    muted: postMuted,
    retentionDays: CHAT_RETENTION_DAYS,
    supportsReplies: result.supportsReplies,
    messages: result.messages,
  });
}

export async function PATCH(request: NextRequest) {
  const context = await getContext();
  if ('error' in context) return context.error;

  if (context.profile.role !== 'student') {
    return NextResponse.json({ error: 'Only students can edit their own messages' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const messageId = typeof body?.messageId === 'string' ? body.messageId : '';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const grade = resolveGrade(context.profile, null);

  if (!messageId || !message) {
    return NextResponse.json({ error: 'Message id and content are required' }, { status: 400 });
  }

  if (containsBlockedContent(message)) {
    return NextResponse.json({ error: 'Your message contains inappropriate language. Please keep the chat respectful.' }, { status: 400 });
  }

  const { data: existing } = await context.dataClient
    .from('grade_chat_messages')
    .select('sender_id, grade')
    .eq('id', messageId)
    .single();

  if (!existing || existing.sender_id !== context.profile.id || existing.grade !== grade) {
    return NextResponse.json({ error: 'You can only edit your own messages' }, { status: 403 });
  }

  const { error } = await context.dataClient
    .from('grade_chat_messages')
    .update({ message })
    .eq('id', messageId);

  if (error) {
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }

  const result = await loadMessages(context.dataClient, grade!, context.profile);
  const patchMuted = await isGradeMuted(context.dataClient, grade!).catch(() => false);
  return NextResponse.json({
    role: context.profile.role,
    grade,
    muted: patchMuted,
    retentionDays: CHAT_RETENTION_DAYS,
    supportsReplies: result.supportsReplies,
    messages: result.messages,
  });
}

export async function DELETE(request: NextRequest) {
  const context = await getContext();
  if ('error' in context) return context.error;

  const body = await request.json().catch(() => null);
  const messageId = typeof body?.messageId === 'string' ? body.messageId : '';

  if (!messageId) {
    return NextResponse.json({ error: 'Message id is required' }, { status: 400 });
  }

  const { data: existing } = await context.dataClient
    .from('grade_chat_messages')
    .select('sender_id, grade')
    .eq('id', messageId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  if (context.profile.role === 'student' && existing.sender_id !== context.profile.id) {
    return NextResponse.json({ error: 'You can only delete your own messages' }, { status: 403 });
  }

  if (context.profile.role === 'teacher') {
    return NextResponse.json({ error: 'Teachers can reply but cannot delete chat messages' }, { status: 403 });
  }

  const { error } = await context.dataClient.from('grade_chat_messages').delete().eq('id', messageId);
  if (error) {
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }

  const result = await loadMessages(context.dataClient, existing.grade, context.profile);
  const deleteMuted = await isGradeMuted(context.dataClient, existing.grade).catch(() => false);
  return NextResponse.json({
    role: context.profile.role,
    grade: existing.grade,
    muted: deleteMuted,
    retentionDays: CHAT_RETENTION_DAYS,
    supportsReplies: result.supportsReplies,
    messages: result.messages,
  });
}

export async function PUT(request: NextRequest) {
  const context = await getContext();
  if ('error' in context) return context.error;

  if (context.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can mute/unmute chat' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const grade = parseGrade(body?.grade ? String(body.grade) : null);
  const muted = typeof body?.muted === 'boolean' ? body.muted : null;

  if (!grade || muted === null) {
    return NextResponse.json({ error: 'Grade and muted status are required' }, { status: 400 });
  }

  const { error } = await context.dataClient
    .from('chat_grade_settings')
    .upsert({
      grade,
      muted,
      muted_at: muted ? new Date().toISOString() : null,
      muted_by: muted ? context.profile.id : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'grade' });

  if (error) {
    return NextResponse.json({ error: 'Failed to update mute setting' }, { status: 500 });
  }

  return NextResponse.json({ grade, muted });
}