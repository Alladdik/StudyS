import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { AiMentorChat } from '../../components/AiMentorChat';
import { submitHomework } from '../../api/homeworks';
import api from '../../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Badge, Loader, EmptyState, Spinner, toast } from '../../components/ui';
import { Confetti } from '../../components/Confetti';

interface HomeworkDetail {
  id: string; lessonId: string; instruction: string;
  existingSubmission?: {
    id: string; status: string; submissionData?: string;
    teacherFeedback?: string; aiFeedbackDraft?: string; gradeValue?: string;
  };
}

export function HomeworkPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const courseId = params.get('courseId') ?? '';
  const navigate = useNavigate();

  const [hw, setHw] = useState<HomeworkDetail | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // AI Co-pilot states
  const [aiTutorFeedback, setAiTutorFeedback] = useState('');
  const [fetchingTutorHint, setFetchingTutorHint] = useState(false);

  // Confetti state
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<HomeworkDetail>(`/homeworks/${id}/detail`).then((r) => {
      setHw(r.data);
      if (r.data.existingSubmission?.submissionData) setAnswer(r.data.existingSubmission.submissionData);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit() {
    if (!id || !answer.trim()) return;
    setSubmitting(true);
    try { 
      await submitHomework(id, answer); 
      setSubmitted(true); 
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4500);
    } finally { 
      setSubmitting(false); 
    }
  }

  async function handleGetTutorHint() {
    if (!courseId || !hw) return;
    setFetchingTutorHint(true);
    setAiTutorFeedback('');
    try {
      const q = `Привіт! Я виконую домашнє завдання з наступною умовою: "${hw.instruction}". Мій поточний варіант відповіді: "${answer || '(порожньо)'}". Будь ласка, надай мені коротку корисну підказку (не більше 2-3 речень), яка допоможе мені покращити мою відповідь, але в жодному разі не пиши готового розв'язку. Відповідай українською мовою.`;
      const r = await api.post<{ response: string }>(`/ai/tutor/${courseId}`, {
        question: q,
        history: []
      });
      setAiTutorFeedback(r.data.response);
    } catch (err) {
      console.error(err);
      toast('error', 'Не вдалося отримати підказку від AI-Асистента.');
    } finally {
      setFetchingTutorHint(false);
    }
  }

  if (loading) return <Layout><Loader /></Layout>;
  if (!hw) return <Layout><EmptyState title="Завдання не знайдено" /></Layout>;

  const existing = hw.existingSubmission;
  const isPassed = existing?.status === 'Passed';
  const isOnReview = existing?.status === 'OnReview';
  const statusCfg = isPassed ? { tone: 'green' as const, label: '✓ Зараховано' }
    : isOnReview ? { tone: 'amber' as const, label: '⏳ На перевірці' }
    : existing?.status === 'RequiresChanges' ? { tone: 'rose' as const, label: '✎ Потрібні правки' } : null;

  return (
    <Layout>
      {showConfetti && <Confetti />}

      <div className="max-w-2xl mx-auto pb-32">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="btn btn-ghost w-9 h-9 px-0 rounded-xl">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-white">Домашнє завдання</h1>
          {statusCfg && <Badge tone={statusCfg.tone} className="ml-auto">{statusCfg.label}</Badge>}
        </div>

        <Card className="p-6 mb-4">
          <p className="label flex items-center gap-2"><span>📋</span> Умова завдання</p>
          <div className="text-ink-700 leading-relaxed whitespace-pre-wrap text-sm">{hw.instruction}</div>
        </Card>

        {existing?.teacherFeedback && (
          <Card className="p-5 mb-4 !bg-emerald-50/60 !border-emerald-100">
            <p className="font-bold text-emerald-700 mb-2 flex items-center gap-2 text-sm">
              <span>👨‍🏫</span> Фідбек викладача
              {existing.gradeValue && <Badge tone="brand" className="ml-auto">{existing.gradeValue}</Badge>}
            </p>
            <p className="text-emerald-800/80 whitespace-pre-wrap text-sm">{existing.teacherFeedback}</p>
          </Card>
        )}

        {existing?.status === 'RequiresChanges' && existing.aiFeedbackDraft && (
          <Card className="p-5 mb-4 !bg-amber-50/60 !border-amber-100">
            <p className="font-bold text-amber-700 mb-2 flex items-center gap-2 text-sm"><span>🤖</span> Рецензія AI</p>
            <p className="text-amber-800/80 whitespace-pre-wrap text-sm">{existing.aiFeedbackDraft}</p>
          </Card>
        )}

        {/* Dynamic AI Tutor Hint Card */}
        {aiTutorFeedback && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-5 mb-4 !bg-brand-50/60 !border-brand-100 shadow-sm relative overflow-hidden">
              <p className="font-bold text-brand-700 mb-2 flex items-center gap-2 text-sm">
                <span>🤖</span> Підказка AI-Співпілота
              </p>
              <p className="text-brand-900 whitespace-pre-wrap text-sm leading-relaxed">{aiTutorFeedback}</p>
            </Card>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div key="ok" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="p-10 text-center !bg-brand-50/60 !border-brand-100">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }} className="text-5xl mb-3">🚀</motion.div>
                <h3 className="font-extrabold text-brand-700 text-lg mb-1">Завдання здано!</h3>
                <p className="text-ink-500 text-sm mb-5">Викладач перевірить найближчим часом. Ти отримаєш сповіщення в Telegram.</p>
                <button onClick={() => navigate(-1)} className="btn btn-primary">Назад до уроку</button>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="p-6">
                <p className="label flex items-center gap-2">
                  <span>✍️</span> {existing?.status === 'RequiresChanges' ? 'Виправ відповідь' : 'Твоя відповідь'}
                </p>
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Введи відповідь, посилання на репозиторій або опис рішення…"
                  disabled={isPassed || isOnReview}
                  className="input min-h-40 resize-none disabled:opacity-50 disabled:bg-ink-50 dark:disabled:bg-[#1e2033]" />
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-ink-400">{answer.length} символів</p>
                    {courseId && !isPassed && !isOnReview && (
                      <button 
                        onClick={handleGetTutorHint} 
                        disabled={fetchingTutorHint}
                        className="btn btn-ghost py-1 px-2.5 text-xs text-brand-600 hover:bg-brand-50 flex items-center gap-1">
                        {fetchingTutorHint ? <><Spinner className="w-3 h-3 text-brand-600" /> Отримую...</> : <>🤖 Підказка AI</>}
                      </button>
                    )}
                  </div>
                  {!isPassed && !isOnReview && (
                    <button onClick={handleSubmit} disabled={submitting || !answer.trim()} className="btn btn-primary">
                      {submitting ? <><Spinner className="w-4 h-4" /> Надсилаю…</> : <>🚀 Здати завдання</>}
                    </button>
                  )}
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {courseId && <AiMentorChat courseId={courseId} maxMessages={20} />}
    </Layout>
  );
}
