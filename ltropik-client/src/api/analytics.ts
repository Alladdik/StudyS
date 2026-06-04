import api from './client';

export const getAnalyticsSummary = () =>
  api.get<{
    totalStudents: number;
    totalTeachers: number;
    totalCourses: number;
    totalRevenue: number;
    thisMonthRevenue: number;
    pendingHw: number;
  }>('/analytics/summary');

export const getRevenue = (months = 6) =>
  api.get<{ month: string; revenue: number; count: number }[]>('/analytics/revenue', { params: { months } });

export const getActivity = (days = 30) =>
  api.get<{ date: string; submissions: number; tests: number }[]>('/analytics/activity', { params: { days } });

export const getCourseStats = () =>
  api.get<{ id: string; title: string; students: number; lessons: number; revenue: number }[]>('/analytics/courses');

export const getChurnRisk = () =>
  api.get<{ id: string; name: string; email: string; lastActivity: string; hwPending: number; riskLevel: string }[]>(
    '/analytics/churn-risk',
  );
