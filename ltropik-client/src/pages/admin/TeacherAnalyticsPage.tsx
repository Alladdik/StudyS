import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { getTeacherStats, type TeacherStat } from '../../api/analytics.ext';
import { Card, Avatar, Badge, Loader, EmptyState } from '../../components/ui';

export function TeacherAnalyticsPage() {
  const [stats, setStats] = useState<TeacherStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTeacherStats().then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Layout title="Аналітика викладачів"><Loader /></Layout>;

  return (
    <Layout title="Аналітика викладачів" subtitle="Ефективність та навантаження">
      {stats.length === 0 ? (
        <EmptyState icon="👩‍🏫" title="Викладачів немає" />
      ) : (
        <>
          {/* Podium top-3 */}
          {stats.length >= 3 && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[stats[1], stats[0], stats[2]].map((t, i) => {
                const medals = ['🥈', '🥇', '🥉'];
                const sizes  = ['pt-6', 'pt-0', 'pt-6'];
                return (
                  <Card key={t.id} className={`p-4 text-center flex flex-col items-center gap-2 ${sizes[i]}`}>
                    <span className="text-2xl">{medals[i]}</span>
                    <Avatar name={t.name} size="md" />
                    <p className="font-extrabold text-ink-900 dark:text-white text-sm leading-tight">{t.name}</p>
                    <p className="text-xs text-ink-400">{t.studentCount} студентів</p>
                  </Card>
                );
              })}
            </div>
          )}

          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 dark:border-[#1c3a2a]">
                  {['#', "Ім'я", 'Курсів', 'Студентів', 'Перевірено ДЗ', 'На черзі ДЗ'].map(h => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-bold text-ink-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((t, i) => (
                  <tr key={t.id} className="border-b border-ink-50 dark:border-[#102a1d] last:border-0 hover:bg-ink-50/60 dark:hover:bg-[#102a1d]/60 transition">
                    <td className="px-5 py-3.5 font-bold text-ink-400">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={t.name} size="sm" />
                        <div>
                          <p className="font-semibold text-ink-800 dark:text-[#e8eaf0]">{t.name}</p>
                          <p className="text-xs text-ink-400">{t.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone="blue">{t.courseCount}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone="green">{t.studentCount}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone="brand">{t.reviewedHw}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={t.pendingHw > 10 ? 'rose' : t.pendingHw > 0 ? 'amber' : 'gray'}>
                        {t.pendingHw}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </Layout>
  );
}
