import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { cx } from '../components/ui';

interface PublicCourse {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  lessonCount: number;
  studentCount: number;
  rating?: number;
  reviewCount: number;
}

function Stars({ rating }: { rating?: number }) {
  if (!rating) return <span className="text-xs text-ink-300">Без оцінок</span>;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={cx('text-sm', i <= Math.round(rating) ? 'text-amber-400' : 'text-ink-200')}>★</span>
      ))}
      <span className="text-xs text-ink-500 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

export function PublicCoursesPage() {
  const [courses, setCourses] = useState<PublicCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail]     = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.get<PublicCourse[]>('/courses/public')
      .then(r => setCourses(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-ink-50">
      {/* Hero */}
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg">
            <span className="text-white font-extrabold text-lg">L</span>
          </div>
          <span className="font-extrabold text-ink-900 text-xl tracking-tight">LTropik</span>
        </div>
        <Link to="/login" className="btn btn-primary text-sm px-5 py-2">Увійти</Link>
      </header>

      <section className="text-center px-6 py-16 max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-ink-900 leading-tight mb-4">
          Навчання нового <span className="text-brand-600">покоління</span>
        </h1>
        <p className="text-ink-500 text-lg mb-8">
          Онлайн-школа з AI-ментором, гейміфікацією та живим зв'язком з викладачем
        </p>

        {/* Lead form */}
        {submitted ? (
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-6 py-3 text-emerald-700 font-semibold">
            ✅ Дякуємо! Ми зв'яжемося з вами
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); if (email) setSubmitted(true); }}
            className="flex gap-2 max-w-md mx-auto">
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Ваш email…"
              className="flex-1 px-4 py-3 rounded-2xl border border-ink-200 outline-none focus:ring-2 focus:ring-brand-300 text-sm" />
            <button type="submit"
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-5 py-3 rounded-2xl transition text-sm flex-shrink-0">
              Залишити заявку
            </button>
          </form>
        )}
      </section>

      {/* Stats */}
      <section className="flex flex-wrap justify-center gap-8 py-8 bg-white/60 dark:bg-[#1a1c2e]/60 backdrop-blur border-y border-ink-100 dark:border-[#282c44]">
        {[
          { label: 'Курсів', value: courses.length },
          { label: 'Студентів', value: courses.reduce((s, c) => s + c.studentCount, 0) },
          { label: 'Уроків', value: courses.reduce((s, c) => s + c.lessonCount, 0) },
        ].map(s => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-extrabold text-ink-900">{s.value}+</p>
            <p className="text-sm text-ink-400 font-medium">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Courses grid */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-extrabold text-ink-900 mb-6">Доступні курси</h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-48 rounded-2xl bg-ink-100 animate-pulse" />)}
          </div>
        ) : courses.length === 0 ? (
          <p className="text-center text-ink-400 py-12">Курсів поки немає</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(c => (
              <Link key={c.id} to={`/courses/${c.id}`}
                className="group bg-white dark:bg-[#1a1c2e] rounded-2xl border border-ink-100 dark:border-[#282c44] p-5 hover:shadow-lg dark:hover:shadow-black/30 hover:border-brand-200 dark:hover:border-brand-700 transition flex flex-col gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-extrabold text-lg">
                  {c.title[0]}
                </div>
                <div>
                  <h3 className="font-extrabold text-ink-900 group-hover:text-brand-600 transition">{c.title}</h3>
                  {c.description && <p className="text-sm text-ink-400 mt-1 line-clamp-2">{c.description}</p>}
                </div>
                <div className="flex items-center justify-between text-xs text-ink-400 mt-auto">
                  <span>📖 {c.lessonCount} уроків</span>
                  <span>👤 {c.studentCount} студентів</span>
                </div>
                <Stars rating={c.rating} />
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-ink-400 border-t border-ink-100">
        © {new Date().getFullYear()} LTropik · Онлайн-школа
      </footer>
    </div>
  );
}
