import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import {
  getConversations, getContacts, getMessages, sendMessage,
  type Conversation, type Contact, type Message,
} from '../api/messenger';
import { Avatar, Loader, EmptyState, cx } from '../components/ui';
import { useSignalR } from '../hooks/useSignalR';

const ROLE_LABELS: Record<string, string> = {
  Teacher: 'Викладач', Student: 'Студент', Admin: 'Адмін', Parent: 'Батьки',
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Вчора';
  if (diffDays < 7)  return d.toLocaleDateString('uk-UA', { weekday: 'short' });
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
}

export function MessengerPage() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts]     = useState<Contact[]>([]);
  const [messages, setMessages]     = useState<Message[]>([]);
  const [selected, setSelected]     = useState<Contact | null>(null);
  const [input, setInput]           = useState('');
  const [sending, setSending]       = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const selectedRef = useRef<Contact | null>(null);

  useSignalR('/hubs/notifications', {
    DirectMessage: (...args: unknown[]) => {
      const msg = args[0] as { id: string; content: string; sentAt: string; senderId: string };
      if (selectedRef.current && msg.senderId === selectedRef.current.id) {
        setMessages(prev => [...prev, {
          id: msg.id, content: msg.content, sentAt: msg.sentAt, isRead: true, isMine: false
        }]);
      }
      getConversations().then(r => setConversations(r.data));
    }
  });

  const loadConversations = () =>
    getConversations().then(r => setConversations(r.data));

  useEffect(() => {
    Promise.all([loadConversations(), getContacts().then(r => setContacts(r.data))])
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    selectedRef.current = selected;
    if (!selected) return;
    let cancelled = false;
    getMessages(selected.id).then(r => { if (!cancelled) setMessages(r.data); });
    return () => { cancelled = true; };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!selected || !input.trim()) return;
    setSending(true);
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(), content: text,
      sentAt: new Date().toISOString(), isRead: false, isMine: true
    }]);
    try {
      await sendMessage(selected.id, text);
      loadConversations();
    } catch {
      setMessages(prev => prev.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function selectPartner(contact: Contact) {
    setSelected(contact);
    setShowContacts(false);
    setSearch('');
  }

  if (loading) return <Layout title="Месенджер"><Loader /></Layout>;

  // Merge contacts + conversations for sidebar
  const allItems: Contact[] = [
    ...conversations.map(c => ({ id: c.userId, name: c.name, role: c.role, email: '' })),
    ...contacts.filter(c => !conversations.some(cv => cv.userId === c.id))
  ].filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);

  const q = search.toLowerCase();
  const sidebarItems = q
    ? allItems.filter(c => c.name.toLowerCase().includes(q) || (ROLE_LABELS[c.role] ?? c.role).toLowerCase().includes(q))
    : allItems;

  const contactsFiltered = q
    ? contacts.filter(c => c.name.toLowerCase().includes(q))
    : contacts;

  // Group consecutive messages by sender
  type Group = { isMine: boolean; items: Message[] };
  const groups: Group[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    if (last && last.isMine === msg.isMine) last.items.push(msg);
    else groups.push({ isMine: msg.isMine, items: [msg] });
  }

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <Layout title="Месенджер" subtitle="Особисті повідомлення">
      <div className="flex gap-4 h-[calc(100vh-160px)] min-h-[420px]">

        {/* ─── Sidebar ─── */}
        <div className="w-72 flex-shrink-0 flex flex-col bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden">
          {/* Header */}
          <div className="px-3 pt-3 pb-2 border-b border-ink-100 dark:border-ink-800 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="font-bold text-ink-900 dark:text-white text-sm">Повідомлення</p>
                {totalUnread > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center">
                    {totalUnread}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setShowContacts(s => !s); setSearch(''); }}
                className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition flex items-center justify-center text-base"
                title="Новий чат"
              >
                ✏️
              </button>
            </div>
            {/* Search */}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Пошук…"
              className="input py-1.5 text-xs w-full"
            />
          </div>

          {/* New conversation list */}
          {showContacts && (
            <div className="border-b border-ink-100 dark:border-ink-800 max-h-44 overflow-y-auto flex-shrink-0">
              <p className="px-3 py-2 text-[10px] font-bold text-ink-400 uppercase tracking-wide">Нова розмова</p>
              {contactsFiltered.length === 0
                ? <p className="px-3 pb-3 text-xs text-ink-400">Нікого не знайдено</p>
                : contactsFiltered.map(c => (
                  <button key={c.id} onClick={() => selectPartner(c)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50 dark:hover:bg-[#1e2033] transition text-left">
                    <Avatar name={c.name} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink-800 dark:text-white truncate">{c.name}</p>
                      <p className="text-xs text-ink-400">{ROLE_LABELS[c.role] ?? c.role}</p>
                    </div>
                  </button>
                ))
              }
            </div>
          )}

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {sidebarItems.length === 0 ? (
              <div className="p-4 text-center text-ink-400 text-xs">{q ? 'Нічого не знайдено' : 'Немає розмов'}</div>
            ) : sidebarItems.map(c => {
              const conv = conversations.find(cv => cv.userId === c.id);
              return (
                <button key={c.id} onClick={() => selectPartner(c)}
                  className={cx(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-800 transition text-left border-b border-ink-50 dark:border-ink-800',
                    selected?.id === c.id && 'bg-brand-50 dark:bg-brand-950/30'
                  )}>
                  <div className="relative flex-shrink-0">
                    <Avatar name={c.name} size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={cx('text-sm truncate', conv?.unreadCount ? 'font-bold text-ink-900 dark:text-white' : 'font-semibold text-ink-800 dark:text-ink-200')}>{c.name}</p>
                      {conv?.lastMessage && (
                        <span className="text-[10px] text-ink-400 flex-shrink-0">{fmtTime(conv.lastMessage.sentAt)}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      {conv?.lastMessage ? (
                        <p className={cx('text-xs truncate flex-1', conv.unreadCount ? 'text-ink-700 dark:text-ink-300 font-medium' : 'text-ink-400')}>
                          {conv.lastMessage.isMine ? 'Ви: ' : ''}{conv.lastMessage.content}
                        </p>
                      ) : (
                        <p className="text-xs text-ink-400 truncate flex-1">{ROLE_LABELS[c.role] ?? c.role}</p>
                      )}
                      {conv && conv.unreadCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Chat area ─── */}
        <div className="flex-1 flex flex-col bg-white dark:bg-ink-900 rounded-2xl border border-ink-100 dark:border-ink-800 overflow-hidden min-w-0">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState icon="💬" title="Оберіть розмову" hint="або натисніть ✏️ для нового чату" />
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-ink-100 dark:border-ink-800 flex-shrink-0 bg-white dark:bg-ink-900">
                <Avatar name={selected.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-ink-900 dark:text-white text-sm truncate">{selected.name}</p>
                  <p className="text-xs text-ink-400">{ROLE_LABELS[selected.role] ?? selected.role}</p>
                </div>
                <button
                  onClick={() => navigate('/rooms')}
                  className="btn btn-soft text-xs py-1.5 px-3 flex items-center gap-1.5 flex-shrink-0"
                  title="Відеодзвінок"
                >
                  📹 Дзвінок
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
                {messages.length === 0 && (
                  <div className="flex-1 flex items-center justify-center text-ink-400 text-sm">
                    Напишіть перше повідомлення
                  </div>
                )}

                {groups.map((group, gi) => (
                  <div key={gi} className={cx('flex flex-col gap-0.5', group.isMine ? 'items-end' : 'items-start')}>
                    {group.items.map((msg, mi) => {
                      const isFirst = mi === 0;
                      const isLast  = mi === group.items.length - 1;
                      return (
                        <div key={msg.id} className={cx('flex items-end gap-2', group.isMine && 'flex-row-reverse')}>
                          {/* avatar spacer — only show on last in group */}
                          <div className="w-6 flex-shrink-0" />
                          <div className={cx(
                            'max-w-[72%] px-3.5 py-2 text-sm leading-relaxed',
                            group.isMine ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-800 dark:text-ink-100',
                            group.isMine && 'rounded-l-2xl',
                            group.isMine && isFirst && isLast && 'rounded-r-2xl',
                            group.isMine && isFirst && !isLast && 'rounded-tr-2xl rounded-br-md',
                            group.isMine && isLast  && !isFirst && 'rounded-tr-md rounded-br-2xl',
                            group.isMine && !isFirst && !isLast && 'rounded-r-md',
                            !group.isMine && 'rounded-r-2xl',
                            !group.isMine && isFirst && isLast && 'rounded-l-2xl',
                            !group.isMine && isFirst && !isLast && 'rounded-tl-2xl rounded-bl-md',
                            !group.isMine && isLast  && !isFirst && 'rounded-tl-md rounded-bl-2xl',
                            !group.isMine && !isFirst && !isLast && 'rounded-l-md',
                          )}>
                            <p>{msg.content}</p>
                            {isLast && (
                              <p className={cx('text-[10px] mt-1', group.isMine ? 'text-white/60 text-right' : 'text-ink-400')}>
                                {new Date(msg.sentAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                                {group.isMine && msg.isRead && <span className="ml-1">✓✓</span>}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-ink-100 dark:border-ink-800 p-3 flex gap-2 flex-shrink-0 bg-white dark:bg-ink-900">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Написати повідомлення…"
                  disabled={sending}
                  className="input flex-1 py-2.5"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="btn btn-primary w-11 px-0 flex-shrink-0 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
