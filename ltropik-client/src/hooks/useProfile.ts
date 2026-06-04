import { useEffect, useState } from 'react';
import { getProfile, type Profile } from '../api/profile';
import { useAuthStore } from '../store/authStore';

// Lightweight singleton cache so multiple Layout mounts don't re-fetch
let cached: Profile | null = null;
let lastUserId: string | null = null;

export function useProfile() {
  const { userId } = useAuthStore();
  const [profile, setProfile] = useState<Profile | null>(cached);

  useEffect(() => {
    if (!userId) { cached = null; setProfile(null); return; }
    // Re-fetch if user changed
    if (lastUserId !== userId) { cached = null; }
    if (cached) { setProfile(cached); return; }

    getProfile()
      .then(r => { cached = r.data; lastUserId = userId; setProfile(r.data); })
      .catch(() => {});
  }, [userId]);

  const refresh = () => {
    cached = null;
    getProfile()
      .then(r => { cached = r.data; setProfile(r.data); })
      .catch(() => {});
  };

  return { profile, refresh };
}
