import api from './client';
import type { StudentGroup, GroupMember } from '../types';

export const getGroups = () => api.get<StudentGroup[]>('/groups');
export const getGroup = (id: string) =>
  api.get<StudentGroup & { members: GroupMember[] }>(`/groups/${id}`);
export const createGroup = (data: { name: string; description?: string }) =>
  api.post('/groups', data);
export const updateGroup = (id: string, data: { name?: string; description?: string }) =>
  api.put(`/groups/${id}`, data);
export const deleteGroup = (id: string) => api.delete(`/groups/${id}`);
export const addMember = (groupId: string, studentId: string) =>
  api.post(`/groups/${groupId}/members`, { studentId });
export const removeMember = (groupId: string, studentId: string) =>
  api.delete(`/groups/${groupId}/members/${studentId}`);
export const broadcastMessage = (groupId: string, subject: string, htmlBody: string) =>
  api.post(`/groups/${groupId}/broadcast`, { subject, htmlBody });
