import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuthStore } from '../store/authStore';

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const { role } = useAuthStore();

  const homeRoutes: Record<string, string> = {
    Admin: '/admin',
    Teacher: '/teacher/review',
    Student: '/student/diary',
    Parent: '/parent/dashboard',
  };

  return (
    <Layout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-5">
        <div className="text-7xl">🚫</div>
        <h1 className="text-2xl font-extrabold text-ink-900 dark:text-white">Доступ заборонено</h1>
        <p className="text-ink-500 dark:text-[#8891b0] max-w-xs">
          У вас немає прав для перегляду цієї сторінки.
        </p>
        <button
          onClick={() => navigate(homeRoutes[role ?? ''] ?? '/login')}
          className="btn btn-primary px-8"
        >
          ← На головну
        </button>
      </div>
    </Layout>
  );
}
