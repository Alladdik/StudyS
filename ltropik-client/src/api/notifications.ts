import api from './client';
import type { AppNotification } from '../types';

export const getNotifications = () => api.get<AppNotification[]>('/notifications');
export const getUnreadCount = () => api.get<{ count: number }>('/notifications/unread-count');
export const markRead = (ids: string[]) => api.post('/notifications/mark-read', { ids });
export const markAllRead = () => api.post('/notifications/mark-all-read');
