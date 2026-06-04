import api from './client';
import type { CourseProgressInfo } from '../types';

export const getCourseProgress = (courseId: string) =>
  api.get<CourseProgressInfo>(`/progress/${courseId}`);

export const markLessonComplete = (lessonId: string) =>
  api.post('/progress/complete', { lessonId });
