import api from './client';
import type { ScheduleEntry } from '../types';

export const getSchedule = (from?: string, to?: string) =>
  api.get<ScheduleEntry[]>('/schedule', { params: { from, to } });

export const createSchedule = (data: {
  lessonId: string;
  startsAt: string;
  durationMinutes: number;
  notes?: string;
  teacherId?: string;
}) => api.post('/schedule', data);

export const updateSchedule = (id: string, data: { startsAt?: string; durationMinutes?: number; notes?: string; teacherId?: string }) =>
  api.put(`/schedule/${id}`, data);

export const deleteSchedule = (id: string) => api.delete(`/schedule/${id}`);
