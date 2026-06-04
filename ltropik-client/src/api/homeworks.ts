import api from './client';
import type { HomeworkSubmission, HomeworkStatus } from '../types';

export const submitHomework = (homeworkId: string, submissionData: string) =>
  api.post<{ submissionId: string }>('/homeworks/submit', { homeworkId, submissionData });

export const getReviewQueue = (courseId: string) =>
  api.get<HomeworkSubmission[]>('/homeworks/queue', { params: { courseId } });

export const reviewHomework = (data: {
  submissionId: string;
  teacherFeedback: string;
  gradeValueId?: string;
  status: HomeworkStatus;
}) => api.put(`/homeworks/${data.submissionId}/review`, data);

export const askTutor = (courseId: string, question: string, history: string[]) =>
  api.post<{ response: string }>(`/ai/tutor/${courseId}`, { question, history });
