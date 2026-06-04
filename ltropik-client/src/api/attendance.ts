import api from './client';
import type { JournalEntry, AttendanceStatus } from '../types';

export const setAttendance = (data: {
  lessonId: string;
  lessonDate: string;
  records: { studentId: string; attendance: AttendanceStatus; gradeId?: string }[];
}) => api.post('/attendance', data);

export const bulkMarkPresent = (lessonId: string, lessonDate: string) =>
  api.post('/attendance/bulk-present', { lessonId, lessonDate });

export const getJournal = (courseId: string) =>
  api.get<JournalEntry[]>('/attendance/journal', { params: { courseId } });
