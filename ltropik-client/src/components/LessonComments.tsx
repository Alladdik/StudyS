import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getComments, createComment, deleteComment } from '../api/comments';
import { useAuthStore } from '../store/authStore';
import type { LessonComment } from '../types';
import { cx } from './ui';

interface Props { lessonId: string; }

function CommentItem({ comment, lessonId, currentUserId, onReply, onDelete }: {
  comment: LessonComment;
  lessonId: string;
  currentUserId: string | null;
  onReply: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {comment.authorName[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-ink-800 dark:text-[#e8eaf0]">{comment.authorName}</span>
          <span className="text-xs text-ink-300">{new Date(comment.createdAt).toLocaleString('uk-UA')}</span>
        </div>
        <p className="text-sm text-ink-600 leading-relaxed">{comment.body}</p>
        <div className="flex gap-3 mt-1">
          <button onClick={() => onReply(comment.id)} className="text-xs text-brand-500 hover:text-brand-700 font-medium">Відповісти</button>
          {currentUserId === comment.authorId && (
            <button onClick={() => onDelete(comment.id)} className="text-xs text-rose-400 hover:text-rose-600">Видалити</button>
          )}
        </div>
        {comment.replies.length > 0 && (
          <div className="mt-3 flex flex-col gap-3 pl-3 border-l-2 border-ink-100 dark:border-[#282c44]">
            {comment.replies.map((r) => (
              <CommentItem key={r.id} comment={r} lessonId={lessonId} currentUserId={currentUserId} onReply={onReply} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function LessonComments({ lessonId }: Props) {
  const { userId } = useAuthStore();
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getComments(lessonId).then((r) => setComments(r.data)).catch(() => {});
  }, [lessonId]);

  async function submit() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const r = await createComment({ lessonId, body: text.trim(), parentCommentId: replyTo ?? undefined });
      if (replyTo) {
        setComments((prev) => prev.map((c) =>
          c.id === replyTo ? { ...c, replies: [...c.replies, r.data] } : c
        ));
      } else {
        setComments((prev) => [...prev, r.data]);
      }
      setText('');
      setReplyTo(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteComment(id).catch(() => {});
    setComments((prev) => prev.filter((c) => c.id !== id).map((c) => ({
      ...c, replies: c.replies.filter((r) => r.id !== id)
    })));
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-bold text-ink-900 dark:text-white mb-5 flex items-center gap-2">
        <span className="text-2xl">💬</span> Коментарі ({comments.length})
      </h2>

      <div className="flex flex-col gap-5">
        <AnimatePresence>
          {comments.map((c) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <CommentItem comment={c} lessonId={lessonId} currentUserId={userId}
                onReply={(id) => setReplyTo(id === replyTo ? null : id)} onDelete={handleDelete} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className={cx('mt-6 p-4 rounded-2xl border', replyTo ? 'border-brand-200 dark:border-brand-700/50 bg-brand-50/40 dark:bg-brand-900/20' : 'border-ink-200 dark:border-[#2d3148] bg-white dark:bg-[#1e2033]')}>
        {replyTo && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-brand-600 font-medium">Відповідь на коментар</span>
            <button onClick={() => setReplyTo(null)} className="text-xs text-ink-400 hover:text-rose-500">✕</button>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Напишіть запитання або коментар…"
          rows={3}
          className="w-full resize-none text-sm bg-transparent focus:outline-none text-ink-700 placeholder:text-ink-300"
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={submit}
            disabled={loading || !text.trim()}
            className="btn btn-primary text-sm py-2 px-4 disabled:opacity-50"
          >
            {loading ? 'Надсилання…' : 'Надіслати'}
          </button>
        </div>
      </div>
    </div>
  );
}
