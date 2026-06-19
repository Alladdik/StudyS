import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';

const KEY = 'ltropik-onboarding-done';

const STEPS: Record<string, { emoji: string; title: string; text: string; action?: string; href?: string }[]> = {
  Student: [
    { emoji: '👋', title: 'Ласкаво просимо до LTropik!', text: 'Ти потрапив у найкрутішу онлайн-школу. Давай разом познайомимось з твоїм кабінетом!' },
    { emoji: '📅', title: 'Щоденник', text: 'Тут ти бачиш відвідуваність та оцінки. Записуй нотатки прямо в уроці — вони зберігаються тільки для тебе.', href: '/student/diary' },
    { emoji: '📚', title: 'Мої курси', text: 'Всі твої курси тут. У кожному уроці є матеріали, тести та домашні завдання.', href: '/student/courses' },
    { emoji: '🏆', title: 'Досягнення', text: 'Виконуй щоденні квести, збирай бейджі та монети. Витрачай монети в магазині!', href: '/student/achievements' },
    { emoji: '🚀', title: 'Все готово!', text: 'Ти можеш починати навчання. Натисни Ctrl+K у будь-який момент щоб швидко знайти курс або урок.' },
  ],
  Teacher: [
    { emoji: '👋', title: 'Вітаємо, викладачу!', text: 'Розберемось з основними інструментами вашого кабінету.' },
    { emoji: '📋', title: 'Журнал', text: 'Відмічайте відвідуваність та виставляйте оцінки. Одним кліком — для всіх студентів одразу.', href: '/teacher/journal' },
    { emoji: '✅', title: 'Перевірка домашніх завдань', text: 'Тут відображаються всі надіслані ДЗ. AI вже перевірив їх першим — ваш вердикт фінальний.', href: '/teacher/review' },
    { emoji: '⬇️', title: 'Експорт', text: 'У журналі оцінок натисніть "Завантажити Excel" щоб отримати повний звіт.', href: '/teacher/gradebook' },
    { emoji: '🚀', title: 'Все готово!', text: 'Ваш кабінет налаштовано. Натисніть Ctrl+K щоб швидко знаходити студентів та курси.' },
  ],
  Admin: [
    { emoji: '👋', title: 'Панель адміністратора', text: 'Ви маєте повний контроль над платформою.' },
    { emoji: '👥', title: 'Управління користувачами', text: 'Додавайте та редагуйте учасників. Переходьте в кабінет будь-якого користувача через "Переглянути як".', href: '/admin/users' },
    { emoji: '📊', title: 'Аналітика', text: 'Відстежуйте доходи, відтік і активність у реальному часі.', href: '/admin/analytics' },
    { emoji: '📋', title: 'Журнал дій', text: 'Хто, що і коли зробив — повна прозорість у системі.', href: '/admin/audit-logs' },
    { emoji: '🖥️', title: 'Health Dashboard', text: 'Перевіряйте стан БД, Redis та серверу в реальному часі.', href: '/admin/system' },
    { emoji: '🚀', title: 'Все готово!', text: 'Ваша платформа готова до роботи. Натисніть Ctrl+K щоб шукати по всій системі.' },
  ],
  Parent: [
    { emoji: '👋', title: 'Батьківський кабінет', text: 'Слідкуйте за успіхами своїх дітей.' },
    { emoji: '📊', title: 'Журнал', text: 'Переглядайте оцінки та відвідуваність дітей в реальному часі.', href: '/parent/dashboard' },
    { emoji: '🚀', title: 'Все готово!', text: 'Ваш кабінет активовано.' },
  ],
};

export function Onboarding() {
  const { role } = useAuthStore();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(KEY);
    if (!done && role) {
      // Small delay so the page renders first
      setTimeout(() => setVisible(true), 600);
    }
  }, [role]);

  const steps = STEPS[role ?? ''] ?? STEPS['Student'];
  const current = steps[step];

  function close() {
    localStorage.setItem(KEY, '1');
    setVisible(false);
  }

  function next() {
    if (step < steps.length - 1) {
      if (current.href) navigate(current.href);
      setStep(s => s + 1);
    } else {
      if (current.href) navigate(current.href);
      close();
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[998] flex items-end sm:items-center justify-center p-4 bg-ink-900/40 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="w-full max-w-sm bg-white dark:bg-[#0e2218] rounded-3xl shadow-2xl border border-ink-100 dark:border-[#1c3a2a] p-7"
          >
            {/* Progress dots */}
            <div className="flex gap-1.5 justify-center mb-6">
              {steps.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-5 bg-brand-600' : i < step ? 'w-2 bg-brand-300' : 'w-2 bg-ink-200 dark:bg-[#1c3a2a]'
                }`} />
              ))}
            </div>

            <div className="text-center">
              <div className="text-5xl mb-4">{current.emoji}</div>
              <h2 className="text-xl font-extrabold text-ink-900 dark:text-white mb-3">{current.title}</h2>
              <p className="text-sm text-ink-500 dark:text-[#8891b0] leading-relaxed mb-7">{current.text}</p>
            </div>

            <div className="flex gap-2">
              <button onClick={close} className="btn btn-ghost flex-1 py-2.5 text-sm">
                Пропустити
              </button>
              <button onClick={next} className="btn btn-primary flex-1 py-2.5 text-sm">
                {step < steps.length - 1 ? 'Далі →' : '🎉 Почати!'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
