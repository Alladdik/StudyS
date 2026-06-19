import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../api/client';
import { cx } from '../components/ui';
import { PublicNav, PublicFooter, PublicPage, Stars } from '../components/PublicChrome';

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

type SortKey = 'popular' | 'newest' | 'rating';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: 'Популярні' },
  { key: 'newest',  label: 'Нові' },
  { key: 'rating',  label: 'За рейтингом' },
];

export function PublicCoursesPage() {
  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('popular');

  useEffect(() => {
    api.get<PublicCourse[]>('/courses/public')
      .then(r => setCourses(r.data))
      .catch(() => setCourses([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? courses.filter(c =>
          c.title.toLowerCase().includes(q) ||
          (c.description?.toLowerCase().includes(q) ?? false))
      : courses;

    const sorted = [...filtered];
    if (sort === 'popular') sorted.sort((a, b) => b.studentCount - a.studentCount);
    if (sort === 'newest')  sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (sort === 'rating')  sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return sorted;
  }, [courses, query, sort]);

  return (
    <PublicPage>
      <PublicNav />

      {/* Header */}
      <section className="max-w-6xl mx-auto px-6 pt-12 pb-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-ink-900 dark:text-white tracking-tight">Каталог курсів</h1>
        <p className="text-ink-500 dark:text-[#9aa2bd] text-lg mt-3 max-w-2xl mx-auto">
          Оберіть програму, яка підходить саме вам — від основ до просунутого рівня.
        </p>
      </section>

      {/* Search + sort toolbar */}
      <section className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400 dark:text-[#4d5470] pointer-events-none">🔍</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Пошук курсів…"
              className="input"
              style={{ paddingLeft: '2.75rem' }}
            />
          </div>
          <div className="inline-flex p-1 bg-ink-100 dark:bg-[#102a1d] rounded-2xl gap-1 self-start sm:self-auto">
            {SORTS.map(s => (
              <button key={s.key} onClick={() => setSort(s.key)}
                className={cx('px-3.5 py-2 rounded-xl text-sm font-semibold transition',
                  sort === s.key
                    ? 'bg-white dark:bg-[#163a28] text-brand-700 dark:text-brand-400 shadow-sm'
                    : 'text-ink-500 dark:text-[#6b7394] hover:text-ink-700 dark:hover:text-[#e8eaf0]')}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grid */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-52 rounded-2xl skeleton" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="card p-16 text-center text-ink-400 dark:text-[#6b7394]">
            {query ? `За запитом «${query}» нічого не знайдено` : 'Курси скоро з’являться'}
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-400 dark:text-[#6b7394] mb-4">Знайдено курсів: <strong className="text-ink-700 dark:text-[#e8eaf0]">{visible.length}</strong></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((c, i) => (
                <motion.div key={c.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * .03, .3) }}>
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
          </>
        )}
      </main>

      <PublicFooter />
    </PublicPage>
  );
}
