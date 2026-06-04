import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '../types';

interface AuthStore {
  token: string | null;
  userId: string | null;
  role: UserRole | null;
  login: (token: string, userId: string, role: UserRole) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      userId: null,
      role: null,
      login: (token, userId, role) => set({ token, userId, role }),
      logout: () => set({ token: null, userId: null, role: null }),
    }),
    { name: 'ltropik-auth' },
  ),
);
