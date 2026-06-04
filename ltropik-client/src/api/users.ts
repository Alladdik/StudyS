import api from './client';

export interface UserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isBlocked: boolean;
  passwordPlain?: string;
  createdAt: string;
}

export interface CustomFieldDef {
  id: string;
  key: string;
  label: string;
  fieldType: string;
}

export const getUsers = (params?: { role?: string; search?: string; page?: number; pageSize?: number }) =>
  api.get<{ total: number; page: number; pageSize: number; items: UserItem[] }>('/users', { params });

export const createUser = (data: {
  email: string; password: string;
  firstName: string; lastName: string; role: string;
}) => api.post('/users', data);

export const blockUser = (id: string) => api.patch(`/users/${id}/block`);
export const unblockUser = (id: string) => api.patch(`/users/${id}/unblock`);

export const updateUser = (id: string, data: {
  email: string; firstName: string; lastName: string; role: string; password?: string;
}) => api.put(`/users/${id}`, data);

export const deleteUser = (id: string) => api.delete(`/users/${id}`);

export const impersonateUser = (id: string) =>
  api.post<{ accessToken: string; role: string; userId: string }>(`/users/${id}/impersonate`);

export const getCustomFields = () =>
  api.get<CustomFieldDef[]>('/users/custom-fields');

export const addCustomField = (data: { key: string; label: string; fieldType: string }) =>
  api.post('/users/custom-fields', data);
