import api from './client';

export interface TeacherStat {
  id: string;
  name: string;
  email: string;
  courseCount: number;
  studentCount: number;
  reviewedHw: number;
  pendingHw: number;
}

export interface HeatmapDay {
  date: string;
  present: number;
  absent: number;
}

export const getTeacherStats     = () => api.get<TeacherStat[]>('/analytics/teachers');
export const getAttendanceHeatmap = (studentId: string, days = 365) =>
  api.get<HeatmapDay[]>('/analytics/heatmap', { params: { studentId, days } });
