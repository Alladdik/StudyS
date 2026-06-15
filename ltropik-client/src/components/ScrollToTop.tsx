import { useEffect, useState } from 'react';

/** Floating "back to top" button that appears once the page is scrolled down. */
export function ScrollToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      title="Вгору"
      aria-label="Прокрутити вгору"
      className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 active:scale-95 transition flex items-center justify-center">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
