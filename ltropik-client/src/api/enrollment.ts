import api from './client';

export interface EnrollmentRequest {
  id: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  message?: string;
  responseNote?: string;
  createdAt: string;
  reviewedAt?: string;
  courseId: string;
  courseTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
}

export const submitEnrollmentRequest = (courseId: string, message?: string) =>
  api.post('/enrollmentrequests', { courseId, message });

export const getMyEnrollmentStatus = (courseId: string) =>
  api.get<{ status: string; responseNote?: string; createdAt: string } | null>(
    `/enrollmentrequests/my/${courseId}`
  );

export const getEnrollmentRequests = (courseId?: string) =>
  api.get<EnrollmentRequest[]>('/enrollmentrequests', { params: courseId ? { courseId } : {} });

export const approveRequest = (id: string, note?: string) =>
  api.post(`/enrollmentrequests/${id}/approve`, { note });

export const rejectRequest = (id: string, note?: string) =>
  api.post(`/enrollmentrequests/${id}/reject`, { note });
