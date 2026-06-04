import api from './client';

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  telegramId: string | null;
  telegramLinked: boolean;
  createdAt: string;
}

export const getProfile = () => api.get<Profile>('/profile');

export const updateProfile = (data: {
  firstName?: string;
  lastName?: string;
  currentPassword?: string;
  newPassword?: string;
}) => api.put('/profile', data);

export const generateTelegramCode = () =>
  api.post<{ code: string }>('/profile/telegram-code');

export const unlinkTelegram = () => api.delete('/profile/telegram');
