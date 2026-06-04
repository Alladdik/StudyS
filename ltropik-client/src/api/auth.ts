import api from './client';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  role: string;
  userId: string;
  requires2fa?: boolean;
  pendingToken?: string;
}

export const login = (email: string, password: string) =>
  api.post<LoginResponse>('/auth/login', { email, password });

export const verify2fa = (pendingToken: string, code: string) =>
  api.post<LoginResponse>('/auth/verify-2fa', { pendingToken, code });

export const register = (data: {
  email: string; password: string;
  firstName: string; lastName: string; role: string;
}) => api.post('/auth/register', data);

export const forgotPassword = (email: string) =>
  api.post('/auth/forgot-password', { email });

export const resetPassword = (token: string, newPassword: string) =>
  api.post('/auth/reset-password', { token, newPassword });

export const verifyEmail = (token: string) =>
  api.post('/auth/verify-email', { token });
