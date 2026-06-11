import { useCallback, useEffect, useRef } from 'react';
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
  speaking?: boolean;
  sinkId?: string;             // chosen speaker (output) device
  unlockSignal?: number;       // bump to retry blocked autoplay after a user gesture
  onAudioBlocked?: () => void;  // browser blocked audio autoplay
  canModerate?: boolean;       // viewer is host/admin → show mute/kick
  onMute?: () => void;
  onKick?: () => void;
  pinned?: boolean;
  onPin?: () => void;
}

export function VideoTile({
  stream, displayName, micOn = true, cameraOn = true,
  isLocal, isScreenSharing, isLarge, handRaised,
  speaking, sinkId, unlockSignal, onAudioBlocked,
  canModerate, onMute, onKick, pinned, onPin,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // BUG FIX 1: Depend on [stream, cameraOn] so srcObject is re-set when the
  // video element is remounted after cameraOn toggles (stream ref itself doesn't change).
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    // Only re-attach when the stream actually changed: re-assigning the same
    // MediaStream forces the browser to re-buffer and the video visibly blinks
    // (this effect re-runs every render because callback props change identity).
    if (el.srcObject !== stream) el.srcObject = stream;
    // Auto-play in case browser paused it. If it's blocked (no user gesture yet),
    // tell the parent so it can show a "tap to enable sound" prompt.
    if (stream && el.paused) {
      el.play().catch(() => { if (!isLocal) onAudioBlocked?.(); });
    }
  }, [stream, cameraOn, isScreenSharing, unlockSignal, isLocal, onAudioBlocked]);

  // Fullscreen for screen-share tiles. Container first (keeps overlays),
  // native video fullscreen as iOS Safari fallback.
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    const container = containerRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (container?.requestFullscreen) {
      container.requestFullscreen().catch(() => video?.webkitEnterFullscreen?.());
    } else {
      video?.webkitEnterFullscreen?.();
    }
  }, []);

  // Apply the selected output device (speaker) to remote tiles.
  useEffect(() => {
    const el = videoRef.current as (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (el?.setSinkId && sinkId && !isLocal) el.setSinkId(sinkId).catch(() => {});
  }, [sinkId, stream, isLocal]);

  const initials = displayName
    .split(' ').filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase()).join('');

  // BUG FIX 2: Show video element when camera is on OR when screen sharing.
  // Previously: stream && cameraOn — hid the video even when sharing screen.
  const showVideo = Boolean(stream && (cameraOn || isScreenSharing));

  // BUG FIX 3: Only mirror the local camera feed, not screen share.
  const shouldMirror = isLocal && !isScreenSharing;

  return (
    <div ref={containerRef} className={cx(
      'relative rounded-2xl overflow-hidden bg-ink-800 flex items-center justify-center transition-shadow group/tile',
      // Large tile fills whatever space the layout gives it instead of forcing
      // 16:9 — an aspect-locked tile overflowed the container and got cropped.
      isLarge ? 'w-full h-full' : 'aspect-video',
      isScreenSharing && 'ring-2 ring-brand-500',
      speaking && !isScreenSharing && 'ring-2 ring-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.35)]',
    )}>
      {/* Video — always in DOM so srcObject stays attached even when hidden.
          Screen share uses object-contain so the WHOLE screen is visible;
          camera keeps object-cover (cropping a face is fine, a screen isn't). */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cx('absolute inset-0 w-full h-full', isScreenSharing ? 'object-contain' : 'object-cover', !showVideo && 'invisible')}
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
          {isLocal && !isScreenSharing ? `${displayName} (Ви)` : displayName}
        </span>
        {!micOn && (
          <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center flex-shrink-0 ml-2">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
            </svg>
          </div>
        )}
      </div>

      {/* "Ви" badge (screen tile's name already says it's yours) */}
      {isLocal && !isScreenSharing && (
        <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full z-10">Ви</div>
      )}

      {/* Fullscreen for screen share — see the whole screen without cropping */}
      {isScreenSharing && stream && (
        <button onClick={toggleFullscreen} title="На весь екран"
          className="absolute top-2 right-2 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur opacity-0 group-hover/tile:opacity-100 pointer-coarse:opacity-100 transition">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
        </button>
      )}

      {/* Pin / focus this tile (hover to reveal; always visible on touch) */}
      {onPin && !isScreenSharing && (
        <button onClick={onPin} title={pinned ? 'Відкріпити' : 'Закріпити'}
          className={cx('absolute top-2 left-2 z-20 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur transition',
            pinned ? 'bg-brand-600 text-white opacity-100' : 'bg-black/60 text-white opacity-0 group-hover/tile:opacity-100 pointer-coarse:opacity-100 hover:bg-black/80')}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>
        </button>
      )}

      {/* Host moderation: mute / kick (hover to reveal; always visible on touch) */}
      {canModerate && !isLocal && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-0 group-hover/tile:opacity-100 pointer-coarse:opacity-100 transition">
          {onMute && (
            <button onClick={onMute} title="Вимкнути мікрофон"
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-amber-500 text-white flex items-center justify-center backdrop-blur">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>
            </button>
          )}
          {onKick && (
            <button onClick={onKick} title="Видалити з кімнати"
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-rose-600 text-white flex items-center justify-center backdrop-blur">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
