import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import api from '../api/client';

interface TrendPoint {
  date: string;
  grade: string;
  isPassing: boolean;
  courseTitle: string;
}

interface Props { studentId: string; days?: number; }

const COLORS = ['#6535f6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

// Convert grade string to numeric (A→95, B→80, etc.)
function gradeToNum(g: string): number | null {
  const n = parseInt(g, 10);
  if (!isNaN(n)) return n;
  const map: Record<string, number> = {
    A: 95, 'A+': 100, 'A-': 90,
    B: 80, 'B+': 87, 'B-': 73,
    C: 65, 'C+': 72, 'C-': 58,
    D: 50, F: 30,
    Зараховано: 100, Незараховано: 0,
    Відмінно: 95, Добре: 80, Задовільно: 60, Незадовільно: 30,
  };
  return map[g] ?? null;
}

export function GradeTrends({ studentId, days = 90 }: Props) {
  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    api.get<TrendPoint[]>(`/gradebook/trends/${studentId}`, { params: { days } })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [studentId, days]);

  if (loading) return <div className="h-40 animate-pulse bg-ink-50 rounded-2xl" />;
  if (data.length === 0) return (
    <div className="text-center text-ink-400 text-sm py-8">Оцінок ще немає</div>
  );

  // Group by course, build chart data
  const courses = [...new Set(data.map(d => d.courseTitle))];

  const byDate = data.reduce<Record<string, Record<string, number | null>>>((acc, d) => {
    const dateStr = new Date(d.date).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
    if (!acc[dateStr]) acc[dateStr] = {};
    acc[dateStr][d.courseTitle] = gradeToNum(d.grade);
    return acc;
  }, {});

  const chartData = Object.entries(byDate)
    .map(([date, vals]) => ({ date, ...vals }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
            formatter={(v) => [`${v} балів`]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {courses.map((course, i) => (
            <Line
              key={course}
              type="monotone"
              dataKey={course}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4, fill: COLORS[i % COLORS.length] }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
