import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../../hooks/useWebRTC';
import { useAuthStore } from '../../store/authStore';
import type { RoomChatMessage } from '../../api/rooms';

interface Props {
  messages: (ChatMessage | RoomChatMessage)[];
  onSend: (text: string) => void;
}

export function RoomChat({ messages, onSend }: Props) {
  const { userId } = useAuthStore();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0e2218] rounded-2xl overflow-hidden border border-ink-200 dark:border-[#1c3a2a]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-ink-100 dark:border-[#1c3a2a] bg-ink-50 dark:bg-[#0c2118]">
        <h3 className="font-bold text-ink-800 dark:text-[#e8eaf0] text-sm flex items-center gap-2">
          <span>💬</span> Чат кімнати
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
        {messages.length === 0 && (
          <div className="text-center text-ink-400 py-8 text-sm">
            <p className="text-2xl mb-2">💬</p>
            <p>Поки нема повідомлень</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.userId === userId;
          return (
            <div key={msg.id ?? i} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              {!isOwn && (
                <span className="text-[11px] text-ink-400 font-semibold mb-0.5 px-1">{msg.displayName}</span>
              )}
              <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                isOwn
                  ? 'bg-brand-600 text-white rounded-br-sm'
                  : 'bg-ink-100 dark:bg-[#163a28] text-ink-800 dark:text-[#e8eaf0] rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
              <span className="text-[10px] text-ink-300 mt-0.5 px-1">
                {formatTime(msg.sentAt)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-ink-100 dark:border-[#1c3a2a] p-3 flex gap-2 bg-white dark:bg-[#0e2218]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Написати повідомлення…"
          className="input py-2.5 flex-1"
        />
        <button onClick={handleSend} disabled={!input.trim()} className="btn btn-primary w-10 px-0 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
