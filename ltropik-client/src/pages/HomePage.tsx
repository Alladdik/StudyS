import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import { PublicNav, PublicFooter, PublicPage, Stars, dashboardPath } from '../components/PublicChrome';

interface PublicCourse {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  lessonCount: number;
  studentCount: number;
  rating?: number | null;
  reviewCount: number;
}

const FEATURES = [
  { icon: '🎬', title: 'Інтерактивні уроки', text: 'Відео, аудіо, код та тести — усе в одному уроці, доступно з будь-якого пристрою.' },
  { icon: '📝', title: 'Тести й флешкартки', text: 'Інтерактивні тести та картки для закріплення знань з миттєвою перевіркою.' },
  { icon: '🏆', title: 'Гейміфікація', text: 'Бейджі, стріки, рейтинги й магазин нагород перетворюють навчання на гру.' },
  { icon: '🎥', title: 'Живі заняття', text: 'Відеокімнати з дошкою та чатом для зв’язку з викладачем у реальному часі.' },
  { icon: '📊', title: 'Прозорий прогрес', text: 'Щоденник, журнал оцінок і аналітика — видно зростання на кожному кроці.' },
  { icon: '👨‍👩‍👧', title: 'Для всієї родини', text: 'Окремі кабінети для учня, викладача та батьків — кожен бачить своє.' },
];

const STEPS = [
  { n: '01', title: 'Оберіть курс', text: 'Перегляньте каталог і знайдіть програму під свою мету.' },
  { n: '02', title: 'Зареєструйтесь', text: 'Створіть акаунт за хвилину та залиште заявку на курс.' },
  { n: '03', title: 'Навчайтесь', text: 'Проходьте уроки, виконуйте завдання й отримуйте зворотний зв’язок.' },
];

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n);
}

