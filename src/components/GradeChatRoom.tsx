'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { LoadingSpinner, PageLoading } from '@/components/Loading';
import type { GradeChatMessage, Profile, UserRole } from '@/lib/types';

const GRADE_OPTIONS = [10, 11, 12];
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

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
  const [retentionDays, setRetentionDays] = useState<number>(1);
  const [muted, setMuted] = useState(false);
  const [togglingMute, setTogglingMute] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<GradeChatMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [reactions, setReactions] = useState<Record<string, string[]>>({});
  const [emojiPickerOpenId, setEmojiPickerOpenId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const messageRefs = useRef<Record<string, HTMLElement | null>>({});

  const canChooseGrade = role !== 'student';

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    setReactions(prev => {
      const current = prev[messageId] || [];
      const exists = current.includes(emoji);
      return {
        ...prev,
        [messageId]: exists ? current.filter(e => e !== emoji) : [...current, emoji],
      };
    });
    setEmojiPickerOpenId(null);
  }, []);

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
      setRetentionDays(result?.retentionDays || 1);
      setMuted(result?.muted === true);
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
      return `Shared with learners in Grade ${selectedGrade}. Replies help you answer specific posts and messages older than 24 hours are removed automatically.`;
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
      setRetentionDays(result?.retentionDays || 1);
      setMuted(result?.muted === true);
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
      setMuted(result?.muted === true);
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
    return <PageLoading message="Loading grade chat" description="Opening the room and cleaning up messages older than 24 hours." />;
  }

  const isChatDisabled = muted && role === 'student';

  const toggleMute = async () => {
    setTogglingMute(true);
    try {
      const response = await fetch('/api/grade-chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: selectedGrade, muted: !muted }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || 'Failed to toggle mute');
      }
      setMuted(result?.muted === true);
    } catch (muteError) {
      setError(muteError instanceof Error ? muteError.message : 'Failed to toggle mute');
    } finally {
      setTogglingMute(false);
    }
  };

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
        <section className="chat-room-shell overflow-hidden rounded-2xl sm:rounded-[34px] border border-white/70 shadow-[0_28px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_28px_70px_rgba(2,6,23,0.34)]">
          <header className="chat-room-header border-b border-slate-200/80 px-3 py-3 sm:px-5 sm:py-4 dark:border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgb(var(--color-primary-light)),rgb(var(--color-primary))_62%,rgb(var(--color-primary-dark)))] text-white shadow-lg shadow-black/10">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.181-3.149A7.962 7.962 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-sm sm:text-base font-bold text-gray-900 dark:text-slate-50">Grade {selectedGrade} Room</h1>
                  <p className="truncate text-[11px] sm:text-xs text-gray-500 dark:text-slate-400">{messages.length} messages</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canChooseGrade && (
                  <select
                    value={selectedGrade}
                    onChange={(event) => {
                      const nextGrade = parseInt(event.target.value, 10);
                      setSelectedGrade(nextGrade);
                      void loadChat(false, nextGrade);
                    }}
                    className="input-field min-w-[100px] sm:min-w-[128px] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm"
                  >
                    {GRADE_OPTIONS.map((grade) => (
                      <option key={grade} value={grade}>Grade {grade}</option>
                    ))}
                  </select>
                )}
                <button onClick={() => void loadChat(false, selectedGrade)} className="btn-secondary px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm">
                  Refresh
                </button>
                {role === 'admin' && (
                  <button
                    onClick={toggleMute}
                    disabled={togglingMute}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-xl font-semibold transition-colors ${
                      muted
                        ? 'bg-red-100 text-red-700 border border-red-200 hover:bg-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30 dark:hover:bg-red-500/30'
                        : 'bg-emerald-100 text-emerald-700 border border-emerald-200 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30 dark:hover:bg-emerald-500/30'
                    }`}
                    title={muted ? 'Unmute student chat' : 'Mute student chat'}
                  >
                    {togglingMute ? '...' : muted ? '🔇 Unmute' : '🔊 Mute'}
                  </button>
                )}
              </div>
            </div>
          </header>

          {muted && (
            <div className="mx-3 mt-2 sm:mx-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <span>🔇</span>
              <span>{role === 'student' ? 'Chat is muted by admin. You cannot send messages right now.' : `Grade ${selectedGrade} chat is muted. Students cannot send messages.`}</span>
            </div>
          )}

          <div className="chat-room-body grid min-h-[72vh] grid-rows-[1fr_auto]">
            <div className="overflow-y-auto px-2 py-3 sm:px-4 sm:py-4" onClick={() => setEmojiPickerOpenId(null)}>
              {messages.length === 0 ? (
                <div className="mx-auto mt-16 max-w-xs sm:max-w-md rounded-2xl border border-dashed border-slate-300/90 bg-white/75 px-5 py-8 sm:px-6 sm:py-10 text-center backdrop-blur-sm dark:border-slate-600 dark:bg-slate-900/60">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">No messages yet</p>
                  <p className="mt-1.5 text-xs sm:text-sm leading-5 text-gray-500 dark:text-slate-400">Start the conversation in Grade {selectedGrade}. Tap reply to keep threads organized.</p>
                </div>
              ) : (
                <div className="space-y-0.5 pb-2">
                  {messages.map((message, index) => {
                    const previousMessage = messages[index - 1];
                    const nextMessage = messages[index + 1];
                    const isOwnMessage = message.sender?.id === profile?.id;
                    const senderName = isOwnMessage ? 'You' : (message.sender?.display_name || message.sender?.full_name || 'Learner');
                    const roleLabel = message.sender?.role || 'student';
                    const showDayChip = !previousMessage || !isSameCalendarDay(previousMessage.created_at, message.created_at);
                    const startsGroup = !previousMessage || previousMessage.sender?.id !== message.sender?.id || !isSameCalendarDay(previousMessage.created_at, message.created_at);
                    const endsGroup = !nextMessage || nextMessage.sender?.id !== message.sender?.id || !isSameCalendarDay(nextMessage.created_at, message.created_at);
                    const messageReactions = reactions[message.id] || [];

                    return (
                      <div key={message.id}>
                        {showDayChip && (
                          <div className="flex justify-center py-2 sm:py-3">
                            <span className="chat-day-chip rounded-lg px-3 py-1 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider shadow-sm">
                              {formatDayLabel(message.created_at)}
                            </span>
                          </div>
                        )}

                        <div
                          ref={(element) => {
                            messageRefs.current[message.id] = element;
                          }}
                          className={`group flex ${isOwnMessage ? 'justify-end' : 'justify-start'} ${startsGroup ? 'mt-2 sm:mt-3' : 'mt-[2px]'}`}
                        >
                          {/* Avatar for others */}
                          {!isOwnMessage && (
                            <div className="w-7 sm:w-8 shrink-0 self-end mr-1">
                              {endsGroup ? (
                                <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-200 text-[10px] sm:text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                                  {senderName.slice(0, 1).toUpperCase()}
                                </div>
                              ) : null}
                            </div>
                          )}

                          <div className={`relative max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                            {/* Sender name */}
                            {startsGroup && !isOwnMessage && (
                              <p className="mb-0.5 ml-1 text-[10px] sm:text-[11px] font-semibold text-primary dark:text-primary-light">
                                {senderName}
                                {roleLabel !== 'student' && (
                                  <span className="ml-1.5 text-[9px] sm:text-[10px] font-medium text-gray-400 dark:text-slate-500">
                                    {roleLabel}
                                  </span>
                                )}
                              </p>
                            )}

                            {/* Message bubble */}
                            <div
                              className={`chat-bubble relative border px-3 py-1.5 sm:px-3.5 sm:py-2 ${
                                isOwnMessage
                                  ? `chat-bubble--own ${startsGroup ? 'rounded-t-2xl rounded-tl-2xl' : 'rounded-t-lg rounded-tl-2xl'} ${endsGroup ? 'rounded-b-2xl rounded-br-md' : 'rounded-b-lg rounded-br-[4px]'} rounded-bl-2xl`
                                  : `chat-bubble--other ${startsGroup ? 'rounded-t-2xl rounded-tr-2xl' : 'rounded-t-lg rounded-tr-2xl'} ${endsGroup ? 'rounded-b-2xl rounded-bl-md' : 'rounded-b-lg rounded-bl-[4px]'} rounded-br-2xl`
                              } ${highlightedMessageId === message.id ? 'ring-2 ring-primary/40 shadow-lg' : ''}`}
                            >
                              {/* Reply preview */}
                              {message.replyTo && (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); jumpToMessage(message.replyTo!.id); }}
                                  className={`mb-1.5 block w-full rounded-lg border-l-[3px] px-2.5 py-1.5 text-left ${
                                    isOwnMessage
                                      ? 'chat-reply-preview--own border-white/50 hover:bg-white/30'
                                      : 'chat-reply-preview--other border-primary/40 hover:bg-primary/8'
                                  }`}
                                >
                                  <p className="text-[10px] sm:text-[11px] font-bold truncate">{message.replyTo.sender_name}</p>
                                  <p className="text-[11px] sm:text-xs leading-4 opacity-80 truncate">{summarizeMessage(message.replyTo.message)}</p>
                                </button>
                              )}

                              {/* Message text */}
                              <p className="whitespace-pre-wrap break-words text-[13px] sm:text-sm leading-[1.45] sm:leading-relaxed">{message.message}</p>

                              {/* Timestamp + actions row */}
                              <div className={`flex items-center gap-1 mt-0.5 ${isOwnMessage ? 'justify-end' : 'justify-end'}`}>
                                <span className="text-[10px] sm:text-[11px] opacity-50 select-none">{formatMessageTime(message.created_at)}</span>
                              </div>
                            </div>

                            {/* Emoji reactions display */}
                            {messageReactions.length > 0 && (
                              <div className={`flex flex-wrap gap-1 mt-0.5 ${isOwnMessage ? 'justify-end mr-1' : 'justify-start ml-1'}`}>
                                {messageReactions.map((emoji, i) => (
                                  <button
                                    key={i}
                                    onClick={(e) => { e.stopPropagation(); toggleReaction(message.id, emoji); }}
                                    className="flex items-center gap-0.5 rounded-full bg-white/90 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-600/40 px-1.5 py-0.5 text-sm shadow-sm hover:scale-110 transition-transform"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Action buttons - WhatsApp style hover */}
                            <div className={`absolute ${isOwnMessage ? '-left-1 sm:-left-2' : '-right-1 sm:-right-2'} top-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5`}>
                              {/* Emoji button */}
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setEmojiPickerOpenId(emojiPickerOpenId === message.id ? null : message.id); }}
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-600/60 shadow-md text-sm hover:scale-110 transition-transform"
                                title="React"
                              >
                                😊
                              </button>
                              {/* Chevron menu */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setEmojiPickerOpenId(emojiPickerOpenId === `menu-${message.id}` ? null : `menu-${message.id}`); }}
                                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-600/60 shadow-md text-slate-500 dark:text-slate-400 hover:scale-110 transition-transform"
                                  title="More"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {emojiPickerOpenId === `menu-${message.id}` && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className={`absolute z-20 ${isOwnMessage ? 'right-0' : 'left-0'} top-8 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-600/60 shadow-xl py-1 min-w-[130px]`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => { beginReply(message); setEmojiPickerOpenId(null); }}
                                      disabled={!supportsReplies}
                                      className="w-full text-left px-3 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
                                    >
                                      ↩️ Reply
                                    </button>
                                    {message.canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingId(message.id);
                                          setReplyingTo(null);
                                          setDraft(message.message);
                                          setEmojiPickerOpenId(null);
                                          window.requestAnimationFrame(() => composerRef.current?.focus());
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                                      >
                                        ✏️ Edit
                                      </button>
                                    )}
                                    {message.canDelete && (
                                      <button
                                        type="button"
                                        onClick={() => { void handleDelete(message.id); setEmojiPickerOpenId(null); }}
                                        className="w-full text-left px-3 py-2 text-xs sm:text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                      >
                                        🗑️ Delete
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Emoji picker popup */}
                            {emojiPickerOpenId === message.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute z-20 ${isOwnMessage ? 'right-0' : 'left-8 sm:left-10'} -top-1 flex items-center gap-1 bg-white dark:bg-slate-800 rounded-full border border-slate-200/80 dark:border-slate-600/60 shadow-xl px-2 py-1.5`}
                              >
                                {QUICK_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => toggleReaction(message.id, emoji)}
                                    className="text-lg sm:text-xl hover:scale-125 transition-transform px-0.5"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Composer - WhatsApp style */}
            <form onSubmit={submitMessage} className="chat-composer-dock border-t border-slate-200/80 px-2 py-2 sm:px-3 sm:py-3 dark:border-white/10">
              {(replyingTo || editingId) && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border-l-[3px] border-primary bg-slate-50/90 px-3 py-2 dark:border-primary-light dark:bg-slate-900/70">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-[11px] font-bold text-primary dark:text-primary-light">
                      {editingId ? 'Editing' : `Replying to ${replyingTo?.sender?.display_name || replyingTo?.sender?.full_name || (replyingTo?.sender?.id === profile?.id ? 'You' : 'Learner')}`}
                    </p>
                    <p className="truncate text-[11px] sm:text-xs text-gray-600 dark:text-slate-300">
                      {editingId ? 'Updating your message' : summarizeMessage(replyingTo?.message || '')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setReplyingTo(null);
                      composerRef.current?.focus();
                    }}
                    className="shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              <div className="chat-composer flex items-end gap-1.5 sm:gap-2 rounded-[24px] sm:rounded-[30px] border px-2 py-1.5 sm:px-3 sm:py-2 shadow-sm dark:shadow-none">
                <textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (draft.trim() && !isChatDisabled) {
                        void submitMessage(event);
                      }
                    }
                  }}
                  rows={1}
                  maxLength={800}
                  disabled={isChatDisabled}
                  className="min-h-[40px] sm:min-h-[44px] max-h-[120px] flex-1 resize-none border-0 bg-transparent px-1.5 sm:px-2 py-1.5 sm:py-2 text-[13px] sm:text-sm leading-[1.4] sm:leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={isChatDisabled ? 'Chat is muted by admin...' : 'Type a message...'}
                />
                <div className="flex shrink-0 items-center">
                  {(editingId || replyingTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setReplyingTo(null);
                        setDraft('');
                      }}
                      className="mr-1 rounded-full p-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                      title="Cancel"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving || !draft.trim() || isChatDisabled}
                    className="btn-primary flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full p-0 shadow-md disabled:opacity-30"
                  >
                    {saving ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-1 flex items-center justify-between px-2 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
                <span>
                  {role === 'admin' ? 'Admin' : role === 'teacher' ? (profile?.full_name || 'Teacher') : 'You'}
                </span>
                <span>{draft.trim().length}/800</span>
              </div>
            </form>
          </div>
        </section>

        <aside className="hidden xl:flex xl:flex-col xl:gap-4">
          <div className="chat-side-rail rounded-[28px] border border-white/70 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_18px_40px_rgba(2,6,23,0.3)]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold">💡 Tips</p>
            <ul className="mt-3 space-y-2.5 text-[13px] leading-5 text-gray-600 dark:text-slate-300">
              <li className="flex gap-2"><span>↩️</span> Swipe right on a message or hover to reply</li>
              <li className="flex gap-2"><span>😊</span> React with emojis — hover any message</li>
              <li className="flex gap-2"><span>⏎</span> Press Enter to send, Shift+Enter for new line</li>
              <li className="flex gap-2"><span>🕐</span> Messages older than 24 hours auto-delete</li>
            </ul>
          </div>

          <div className="chat-side-rail rounded-[28px] border border-white/70 p-4 shadow-[0_18px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_18px_40px_rgba(2,6,23,0.3)]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-semibold">👤 Your role</p>
            <p className="mt-2 text-[13px] leading-5 text-gray-600 dark:text-slate-300">
              {role === 'student' ? 'You can edit/delete your own messages.' : role === 'teacher' ? 'Switch between grades and reply as teacher.' : 'Full moderation: post as Admin, delete any message.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}