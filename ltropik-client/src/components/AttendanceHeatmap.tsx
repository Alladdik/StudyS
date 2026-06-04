import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getAttendanceHeatmap, type HeatmapDay } from '../api/analytics.ext';
import { cx } from './ui';

interface Props { studentId: string; }

const MONTHS_UA = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];
const DAYS_UA   = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const CELL_PX = 14; // rendered cell + gap width

function cellColor(day: HeatmapDay | undefined): string {
  if (!day) return 'bg-ink-100 dark:bg-ink-700';
  if (day.absent > 0 && day.present === 0) return 'bg-rose-400';
  if (day.absent > 0) return 'bg-amber-400';
  if (day.present > 0) return 'bg-emerald-500';
  return 'bg-ink-100 dark:bg-ink-700';
}

function fmtDate(ds: string) {
  return new Date(ds).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export function AttendanceHeatmap({ studentId }: Props) {
  const [data, setData] = useState<HeatmapDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    getAttendanceHeatmap(studentId, 365)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div className="h-24 animate-pulse bg-ink-50 rounded-xl" />;

  const byDate = Object.fromEntries(data.map(d => [d.date, d]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endSunday = new Date(today);
  endSunday.setDate(today.getDate() + (6 - today.getDay()));

  const startDate = new Date(endSunday);
  startDate.setDate(endSunday.getDate() - 52 * 7 + 1);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // align to Sunday

  const weeks: Date[][] = [];
  const cur = new Date(startDate);
  while (cur <= endSunday) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) { week.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(week);
  }

  const monthLabels: { label: string; col: number }[] = [];
  weeks.forEach((week, wi) => {
    if (week[0].getDate() <= 7)
      monthLabels.push({ label: MONTHS_UA[week[0].getMonth()], col: wi });
  });

  const todayStr = today.toISOString().slice(0, 10);

  function showTip(e: React.MouseEvent, ds: string, hd?: HeatmapDay) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let text = fmtDate(ds);
    if (hd) {
      if (hd.present > 0) text += ` · ✓ ${hd.present}`;
      if (hd.absent  > 0) text += ` · ✗ ${hd.absent}`;
    }
    setTip({ text, x: r.left + r.width / 2, y: r.top - 6 });
  }

  return (
    <div onMouseLeave={() => setTip(null)}>
      <div className="overflow-x-auto">
        {/* Month labels row */}
        <div className="relative h-4 mb-1" style={{ paddingLeft: 28 }}>
          {monthLabels.map((m, i) => (
            <span
              key={i}
              className="absolute text-[10px] text-ink-400 font-medium select-none"
              style={{ left: 28 + m.col * CELL_PX }}
            >
              {m.label}
            </span>
          ))}
        </div>

        <div className="flex" style={{ gap: 4 }}>
          {/* Day-of-week labels */}
          <div className="flex flex-col flex-shrink-0" style={{ gap: 2, width: 24 }}>
            {DAYS_UA.map((d, i) => (
              <div
                key={d}
                className="text-[9px] text-ink-400 text-right pr-1 select-none"
                style={{ height: CELL_PX, lineHeight: `${CELL_PX}px`, opacity: i % 2 === 0 ? 0 : 1 }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Cell grid */}
          <div className="flex" style={{ gap: 2 }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: 2 }}>
                {week.map((day, di) => {
                  const ds = day.toISOString().slice(0, 10);
                  const hd = byDate[ds];
                  const isToday  = ds === todayStr;
                  const isFuture = day > today;
                  const color = isFuture ? 'bg-ink-50 dark:bg-ink-800' : cellColor(hd);

                  return (
                    <div
                      key={di}
                      className={cx(
                        'rounded-sm transition-transform cursor-default',
                        color,
                        isToday  && 'ring-2 ring-brand-500 ring-offset-1',
                        isFuture ? 'opacity-30' : 'hover:scale-[1.4] hover:z-10',
                      )}
                      style={{ width: CELL_PX - 2, height: CELL_PX - 2 }}
                      onMouseEnter={e => !isFuture && showTip(e, ds, hd)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-ink-500 flex-wrap">
          {[
            { color: 'bg-ink-100 dark:bg-ink-700', label: 'Немає уроку' },
            { color: 'bg-emerald-500',              label: 'Присутній'   },
            { color: 'bg-amber-400',                label: 'Змішано'     },
            { color: 'bg-rose-400',                 label: 'Відсутній'   },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={cx('rounded-sm flex-shrink-0', color)} style={{ width: 12, height: 12 }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Portal tooltip */}
      {tip && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] bg-ink-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap"
          style={{ left: tip.x, top: tip.y, transform: 'translate(-50%, -100%)' }}
        >
          {tip.text}
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[-4px] w-2 h-2 bg-ink-900 rotate-45" />
        </div>,
        document.body
      )}
    </div>
  );
}
