'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { LoadingSpinner, PageLoading } from '@/components/Loading';
import type { GradeChatMessage, Profile, UserRole } from '@/lib/types';

const GRADE_OPTIONS = [10, 11, 12];

function summarizeMessage(message: string) {
  const compact = message.replace(/\s+/g, ' ').trim();
  return compact.length > 88 ? `${compact.slice(0, 88)}...` : compact;
}

function isSameCalendarDay(left: string, right: string) {
  const leftDate = new Date(left);
  const rightDate = new Date(right);

  return leftDate.getFullYear() === rightDate.getFullYear()
    && leftDate.getMonth() === rightDate.getMonth()
    && leftDate.getDate() === rightDate.getDate();
}

function formatDayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameCalendarDay(date.toISOString(), today.toISOString())) {
    return 'Today';
  }

  if (isSameCalendarDay(date.toISOString(), yesterday.toISOString())) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-KE', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleTimeString('en-KE', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function GradeChatRoom({ role }: { role: UserRole }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<GradeChatMessage[]>([]);
  const [supportsReplies, setSupportsReplies] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState<number>(10);
  const [retentionDays, setRetentionDays] = useState<number>(7);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<GradeChatMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const messageRefs = useRef<Record<string, HTMLElement | null>>({});

  const canChooseGrade = role !== 'student';

  const loadChat = async (showLoader = false, explicitGrade?: number) => {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let nextProfile = profile;
      if (user && !nextProfile) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data) {
          nextProfile = data as Profile;
          setProfile(nextProfile);
          if (role === 'student' && data.grade) {
            setSelectedGrade(data.grade);
          }
        }
      }

      const activeGrade = explicitGrade || (role === 'student' ? nextProfile?.grade || selectedGrade : selectedGrade);
      const url = new URL('/api/grade-chat', window.location.origin);
      if (activeGrade) {
        url.searchParams.set('grade', String(activeGrade));
      }

      const response = await fetch(url.toString());
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to load chat');
      }

      setMessages((result?.messages || []) as GradeChatMessage[]);
      setSupportsReplies(result?.supportsReplies !== false);
      setSelectedGrade(result?.grade || activeGrade || 10);
      setRetentionDays(result?.retentionDays || 7);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChat(true);

    const intervalId = window.setInterval(() => {
      void loadChat(false);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => () => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
  }, []);

  const description = useMemo(() => {
    if (role === 'student') {
      return `Shared with learners in Grade ${selectedGrade}. Replies help you answer specific posts and messages older than ${retentionDays} days are removed automatically.`;
    }
    if (role === 'teacher') {
      return `Open any grade room, jump into a thread, and reply as a teacher using the full name saved on your profile.`;
    }
    return `Review every grade room, reply in context, post as Admin, and delete any message when moderation is needed.`;
  }, [role, selectedGrade, retentionDays]);

  const beginReply = (message: GradeChatMessage) => {
    setEditingId(null);
    setReplyingTo(message);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  };

  const jumpToMessage = (messageId: string) => {
    const target = messageRefs.current[messageId];
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(messageId);

    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedMessageId(null);
      highlightTimerRef.current = null;
    }, 1800);
  };

  const submitMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;

    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/grade-chat', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          editingId
            ? { messageId: editingId, message }
            : { grade: selectedGrade, message, replyToMessageId: replyingTo?.id }
        ),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to save message');
      }

      setMessages((result?.messages || []) as GradeChatMessage[]);
      setSupportsReplies(result?.supportsReplies !== false);
      setSelectedGrade(result?.grade || selectedGrade);
      setRetentionDays(result?.retentionDays || 7);
      setDraft('');
      setEditingId(null);
      setReplyingTo(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save message');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/grade-chat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to delete message');
      }

      setMessages((result?.messages || []) as GradeChatMessage[]);
      setSupportsReplies(result?.supportsReplies !== false);
      if (editingId === messageId) {
        setEditingId(null);
        setDraft('');
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete message');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PageLoading message="Loading grade chat" description="Opening the room and cleaning up messages older than one week." />;
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      {!supportsReplies && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Reply-to-message is not available yet on this live database. Run migration-grade-chat.sql in Supabase to enable replying to specific messages.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="chat-room-shell overflow-hidden rounded-[34px] border border-white/70 shadow-[0_28px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_28px_70px_rgba(2,6,23,0.34)]">
          <header className="chat-room-header border-b border-slate-200/80 px-4 py-4 sm:px-5 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,rgb(var(--color-primary-light)),rgb(var(--color-primary))_62%,rgb(var(--color-primary-dark)))] text-white shadow-lg shadow-black/10">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.181-3.149A7.962 7.962 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">Grade conversation</p>
                  <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-slate-50">Grade {selectedGrade} Room</h1>
                  <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-slate-400">{description}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                  {messages.length} live
                </span>
                {canChooseGrade && (
                  <select
                    value={selectedGrade}
                    onChange={(event) => {
                      const nextGrade = parseInt(event.target.value, 10);
                      setSelectedGrade(nextGrade);
                      void loadChat(false, nextGrade);
                    }}
                    className="input-field min-w-[128px] px-3 py-2 text-sm"
                  >
                    {GRADE_OPTIONS.map((grade) => (
                      <option key={grade} value={grade}>Grade {grade}</option>
                    ))}
                  </select>
                )}
                <button onClick={() => void loadChat(false, selectedGrade)} className="btn-secondary px-4 py-2 text-sm">
                  Refresh
                </button>
              </div>
            </div>
          </header>

          <div className="chat-room-body grid min-h-[72vh] grid-rows-[1fr_auto]">
            <div className="overflow-y-auto px-3 py-4 sm:px-4">
              {messages.length === 0 ? (
                <div className="mx-auto mt-16 max-w-md rounded-[28px] border border-dashed border-slate-300/90 bg-white/75 px-6 py-10 text-center backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/60">
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">No messages yet in Grade {selectedGrade}</p>
                  <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">Start with a question, reminder, or update. Replies will stay attached to the exact message they answer.</p>
                </div>
              ) : (
                <div className="space-y-1 pb-2">
                  {messages.map((message, index) => {
                    const previousMessage = messages[index - 1];
                    const nextMessage = messages[index + 1];
                    const isOwnMessage = message.sender?.id === profile?.id;
                    const senderName = isOwnMessage ? 'You' : (message.sender?.display_name || message.sender?.full_name || 'Learner');
                    const roleLabel = isOwnMessage ? 'you' : (message.sender?.role || 'student');
                    const showDayChip = !previousMessage || !isSameCalendarDay(previousMessage.created_at, message.created_at);
                    const startsGroup = !previousMessage || previousMessage.sender?.id !== message.sender?.id || !isSameCalendarDay(previousMessage.created_at, message.created_at);
                    const endsGroup = !nextMessage || nextMessage.sender?.id !== message.sender?.id || !isSameCalendarDay(nextMessage.created_at, message.created_at);

                    return (
                      <div key={message.id} className="space-y-2">
                        {showDayChip && (
                          <div className="flex justify-center py-3">
                            <span className="chat-day-chip rounded-full border px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] shadow-sm backdrop-blur-sm">
                              {formatDayLabel(message.created_at)}
                            </span>
                          </div>
                        )}

                        <article
                          ref={(element) => {
                            messageRefs.current[message.id] = element;
                          }}
                          className={`group flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'} ${startsGroup ? 'mt-1' : 'mt-0.5'}`}
                        >
                          {!isOwnMessage && (
                            <div className="hidden w-10 shrink-0 sm:block">
                              {endsGroup ? (
                                <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/80 bg-white/85 text-xs font-semibold text-slate-600 shadow-sm dark:border-white/10 dark:bg-slate-800/80 dark:text-slate-200">
                                  {senderName.slice(0, 1).toUpperCase()}
                                </div>
                              ) : null}
                            </div>
                          )}

                          <div className={`flex max-w-[min(100%,38rem)] flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                            {startsGroup && (
                              <div className={`mb-1.5 flex flex-wrap items-center gap-2 px-1 text-[11px] uppercase tracking-[0.16em] ${isOwnMessage ? 'justify-end text-emerald-700 dark:text-emerald-300' : 'justify-start text-slate-500 dark:text-slate-400'}`}>
                                <span className="font-semibold">{senderName}</span>
                                <span className="opacity-70">{roleLabel}</span>
                              </div>
                            )}

                            <div
                              className={`chat-bubble w-full border px-4 py-3 transition-all ${
                                isOwnMessage
                                  ? `${startsGroup ? 'rounded-t-[22px]' : 'rounded-t-[14px]'} ${endsGroup ? 'rounded-b-[22px] rounded-br-md' : 'rounded-b-[14px] rounded-br-[6px]'} chat-bubble--own shadow-[0_10px_22px_rgba(26,107,69,0.10)]`
                                  : `${startsGroup ? 'rounded-t-[22px]' : 'rounded-t-[14px]'} ${endsGroup ? 'rounded-b-[22px] rounded-bl-md' : 'rounded-b-[14px] rounded-bl-[6px]'} chat-bubble--other shadow-[0_10px_22px_rgba(15,23,42,0.06)]`
                              } ${highlightedMessageId === message.id ? 'ring-2 ring-primary/35 shadow-[0_0_0_6px_rgba(26,107,69,0.08)]' : ''}`}
                            >
                              {message.replyTo && (
                                <button
                                  type="button"
                                  onClick={() => jumpToMessage(message.replyTo!.id)}
                                  className={`mb-3 block w-full rounded-2xl border-l-4 px-3 py-2 text-left ${
                                    isOwnMessage
                                      ? 'chat-reply-preview--own border-emerald-700/60 hover:bg-white/60 dark:hover:bg-black/25'
                                      : 'chat-reply-preview--other border-primary/45 hover:bg-primary/10 dark:hover:bg-white/10'
                                  }`}
                                >
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Replying to {message.replyTo.sender_name}</p>
                                  <p className="mt-1 text-sm leading-5 opacity-90">{summarizeMessage(message.replyTo.message)}</p>
                                </button>
                              )}

                              <p className="whitespace-pre-wrap break-words text-sm leading-7">{message.message}</p>

                              <div className={`mt-2 flex items-center gap-2 ${isOwnMessage ? 'justify-end' : 'justify-between'}`}>
                                {!isOwnMessage && (
                                  <div className="hidden text-[11px] uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 sm:block">
                                    {endsGroup ? 'Reply in context' : ''}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span>{formatMessageTime(message.created_at)}</span>
                                  <div className="flex flex-wrap items-center gap-1.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                    <button
                                      type="button"
                                      onClick={() => beginReply(message)}
                                      disabled={!supportsReplies}
                                      className={`rounded-full px-2.5 py-1 font-semibold transition-colors ${
                                        isOwnMessage
                                          ? 'bg-white/75 text-emerald-900 hover:bg-white dark:bg-black/15 dark:text-emerald-50 dark:hover:bg-black/25'
                                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                                      } disabled:cursor-not-allowed disabled:opacity-50`}
                                    >
                                      Reply
                                    </button>
                                    {message.canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingId(message.id);
                                          setReplyingTo(null);
                                          setDraft(message.message);
                                          window.requestAnimationFrame(() => composerRef.current?.focus());
                                        }}
                                        className={`rounded-full px-2.5 py-1 font-semibold transition-colors ${
                                          isOwnMessage
                                            ? 'bg-white/75 text-emerald-900 hover:bg-white dark:bg-black/15 dark:text-emerald-50 dark:hover:bg-black/25'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                      >
                                        Edit
                                      </button>
                                    )}
                                    {message.canDelete && (
                                      <button
                                        type="button"
                                        onClick={() => void handleDelete(message.id)}
                                        className="rounded-full bg-red-500 px-2.5 py-1 font-semibold text-white transition-colors hover:bg-red-600"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={submitMessage} className="chat-composer-dock border-t border-slate-200/80 p-3 backdrop-blur-xl sm:p-4 dark:border-white/10">
              {(replyingTo || editingId) && (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-white/10 dark:bg-slate-900/70">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
                      {editingId ? 'Editing message' : `Replying to ${replyingTo?.sender?.display_name || replyingTo?.sender?.full_name || (replyingTo?.sender?.id === profile?.id ? 'You' : 'Learner')}`}
                    </p>
                    <p className="mt-1 truncate text-sm text-gray-700 dark:text-slate-200">
                      {editingId ? 'You are updating an existing message.' : summarizeMessage(replyingTo?.message || '')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setReplyingTo(null);
                      composerRef.current?.focus();
                    }}
                    className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Clear
                  </button>
                </div>
              )}

              <div className="chat-composer flex items-end gap-2 rounded-[30px] border px-3 py-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_14px_30px_rgba(2,6,23,0.24)]">
                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={1}
                  maxLength={800}
                  className="min-h-[58px] flex-1 resize-y border-0 bg-transparent px-2 py-2 text-sm leading-7 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder={role === 'student' ? 'Message your grade room...' : 'Write a reply for this room...'}
                />
                <div className="flex shrink-0 items-center gap-2">
                  {(editingId || replyingTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setReplyingTo(null);
                        setDraft('');
                      }}
                      className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                  <button type="submit" disabled={saving || !draft.trim()} className="btn-primary flex h-12 min-w-[48px] items-center justify-center gap-2 rounded-full px-5 text-sm">
                    {saving ? <><LoadingSpinner size="sm" /> Sending</> : editingId ? 'Save' : 'Send'}
                  </button>
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-2 px-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
                <span>
                  {role === 'admin'
                    ? 'Messages appear as Admin.'
                    : role === 'teacher'
                      ? `Messages appear as ${profile?.full_name || 'Teacher'}.`
                      : 'Your messages appear as You.'}
                </span>
                <span>{draft.trim().length}/800</span>
              </div>
            </form>
          </div>
        </section>

        <aside className="hidden xl:flex xl:flex-col xl:gap-4">
          <div className="chat-side-rail rounded-[28px] border border-white/70 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_18px_40px_rgba(2,6,23,0.3)]">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Chat details</p>
            <div className="mt-4 space-y-4 text-sm leading-7 text-gray-600 dark:text-slate-300">
              <p>This room behaves like a shared messenger thread, not a notice board. Use Reply to keep responses attached to the right message.</p>
              <p>Messages older than {retentionDays} days are removed automatically to keep the room current.</p>
              <p>{role === 'student' ? 'You can edit or delete only your own messages.' : role === 'teacher' ? 'You can switch between grades and reply as a teacher.' : 'You can switch grades, post as Admin, and moderate messages.'}</p>
            </div>
          </div>

          <div className="chat-side-rail rounded-[28px] border border-white/70 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_18px_40px_rgba(2,6,23,0.3)]">
            <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Quick tips</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-600 dark:text-slate-300">
              <li>Tap a reply preview to jump back to the original message.</li>
              <li>Consecutive messages from the same sender are grouped like a real chat thread.</li>
              <li>On mobile, the side rail disappears so the chat fills the screen.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}