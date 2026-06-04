import api from './client';
import type { LessonComment } from '../types';

export const getComments = (lessonId: string) =>
  api.get<LessonComment[]>(`/comments/lesson/${lessonId}`);

export const createComment = (data: { lessonId: string; body: string; parentCommentId?: string }) =>
  api.post<LessonComment>('/comments', data);

export const deleteComment = (id: string) => api.delete(`/comments/${id}`);
