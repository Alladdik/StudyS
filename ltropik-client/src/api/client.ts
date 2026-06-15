import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { toast } from '../components/ui';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status as number | undefined;

    if (status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(err);
    }

    // Surface unexpected failures globally so an action never silently does nothing.
    // 4xx (validation/conflict/forbidden) stays with the page that can explain it.
    if (!err.response) {
      toast('error', 'Немає зʼєднання із сервером');
    } else if (status === 429) {
      toast('error', 'Забагато запитів — зачекайте трохи');
    } else if (status && status >= 500) {
      toast('error', err.response?.data?.error ?? 'Помилка сервера. Спробуйте пізніше');
    }

    return Promise.reject(err);
  },
);

export default api;
