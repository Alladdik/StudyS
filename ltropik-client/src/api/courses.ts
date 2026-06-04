import api from './client';
import type { Course, Module, ContentBlock } from '../types';

export const getCourses = () => api.get<Course[]>('/courses');
export const getCourse = (id: string) => api.get<Course & { modules: Module[] }>(`/courses/${id}`);
export const createCourse = (data: { title: string; description?: string; gradeScaleId?: string }) =>
  api.post<Course>('/courses', data);
export const addModule = (courseId: string, data: { title: string; sortOrder: number }) =>
  api.post(`/courses/${courseId}/modules`, data);
export const addLesson = (
  courseId: string, moduleId: string,
  data: { title: string; sortOrder: number; contentBlocks: ContentBlock[] },
) => api.post(`/courses/${courseId}/modules/${moduleId}/lessons`, data);
export const enrollStudent = (courseId: string, studentId: string) =>
  api.post(`/courses/${courseId}/enroll/${studentId}`);
export const unenrollStudent = (courseId: string, studentId: string) =>
  api.delete(`/courses/${courseId}/enroll/${studentId}`);
export const assignTeacher = (courseId: string, teacherId: string) =>
  api.post(`/courses/${courseId}/teachers/${teacherId}`);
export const removeTeacher = (courseId: string, teacherId: string) =>
  api.delete(`/courses/${courseId}/teachers/${teacherId}`);
export const getCourseMembers = (courseId: string) =>
  api.get<{ teachers: Array<{ teacherId: string; name: string; email: string }>; students: Array<{ studentId: string; name: string; email: string }> }>(`/courses/${courseId}/members`);
export const submitCourseReview = (courseId: string) =>
  api.post(`/courses/${courseId}/submit-review`);
export const approveCourse = (courseId: string) =>
  api.post(`/courses/${courseId}/approve`);
export const rejectCourse = (courseId: string) =>
  api.post(`/courses/${courseId}/reject`);

export const deleteCourse = (id: string) =>
  api.delete(`/courses/${id}`);

export const updateCourse = (id: string, data: { title?: string; description?: string; gradeScaleId?: string }) =>
  api.put<Course>(`/courses/${id}`, data);

