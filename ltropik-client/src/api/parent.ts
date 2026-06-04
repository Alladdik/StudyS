import api from './client';
import type { Course, JournalEntry, ScheduleEntry } from '../types';

export interface Child { id: string; firstName: string; lastName: string; email: string; }
export interface Transaction { id: string; amount: number; currency: string; status: string; createdAt: string; courseName?: string; }

export const getParentChildren = () => api.get<Child[]>('/parent/children');
export const getParentChildJournal = (studentId: string, courseId: string) =>
  api.get<JournalEntry[]>(`/parent/children/${studentId}/journal`, { params: { courseId } });
export const getParentChildCourses = (studentId: string) =>
  api.get<Course[]>(`/parent/children/${studentId}/courses`);
export const getParentChildBalance = (studentId: string) =>
  api.get<Transaction[]>(`/parent/children/${studentId}/balance`);
export const getParentChildUpcoming = (studentId: string) =>
  api.get<ScheduleEntry[]>(`/parent/children/${studentId}/upcoming`);
export const getChildrenForParent = (parentId: string) =>
  api.get<Child[]>('/parent/children', { params: { parentId } });
export const getParentChildHomeworks = (studentId: string) =>
  api.get<HomeworkItem[]>(`/parent/children/${studentId}/homeworks`);
export const linkParent = (parentId: string, studentId: string) =>
  api.post('/parent/link', { parentId, studentId });
export const unlinkParent = (parentId: string, studentId: string) =>
  api.delete(`/parent/link/${parentId}/${studentId}`);

// Matches C# HomeworkStatus enum values + 'NotSubmitted' for absent submission
export type HomeworkStatus =
  | 'NotSubmitted' | 'NotStarted' | 'InProgress'
  | 'OnReview' | 'RequiresChanges' | 'Passed';

export interface HomeworkItem {
  id: string;
  title: string;
  courseTitle: string;
  dueDate?: string;
  submittedAt?: string;
  status: HomeworkStatus;
  grade?: string;
}
