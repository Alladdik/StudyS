import { useEffect, useRef } from 'react';
import { cx } from '../ui';

interface Props {
  stream: MediaStream | null;
  displayName: string;
  micOn?: boolean;
  cameraOn?: boolean;
  isLocal?: boolean;
  isScreenSharing?: boolean;
  isLarge?: boolean;
  handRaised?: boolean;
}

export function VideoTile({
  stream, displayName, micOn = true, cameraOn = true,
  isLocal, isScreenSharing, isLarge, handRaised,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // BUG FIX 1: Depend on [stream, cameraOn] so srcObject is re-set when the
  // video element is remounted after cameraOn toggles (stream ref itself doesn't change).
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;
    // Auto-play in case browser paused it
    if (stream && videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }
  }, [stream, cameraOn, isScreenSharing]);

  const initials = displayName
    .split(' ').filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase()).join('');

  // BUG FIX 2: Show video element when camera is on OR when screen sharing.
  // Previously: stream && cameraOn — hid the video even when sharing screen.
  const showVideo = Boolean(stream && (cameraOn || isScreenSharing));

  // BUG FIX 3: Only mirror the local camera feed, not screen share.
  const shouldMirror = isLocal && !isScreenSharing;

  return (
    <div className={cx(
      'relative rounded-2xl overflow-hidden bg-ink-800 flex items-center justify-center',
      isLarge ? 'aspect-video w-full' : 'aspect-video',
      isScreenSharing && 'ring-2 ring-brand-500',
    )}>
      {/* Video — always in DOM so srcObject stays attached even when hidden */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cx('absolute inset-0 w-full h-full object-cover', !showVideo && 'invisible')}
        style={shouldMirror ? { transform: 'scaleX(-1)' } : undefined}
      />

      {/* Avatar fallback when camera off and not screen sharing */}
      {!showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ink-700 to-ink-800">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-white text-2xl font-bold">
              {initials || '?'}
            </div>
            {!cameraOn && (
              <span className="text-white/40 text-xs">Камера вимкнена</span>
            )}
          </div>
        </div>
      )}

      {/* Screen share badge */}
      {isScreenSharing && (
        <div className="absolute top-2 left-2 bg-brand-600 text-white text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5 z-10">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
          </svg>
          Демонстрація екрана
        </div>
      )}

      {/* Hand raised */}
      {handRaised && (
        <div className="absolute top-2 right-10 text-xl animate-bounce z-10">✋</div>
      )}

      {/* Name + mic indicator */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2.5 flex items-center justify-between z-10">
        <span className="text-white text-sm font-semibold truncate">
          {isLocal ? `${displayName} (Ви)` : displayName}
        </span>
        {!micOn && (
          <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center flex-shrink-0 ml-2">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
            </svg>
          </div>
        )}
      </div>

      {/* "Ви" badge */}
      {isLocal && (
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full z-10">Ви</div>
      )}
    </div>
  );
}
