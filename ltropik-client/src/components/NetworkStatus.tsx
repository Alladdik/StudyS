import { useEffect, useState } from 'react';
import { cx } from './ui';

/** Shows a banner when the connection drops, and a brief confirmation when it returns. */
export function NetworkStatus() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const goOnline = () => {
      setOnline(true);
      setJustBack(true);
      timer = window.setTimeout(() => setJustBack(false), 3000);
    };
    const goOffline = () => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (online && !justBack) return null;

  return (
    <div className={cx(
      'fixed top-0 inset-x-0 z-[60] text-center text-sm font-semibold py-2 text-white shadow-md',
      online ? 'bg-emerald-600' : 'bg-rose-600')}>
      {online ? '✓ Зʼєднання відновлено' : '⚠ Немає зʼєднання з інтернетом — зміни можуть не зберегтись'}
    </div>
  );
}