export function HomePage() {
  const { token, role } = useAuthStore();
  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PublicCourse[]>('/courses/public')
      .then(r => setCourses(r.data))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  const totalStudents = courses.reduce((s, c) => s + c.studentCount, 0);
  const totalLessons = courses.reduce((s, c) => s + c.lessonCount, 0);
  const featured = courses.slice(0, 6);

  const stats = [
    { label: 'Курсів', value: courses.length },
    { label: 'Учнів', value: totalStudents },
    { label: 'Уроків', value: totalLessons },
  ];

  return (
    <PublicPage>
      <PublicNav />

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-mint-400/25 dark:bg-mint-600/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-brand-300/30 dark:bg-brand-800/25 blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
          <motion.span
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-white dark:bg-[#0e2218] border border-ink-100 dark:border-[#1c3a2a] rounded-full px-4 py-1.5 text-sm font-semibold text-brand-600 dark:text-brand-400 shadow-sm mb-6">
            ✨ Онлайн-школа нового покоління
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 }}
            className="text-4xl sm:text-6xl font-extrabold text-ink-900 dark:text-white leading-[1.08] tracking-tight max-w-3xl mx-auto">
            Навчання, яке <span className="text-brand-600 dark:text-brand-400">надихає</span> досягати більшого
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}
            className="text-ink-500 dark:text-[#9aa2bd] text-lg sm:text-xl mt-6 max-w-2xl mx-auto leading-relaxed">
            Інтерактивні курси з живими заняттями, тестами та гейміфікацією.
            Обирайте програму й починайте вчитися вже сьогодні.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18 }}
            className="flex flex-wrap items-center justify-center gap-3 mt-9">
            <Link to="/courses" className="btn btn-primary text-base px-7 py-3.5">
              Переглянути курси →
            </Link>
            {token ? (
              <Link to={dashboardPath(role)} className="btn btn-ghost text-base px-7 py-3.5">
                Мій кабінет
              </Link>
            ) : (
              <Link to="/register" className="btn btn-ghost text-base px-7 py-3.5">
                Зареєструватись безкоштовно
              </Link>
            )}
          </motion.div>
        </div>

        {/* Stats band */}
        <div className="relative max-w-3xl mx-auto px-6 pb-4">
          <div className="grid grid-cols-3 gap-4 bg-white/70 dark:bg-[#0e2218]/70 backdrop-blur border border-ink-100 dark:border-[#1c3a2a] rounded-3xl py-6 shadow-sm">
            {stats.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-extrabold text-ink-900 dark:text-white">
                  {loading ? '—' : `${fmt(s.value)}+`}
                </p>
                <p className="text-sm text-ink-400 dark:text-[#6b7394] font-medium mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-ink-900 dark:text-white tracking-tight">Чому LTropik</h2>
          <p className="text-ink-500 dark:text-[#6b7394] mt-2">Усе для ефективного навчання — в одній платформі</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: i * .04 }}
              className="card card-hover p-6">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-2xl mb-4">{f.icon}</div>
              <h3 className="font-extrabold text-ink-900 dark:text-white text-lg">{f.title}</h3>
              <p className="text-ink-500 dark:text-[#9aa2bd] text-sm mt-1.5 leading-relaxed">{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Popular courses ──────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-3xl font-extrabold text-ink-900 dark:text-white tracking-tight">Популярні курси</h2>
            <p className="text-ink-500 dark:text-[#6b7394] mt-2">Обирайте серед найкращих програм нашої школи</p>
          </div>
          <Link to="/courses" className="hidden sm:inline-flex text-sm font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 transition">
            Усі курси →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-52 rounded-2xl skeleton" />)}
          </div>
        ) : featured.length === 0 ? (
          <div className="card p-12 text-center text-ink-400 dark:text-[#6b7394]">Курси скоро з’являться — слідкуйте за оновленнями</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((c, i) => (
              <motion.div key={c.id}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: i * .04 }}>
                <Link to={`/courses/${c.id}`}
                  className="group card-glass p-5 flex flex-col gap-3 h-full">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-mint-500 to-brand-700 flex items-center justify-center text-forest-950 font-extrabold text-lg shadow-[0_0_16px_rgba(0,230,118,.35)]">
                    {c.title[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-ink-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">{c.title}</h3>
                    {c.description && <p className="text-sm text-ink-500 dark:text-[#9aa2bd] mt-1 line-clamp-2">{c.description}</p>}
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-400 dark:text-[#6b7394] mt-auto pt-1">
                    <span>📖 {c.lessonCount} уроків</span>
                    <span>👤 {c.studentCount} учнів</span>
                  </div>
                  <Stars rating={c.rating} />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-ink-900 dark:text-white tracking-tight">Як це працює</h2>
          <p className="text-ink-500 dark:text-[#6b7394] mt-2">Три кроки до старту навчання</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map(s => (
            <div key={s.n} className="card p-6">
              <span className="text-4xl font-extrabold text-brand-200 dark:text-brand-900/60">{s.n}</span>
              <h3 className="font-extrabold text-ink-900 dark:text-white text-lg mt-2">{s.title}</h3>
              <p className="text-ink-500 dark:text-[#9aa2bd] text-sm mt-1.5 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pb-8">
        <div className="relative overflow-hidden rounded-3xl px-8 py-14 text-center"
          style={{ background: 'linear-gradient(135deg, #0a1912 0%, #0b6f43 55%, #00c853 100%)' }}>
          <div className="absolute -top-20 -right-10 w-72 h-72 rounded-full bg-mint-500/25 blur-3xl" />
          <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-mint-400/15 blur-3xl" />
          <h2 className="relative text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Готові почати навчання?</h2>
          <p className="relative text-white/80 mt-3 max-w-xl mx-auto">
            Приєднуйтесь до LTropik і відкрийте доступ до інтерактивних курсів уже сьогодні.
          </p>
          <div className="relative flex flex-wrap items-center justify-center gap-3 mt-8">
            <Link to="/register" className="bg-white text-brand-700 font-bold px-7 py-3.5 rounded-2xl hover:bg-ink-50 transition">
              Створити акаунт
            </Link>
            <Link to="/courses" className="bg-white/15 border border-white/25 text-white font-bold px-7 py-3.5 rounded-2xl hover:bg-white/25 transition">
              Каталог курсів
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </PublicPage>
  );
}
