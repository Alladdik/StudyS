import * as React from 'react';
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { ScheduleEntry } from '../types';
import { cx } from './ui';

const DAYS_UA = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTHS_UA = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

interface Props {
  entries: ScheduleEntry[];
  currentMonth: { year: number; month: number };
  onMonthChange: (c: { year: number; month: number }) => void;
  onDayClick?: (date: Date) => void;
  onEventClick?: (entry: ScheduleEntry) => void;
  onEventDrop?: (entry: ScheduleEntry, newDate: Date) => void;
}

function getCourseColors(courseTitle: string) {
  let hash = 0;
  const title = courseTitle ?? 'Курс';
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    { bg: 'bg-violet-50 text-violet-700 border-violet-200/60 hover:bg-violet-100/70', dot: 'bg-violet-500' },
    { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 hover:bg-emerald-100/70', dot: 'bg-emerald-500' },
    { bg: 'bg-amber-50 text-amber-700 border-amber-200/60 hover:bg-amber-100/70', dot: 'bg-amber-500' },
    { bg: 'bg-rose-50 text-rose-700 border-rose-200/60 hover:bg-rose-100/70', dot: 'bg-rose-500' },
    { bg: 'bg-sky-50 text-sky-700 border-sky-200/60 hover:bg-sky-100/70', dot: 'bg-sky-500' },
    { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/60 hover:bg-indigo-100/70', dot: 'bg-indigo-500' },
    { bg: 'bg-teal-50 text-teal-700 border-teal-200/60 hover:bg-teal-100/70', dot: 'bg-teal-500' },
    { bg: 'bg-orange-50 text-orange-700 border-orange-200/60 hover:bg-orange-100/70', dot: 'bg-orange-500' }
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay + 6) % 7; // convert to Mon=0
  return { offset, daysInMonth };
}

export function CalendarView({ entries, currentMonth, onMonthChange, onDayClick, onEventClick, onEventDrop }: Props) {
  const today = new Date();
  const dragEntry = useRef<ScheduleEntry | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  const { offset, daysInMonth } = getMonthDays(currentMonth.year, currentMonth.month);

  const eventsByDay: Record<number, ScheduleEntry[]> = {};
  for (const e of entries) {
    const d = new Date(e.startsAt);
    if (d.getFullYear() === currentMonth.year && d.getMonth() === currentMonth.month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(e);
    }
  }

  function prev() {
    if (currentMonth.month === 0) {
      onMonthChange({ year: currentMonth.year - 1, month: 11 });
    } else {
      onMonthChange({ ...currentMonth, month: currentMonth.month - 1 });
    }
  }
  function next() {
    if (currentMonth.month === 11) {
      onMonthChange({ year: currentMonth.year + 1, month: 0 });
    } else {
      onMonthChange({ ...currentMonth, month: currentMonth.month + 1 });
    }
  }

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={prev} className="w-9 h-9 rounded-xl hover:bg-ink-100 dark:hover:bg-[#252840] flex items-center justify-center transition">
          <svg className="w-4 h-4 text-ink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-bold text-ink-900 dark:text-white text-lg">
          {MONTHS_UA[currentMonth.month]} {currentMonth.year}
        </span>
        <button onClick={next} className="w-9 h-9 rounded-xl hover:bg-ink-100 dark:hover:bg-[#252840] flex items-center justify-center transition">
          <svg className="w-4 h-4 text-ink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_UA.map((d) => (
          <div key={d} className="text-center text-xs font-bold text-ink-400 py-1">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, i) => {
          const isToday = day === today.getDate() && currentMonth.month === today.getMonth() && currentMonth.year === today.getFullYear();
          const events = day ? (eventsByDay[day] ?? []) : [];

          const handleDayClick = (e: React.MouseEvent) => {
            if (!day || !onDayClick) return;
            // Only trigger if clicking the cell itself, not event chips
            if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('day-num-label') || (e.target as HTMLElement).tagName === 'SPAN') {
              // Create date with noon to avoid timezone issues
              const clickedDate = new Date(currentMonth.year, currentMonth.month, day, 12, 0, 0);
              onDayClick(clickedDate);
            }
          };

          return (
            <motion.div key={i} whileHover={day ? { scale: 1.02 } : {}}
              onClick={handleDayClick}
              onDragOver={day ? (e) => { e.preventDefault(); if (dragOverDay !== day) setDragOverDay(day); } : undefined}
              onDragLeave={day ? () => setDragOverDay(d => d === day ? null : d) : undefined}
              onDrop={day && onEventDrop ? (e) => {
                e.preventDefault();
                setDragOverDay(null);
                if (dragEntry.current) {
                  const newDate = new Date(currentMonth.year, currentMonth.month, day,
                    new Date(dragEntry.current.startsAt).getHours(),
                    new Date(dragEntry.current.startsAt).getMinutes());
                  onEventDrop(dragEntry.current, newDate);
                  dragEntry.current = null;
                }
              } : undefined}
              className={cx(
                'min-h-[84px] rounded-xl p-1.5 border transition select-none flex flex-col justify-between group',
                day ? 'border-ink-100 dark:border-[#282c44] hover:border-brand-200 hover:bg-brand-50/20 dark:hover:bg-brand-900/10 cursor-pointer' : 'border-transparent',
                isToday && 'border-brand-400 bg-brand-50/50 dark:bg-brand-900/20 shadow-sm',
                dragOverDay === day && 'border-brand-400 bg-brand-100/40 dark:bg-brand-900/20 scale-[1.02]'
              )}
            >
              {day && (
                <>
                  <div className="flex justify-between items-center mb-1">
                    {onDayClick && (
                      <span className="text-[9px] font-extrabold text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        + Додати
                      </span>
                    )}
                    <span className={cx('day-num-label text-xs font-bold ml-auto',
                      isToday ? 'text-brand-600 bg-brand-100 dark:bg-brand-900/30 w-5 h-5 flex items-center justify-center rounded-full' : 'text-ink-600 dark:text-[#9aa2bd]')}>{day}</span>
                  </div>
                  <div className="flex-1 flex flex-col gap-1 justify-end">
                    {events.slice(0, 2).map((e, j) => {
                      const colors = getCourseColors(e.courseTitle);
                      return (
                        <div key={j}
                          draggable={!!onEventDrop}
                          onDragStart={() => { dragEntry.current = e; }}
                          onDragEnd={() => { dragEntry.current = null; setDragOverDay(null); }}
                          onClick={(evt) => {
                            evt.stopPropagation();
                            if (onEventClick) onEventClick(e);
                          }}
                          className={cx(
                            "text-[10px] border rounded-md px-1.5 py-0.5 truncate font-semibold transition cursor-pointer flex items-center gap-1",
                            colors.bg,
                            onEventDrop && "cursor-grab active:cursor-grabbing"
                          )}
                          title={`${e.courseTitle} · ${e.lessonTitle}`}
                        >
                          <span className={cx("w-1.5 h-1.5 rounded-full flex-shrink-0", colors.dot)} />
                          <span className="truncate">
                            <span className="font-extrabold">{e.courseTitle}:</span> {e.lessonTitle}
                          </span>
                        </div>
                      );
                    })}
                    {events.length > 2 && (
                      <div className="text-[9px] text-ink-500 dark:text-[#6b7394] font-bold bg-ink-100/60 dark:bg-[#252840]/60 rounded px-1 py-0.2 self-start">
                        +{events.length - 2} ще
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
