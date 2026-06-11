import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebRTC, REACTION_EMOJIS } from '../hooks/useWebRTC';
import { useActiveSpeaker } from '../hooks/useActiveSpeaker';
import { useRecording } from '../hooks/useRecording';
import { VideoTile } from '../components/room/VideoTile';
import { Whiteboard } from '../components/room/Whiteboard';
import { RoomChat } from '../components/room/RoomChat';
import { ParticipantsPanel } from '../components/room/ParticipantsPanel';
import { RoomSettings } from '../components/room/RoomSettings';
import { getRoom, endRoom } from '../api/rooms';
import type { RoomDetail } from '../api/rooms';
import { useAuthStore } from '../store/authStore';
import { cx, toast } from '../components/ui';

type SidePanel = 'chat' | 'whiteboard' | 'people' | null;

// Web Audio beep — no asset needed
let _audioCtx: AudioContext | null = null;
function playBeep(freq: number) {
  try {
    _audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = _audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = 'sine';
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.start(); osc.stop(ctx.currentTime + 0.28);
  } catch { /* silence */ }
}

// Phone-sized viewport → side panels become bottom sheets, controls collapse.
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const fn = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return mobile;
}

// Isolated so the 1-second tick re-renders ONLY this span, not the whole room
// (a full-page re-render every second made remote videos blink).
function CallTimer({ connected }: { connected: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [connected]);
  if (!connected) return <>Підключення…</>;
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const sec = elapsed % 60;
  return <>{h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`}</>;
}

// ── Telegram-style circular control button ──────────────────────────────────
interface CtrlBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;     // undefined = always "neutral", true = on (teal), false = off (red)
  danger?: boolean;     // bright red CTA (hang-up)
  panel?: boolean;      // panel toggle style (blue)
  badge?: number;       // unread counter badge
  size?: 'sm' | 'md';  // default md
  disabled?: boolean;
}

function CtrlBtn({ icon, label, onClick, active, danger, panel, badge, size = 'md', disabled }: CtrlBtnProps) {
  const isOff = active === false;

  const circleClass = cx(
    'relative flex items-center justify-center rounded-full transition-all duration-200 select-none',
    size === 'sm' ? 'w-11 h-11' : 'w-12 h-12 sm:w-14 sm:h-14',
    danger   ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 shadow-lg shadow-rose-900/40'
    : isOff  ? 'bg-[#2d2d2d] hover:bg-[#363636] active:bg-[#222]'
    : panel  ? 'bg-[#2d2d2d] hover:bg-[#363636] active:bg-[#222]'
    : 'bg-[#2d2d2d] hover:bg-[#363636] active:bg-[#222]',
    disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
  );

  // Inner icon background ring for mic/camera state
  const ringClass = cx(
    'absolute inset-0 rounded-full transition-all duration-200',
    isOff ? 'ring-2 ring-rose-500/70' : panel ? 'ring-2 ring-brand-500/70' : '',
  );

  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      whileTap={disabled ? {} : { scale: 0.88 }}
      whileHover={disabled ? {} : { scale: 1.06 }}
      className="flex flex-col items-center gap-2 group"
    >
      <div className={circleClass}>
        {(isOff || panel) && <div className={ringClass} />}
        <span className={cx(
          'relative z-10 flex items-center justify-center',
          size === 'sm' ? 'text-lg' : 'text-xl',
          danger ? 'text-white' : isOff ? 'text-rose-400' : 'text-white',
        )}>
          {icon}
        </span>
        {/* Badge */}
        {badge != null && badge > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-md"
          >
            {badge > 9 ? '9+' : badge}
          </motion.span>
        )}
        {/* Recording pulse */}
        {active === true && label === 'Запис' && (
          <span className="absolute inset-0 rounded-full ring-2 ring-rose-500 animate-ping opacity-40" />
        )}
      </div>
      <span className={cx(
        'text-[11px] font-medium leading-tight text-center max-w-[56px] transition-colors',
        isOff ? 'text-rose-400' : danger ? 'text-rose-400' : panel ? 'text-brand-400' : 'text-white/50 group-hover:text-white/80',
      )}>
        {label}
      </span>
    </motion.button>
  );
}

// Mobile "more" sheet action tile
function MoreItem({ icon, label, onClick, danger, active }: {
  icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; active?: boolean;
}) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition active:scale-95"
      style={{ background: active ? 'rgba(101,53,246,0.25)' : danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.05)' }}>
      <span className="text-2xl leading-none">{icon}</span>
      <span className={cx('text-[11px] font-medium', danger ? 'text-rose-400' : active ? 'text-brand-400' : 'text-white/70')}>{label}</span>
    </button>
  );
}

// ── SVG icons (inline, no external deps) ────────────────────────────────────
const Icon = {
  MicOn:    () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>,
  MicOff:   () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>,
  CamOn:    () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>,
  CamOff:   () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M21 6.5l-4-4-15 15 1.5 1.5 3.5-3.5H16c.55 0 1-.45 1-1v-3.5l4 4V6.5zM16 16H5.5L13 8.5V15h3v1z"/></svg>,
  Screen:   () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6zm8 9l-4-4h3V8h2v3h3l-4 4z"/></svg>,
  Hand:     () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M21 7c0-1.1-.9-2-2-2h-3.5V3.5C15.5 2.12 14.38 1 13 1s-2.5 1.12-2.5 2.5V5H9C7.9 5 7 5.9 7 7v3H5c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7zM5 12h2v8H5v-8zm14 8H9V7h10v13z"/></svg>,
  Chat:     () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>,
  People:   () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
  Board:    () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.84 1.83 3.75 3.75 1.84-1.83zM3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25z"/></svg>,
  Record:   () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><circle cx="12" cy="12" r="8"/></svg>,
  Stop:     () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>,
  Link:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  HangUp:   () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>,
  EndCall:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="w-6 h-6"><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12"/></svg>,
  Download: () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5v-2z"/></svg>,
  Gear:     () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>,
};

export function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, role } = useAuthStore();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const isMobile = useIsMobile();
  // iPhone Safari has no getDisplayMedia — hide the button instead of erroring
  const canScreenShare = !!navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices;

  const {
    localStream, screenStream, participants, messages, micOn, cameraOn,
    screenSharing, connected, connectionQuality, participantCount, strokes, whiteboardClear,
    raisedHands, reactions, roomEnded, mediaError,
    toggleMic, toggleCamera, startScreenShare, stopScreenShare,
    sendChatMessage, sendStroke, clearWhiteboard, raiseHand, sendReaction, leave,
    muteParticipant, kickParticipant,
    devices, selectedCameraId, selectedMicId, selectedSpeakerId,
    switchCamera, switchMic, switchSpeaker,
  } = useWebRTC(id!);

  const [audioBlocked, setAudioBlocked] = useState(false);
  const [unlockSignal, setUnlockSignal] = useState(0);
  // Stable identity — an inline arrow here changed every render, which made
  // VideoTile's effect re-run and re-attach srcObject (visible video blink).
  const handleAudioBlocked = useCallback(() => setAudioBlocked(true), []);
  const [showSettings, setShowSettings] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // Who's currently talking — local + every remote stream.
  // useMemo prevents new array identity on every render, which would cause
  // useActiveSpeaker to re-register all AudioContext nodes unnecessarily.
  const speakerSources = useMemo(() => [
    { id: 'local', stream: localStream },
    ...[...participants.values()].map((p) => ({ id: p.connectionId, stream: p.stream })),
  // participants is a Map — spread it to a stable list for memo comparison
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [localStream, participants]);
  const speakingIds = useActiveSpeaker(speakerSources);

  const {
    recording, recordingUrl,
    recordingState, recordingProgress, recordingError,
    startRecording, stopAndUpload, reset: resetRecording,
  } = useRecording(screenSharing ? screenStream : localStream);

  const [whiteboardFullscreen, setWhiteboardFullscreen] = useState(false);

  const isHost = room?.hostId === userId || role === 'Admin';

  useEffect(() => {
    if (!id) return;
    getRoom(id)
      .then(r => setRoom(r.data))
      .catch((e: { response?: { status?: number } }) => {
        if (e.response?.status === 410) setLoadError('Кімнату вже завершено');
        else if (e.response?.status === 404) setLoadError('Кімнату не знайдено');
        else setLoadError('Не вдалося завантажити кімнату');
      });
  }, [id]);

  useEffect(() => {
    if (!roomEnded) return;
    const msg = roomEnded === 'deleted' ? 'Кімнату видалено ведучим'
      : roomEnded === 'kicked' ? 'Вас видалив ведучий'
      : roomEnded === 'denied' ? 'Немає доступу до цієї кімнати'
      : 'Ведучий завершив зустріч';
    toast('info', msg);
    const t = setTimeout(() => navigate('/rooms'), 2500);
    return () => clearTimeout(t);
  }, [roomEnded, navigate]);

  // Keyboard shortcuts: M mute, V camera, E screen, hold Space = push-to-talk.
  const pttRef = useRef(false);
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    };
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.repeat) return; // ignore key-repeat and form fields
      const k = e.key.toLowerCase();
      if (k === 'm') { e.preventDefault(); toggleMic(); }
      else if (k === 'v') { e.preventDefault(); toggleCamera(); }
      else if (k === 'e') { e.preventDefault(); screenSharing ? stopScreenShare() : startScreenShare(); }
      else if (e.key === ' ' && !micOn) { e.preventDefault(); pttRef.current = true; toggleMic(); }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' && pttRef.current) { pttRef.current = false; toggleMic(); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [micOn, screenSharing, toggleMic, toggleCamera, startScreenShare, stopScreenShare]);

  // Join/leave beeps
  const prevIds = useRef<Set<string>>(new Set());
  const firstRender = useRef(true);
  useEffect(() => {
    const current = new Set(participants.keys());
    if (firstRender.current) { firstRender.current = false; prevIds.current = current; return; }
    for (const [connId, p] of participants) {
      if (!prevIds.current.has(connId)) { toast('info', `${p.displayName} приєднався`); playBeep(660); }
    }
    for (const connId of prevIds.current) { if (!current.has(connId)) playBeep(440); }
    prevIds.current = current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]);

  // Clear pin if the pinned participant disconnects (prevents black empty spotlight)
  useEffect(() => {
    if (!pinnedId || pinnedId === 'local') return;
    if (!participants.has(pinnedId)) setPinnedId(null);
  }, [participants, pinnedId]);

  // Unread chat
  useEffect(() => { if (sidePanel !== 'chat' && messages.length > 0) setUnreadCount(p => p + 1); }, [messages.length]); // eslint-disable-line
  useEffect(() => { if (sidePanel === 'chat') setUnreadCount(0); }, [sidePanel]);

  const handleLeave = async () => { await leave(); navigate('/rooms'); };
  const handleEndForAll = async () => {
    if (!id) return;
    try { await endRoom(id); } catch { toast('error', 'Не вдалося завершити'); }
    setShowEndConfirm(false);
  };

  const allParticipants = [...participants.values()];
  const sharingParticipant = allParticipants.find(p => p.isScreenSharing);
  const hasScreenShare = !!sharingParticipant || screenSharing;

  // Pin / spotlight (only when nobody is screen-sharing — screen takes priority).
  const pinnedParticipant = pinnedId && pinnedId !== 'local' ? allParticipants.find(p => p.connectionId === pinnedId) ?? null : null;
  const pinnedLocal = pinnedId === 'local';
  const hasPin = !hasScreenShare && (pinnedLocal || !!pinnedParticipant);
  const togglePin = (key: string) => setPinnedId(prev => (prev === key ? null : key));

  // Phones get at most 2 columns — 3-4 tiny tiles in a row are unusable.
  const gridCols = hasScreenShare ? 'grid-cols-1'
    : allParticipants.length === 0 ? 'grid-cols-1'
    : allParticipants.length === 1 ? 'grid-cols-1 sm:grid-cols-2'
    : allParticipants.length <= 3 ? 'grid-cols-2'
    : allParticipants.length <= 8 ? 'grid-cols-2 sm:grid-cols-3'
    : 'grid-cols-2 sm:grid-cols-4';

  const seenIds = new Set<string>();
  const allMessages = [
    ...(room?.messages ?? []).map(m => ({ ...m, local: m.userId === userId })),
    ...messages,
  ].filter(m => { if (!m.id || seenIds.has(m.id)) return false; seenIds.add(m.id); return true; })
   .sort((a, b) => (a.sentAt ? new Date(a.sentAt).getTime() : 0) - (b.sentAt ? new Date(b.sentAt).getTime() : 0));

  // Shared side-panel content (desktop aside / mobile bottom sheet)
  const panelInner = (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-white font-bold text-sm">
          {sidePanel ? { chat: '💬 Чат', whiteboard: '🖊 Дошка', people: '👥 Учасники' }[sidePanel] : ''}
        </p>
        <button onClick={() => setSidePanel(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white transition" style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
      </div>
      {sidePanel === 'chat' && <RoomChat messages={allMessages} onSend={sendChatMessage} />}
      {/* Whiteboard — always mounted when panel open; fullscreen prop triggers portal */}
      {(sidePanel === 'whiteboard' || whiteboardFullscreen) && (
        <Whiteboard
          strokes={strokes}
          clearSignal={whiteboardClear}
          onStroke={sendStroke}
          onClear={clearWhiteboard}
          fullscreen={whiteboardFullscreen}
          onToggleFullscreen={() => {
            setWhiteboardFullscreen(f => !f);
            if (!whiteboardFullscreen) setSidePanel('whiteboard');
          }}
        />
      )}
      {sidePanel === 'people' && <ParticipantsPanel localName="Ви" localMicOn={micOn} localCameraOn={cameraOn} isHost={isHost} participants={allParticipants} raisedHands={raisedHands} onMute={muteParticipant} onKick={kickParticipant} />}
    </>
  );

  // ── Error ─────────────────────────────────────────────────────────────────
  if (loadError) return (
    <div className="h-dvh flex items-center justify-center" style={{ background: '#1a1a2e' }}>
      <div className="text-center text-white">
        <div className="text-7xl mb-5">📭</div>
        <h1 className="text-2xl font-bold mb-2">{loadError}</h1>
        <p className="text-white/40 mb-7">Можливо, ведучий завершив зустріч</p>
        <button onClick={() => navigate('/rooms')} className="btn btn-primary">← До кімнат</button>
      </div>
    </div>
  );

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-dvh flex flex-col overflow-hidden select-none" style={{ background: '#111318' }}>

      {/* Room ended overlay */}
      <AnimatePresence>
        {roomEnded && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(17,19,24,0.92)', backdropFilter: 'blur(12px)' }}>
            <motion.div initial={{ scale: 0.85, y: 24 }} animate={{ scale: 1, y: 0 }} className="text-center text-white">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1 }} className="text-7xl mb-5">👋</motion.div>
              <h1 className="text-2xl font-bold mb-2">{roomEnded === 'deleted' ? 'Кімнату видалено' : roomEnded === 'kicked' ? 'Вас видалено' : roomEnded === 'denied' ? 'Доступ заборонено' : 'Зустріч завершено'}</h1>
              <p className="text-white/40">Перенаправляємо…</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
        style={{ background: 'rgba(26,27,32,0.95)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>

        {/* Left: room info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#6535f6,#8d5cf6)' }}>
            <Icon.CamOn />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-white text-sm truncate leading-tight">{room?.title ?? 'Завантаження…'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <motion.div animate={{ opacity: connected ? 1 : 0.4 }} className="flex items-center gap-1.5">
                <span className={cx('w-1.5 h-1.5 rounded-full', connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse')} />
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <CallTimer connected={connected} />
                </span>
              </motion.div>
              {room?.courseName && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: 'rgba(101,53,246,0.2)', color: '#a78bfa' }}>
                  {room.courseName}
                </span>
              )}
              {connected && connectionQuality !== 'unknown' && (
                <span className="flex items-center gap-1 text-[11px] font-medium" title="Якість з'єднання"
                  style={{ color: connectionQuality === 'good' ? '#34d399' : connectionQuality === 'fair' ? '#fbbf24' : '#fb7185' }}>
                  <span className="flex items-end gap-px h-3">
                    <span className="w-0.5 rounded-sm" style={{ height: '40%', background: 'currentColor' }} />
                    <span className="w-0.5 rounded-sm" style={{ height: '70%', background: 'currentColor', opacity: connectionQuality === 'poor' ? 0.25 : 1 }} />
                    <span className="w-0.5 rounded-sm" style={{ height: '100%', background: 'currentColor', opacity: connectionQuality === 'good' ? 1 : 0.25 }} />
                  </span>
                  {connectionQuality === 'good' ? 'Добре' : connectionQuality === 'fair' ? 'Норм' : 'Слабке'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: panel toggles */}
        <div className="flex items-center gap-1">
          {/* Participants count pill */}
          <button
            onClick={() => setSidePanel(sidePanel === 'people' ? null : 'people')}
            className={cx('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
              sidePanel === 'people' ? 'text-white' : 'text-white/60 hover:text-white')}
            style={{ background: sidePanel === 'people' ? 'rgba(101,53,246,0.35)' : 'rgba(255,255,255,0.07)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {participantCount}
          </button>

          <button
            onClick={() => { navigator.clipboard.writeText(window.location.href); toast('success', 'Посилання скопійовано'); }}
            className="p-2 rounded-xl text-white/50 hover:text-white transition"
            style={{ background: 'rgba(255,255,255,0.06)' }}
            title="Скопіювати посилання">
            <Icon.Link />
          </button>
        </div>
      </div>

      {/* Media error banner */}
      <AnimatePresence>
        {mediaError && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="text-xs text-center py-1.5 px-4 font-medium flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
            ⚠️ {mediaError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio autoplay blocked — one tap to enable sound */}
      <AnimatePresence>
        {audioBlocked && (
          <motion.button
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            onClick={() => { setUnlockSignal(n => n + 1); setAudioBlocked(false); }}
            className="text-sm text-center py-2 px-4 font-semibold flex-shrink-0 w-full cursor-pointer"
            style={{ background: 'rgba(101,53,246,0.2)', color: '#c4b5fd', borderBottom: '1px solid rgba(101,53,246,0.3)' }}>
            🔇 Натисніть, щоб увімкнути звук учасників
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Content area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Video area */}
        <div className="flex-1 flex flex-col p-2.5 gap-2.5 overflow-hidden">
          {hasScreenShare ? (
            <div className="flex flex-col gap-2.5 h-full">
              <div className="flex-1 min-h-0 rounded-2xl overflow-hidden" style={{ background: '#1a1a2e' }}>
                {screenSharing
                  ? <VideoTile stream={screenStream} displayName="Ваш екран" micOn={micOn} cameraOn isScreenSharing isLarge isLocal />
                  : sharingParticipant
                    ? <VideoTile stream={sharingParticipant.screenStream} displayName={`${sharingParticipant.displayName} — екран`} micOn cameraOn isScreenSharing isLarge sinkId={selectedSpeakerId} unlockSignal={unlockSignal} onAudioBlocked={handleAudioBlocked} />
                    : null}
              </div>
              <div className="flex gap-2.5 flex-shrink-0 overflow-x-auto pb-1">
                <div className="w-28 sm:w-36 flex-shrink-0">
                  <VideoTile stream={localStream} displayName="Ви" micOn={micOn} cameraOn={cameraOn} isLocal speaking={speakingIds.has('local')} />
                </div>
                {allParticipants.map(p => (
                  <div key={p.connectionId} className="w-28 sm:w-36 flex-shrink-0">
                    <VideoTile stream={p.stream} displayName={p.displayName} micOn={p.micOn} cameraOn={p.cameraOn}
                      handRaised={raisedHands.has(p.userId)} speaking={speakingIds.has(p.connectionId)}
                      sinkId={selectedSpeakerId} unlockSignal={unlockSignal} onAudioBlocked={handleAudioBlocked}
                      canModerate={isHost} onMute={() => muteParticipant(p.connectionId)} onKick={() => kickParticipant(p.connectionId)} />
                  </div>
                ))}
              </div>
            </div>
          ) : hasPin ? (
            <div className="flex flex-col gap-2.5 h-full">
              <div className="flex-1 min-h-0 rounded-2xl overflow-hidden" style={{ background: '#1a1a2e' }}>
                {pinnedLocal
                  ? <VideoTile stream={localStream} displayName="Ви" micOn={micOn} cameraOn={cameraOn} isLocal isLarge speaking={speakingIds.has('local')} pinned onPin={() => togglePin('local')} />
                  : pinnedParticipant && (
                    <VideoTile stream={pinnedParticipant.stream} displayName={pinnedParticipant.displayName} micOn={pinnedParticipant.micOn} cameraOn={pinnedParticipant.cameraOn} isLarge
                      handRaised={raisedHands.has(pinnedParticipant.userId)} speaking={speakingIds.has(pinnedParticipant.connectionId)}
                      sinkId={selectedSpeakerId} unlockSignal={unlockSignal} onAudioBlocked={handleAudioBlocked}
                      canModerate={isHost} onMute={() => muteParticipant(pinnedParticipant.connectionId)} onKick={() => kickParticipant(pinnedParticipant.connectionId)}
                      pinned onPin={() => togglePin(pinnedParticipant.connectionId)} />
                  )}
              </div>
              <div className="flex gap-2.5 flex-shrink-0 overflow-x-auto pb-1">
                {!pinnedLocal && (
                  <div className="w-28 sm:w-36 flex-shrink-0">
                    <VideoTile stream={localStream} displayName="Ви" micOn={micOn} cameraOn={cameraOn} isLocal speaking={speakingIds.has('local')} onPin={() => togglePin('local')} />
                  </div>
                )}
                {allParticipants.filter(p => p.connectionId !== pinnedId).map(p => (
                  <div key={p.connectionId} className="w-28 sm:w-36 flex-shrink-0">
                    <VideoTile stream={p.stream} displayName={p.displayName} micOn={p.micOn} cameraOn={p.cameraOn}
                      handRaised={raisedHands.has(p.userId)} speaking={speakingIds.has(p.connectionId)}
                      sinkId={selectedSpeakerId} unlockSignal={unlockSignal} onAudioBlocked={handleAudioBlocked}
                      canModerate={isHost} onMute={() => muteParticipant(p.connectionId)} onKick={() => kickParticipant(p.connectionId)}
                      onPin={() => togglePin(p.connectionId)} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={cx('grid gap-2.5 flex-1 overflow-auto content-start', gridCols)}>
              <VideoTile stream={localStream} displayName="Ви" micOn={micOn} cameraOn={cameraOn} isLocal speaking={speakingIds.has('local')} onPin={() => togglePin('local')} />
              {allParticipants.map(p => (
                <VideoTile key={p.connectionId} stream={p.stream} displayName={p.displayName}
                  micOn={p.micOn} cameraOn={p.cameraOn} isScreenSharing={p.isScreenSharing}
                  handRaised={raisedHands.has(p.userId)} speaking={speakingIds.has(p.connectionId)}
                  sinkId={selectedSpeakerId} unlockSignal={unlockSignal} onAudioBlocked={handleAudioBlocked}
                  canModerate={isHost} onMute={() => muteParticipant(p.connectionId)} onKick={() => kickParticipant(p.connectionId)}
                  onPin={() => togglePin(p.connectionId)} />
              ))}
            </div>
          )}
        </div>

        {/* Side panel — desktop: aside; mobile: full-screen bottom sheet
            (a fixed 340px column ate the whole phone screen) */}
        <AnimatePresence>
          {sidePanel && !isMobile && (
            <motion.aside
              key={sidePanel}
              initial={{ width: 0, opacity: 0 }} animate={{ width: 340, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="flex-shrink-0 overflow-hidden border-l"
              style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(26,27,32,0.97)' }}>
              <div style={{ width: 340 }} className="h-full p-3 flex flex-col">
                {panelInner}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile side panel as bottom sheet */}
      <AnimatePresence>
        {sidePanel && isMobile && (
          <motion.div
            key={sidePanel}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className="fixed inset-x-0 bottom-0 top-14 z-[70] flex flex-col p-3 rounded-t-2xl border-t"
            style={{ background: 'rgba(26,27,32,0.98)', borderColor: 'rgba(255,255,255,0.08)', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            {panelInner}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom controls — Telegram style ───────────────────────────────── */}
      <div className="flex-shrink-0 border-t"
        style={{ background: 'rgba(20,21,26,0.97)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)' }}>

        {/* Recording error/progress banner */}
        <AnimatePresence>
          {recordingError && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="flex items-center justify-between px-4 py-2 text-xs"
              style={{ background: 'rgba(239,68,68,0.15)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
              <span style={{ color: '#fca5a5' }}>⚠️ {recordingError}</span>
              <button onClick={resetRecording} className="text-white/40 hover:text-white ml-3">✕</button>
            </motion.div>
          )}
          {(recordingState === 'uploading') && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="px-4 py-2 text-xs" style={{ background: 'rgba(101,53,246,0.1)', borderBottom: '1px solid rgba(101,53,246,0.2)' }}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: '#a78bfa' }}>⬆️ Завантаження запису… {recordingProgress}%</span>
              </div>
              <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${recordingProgress}%`, background: '#6535f6' }} />
              </div>
            </motion.div>
          )}
          {recordingState === 'done' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="flex items-center gap-3 px-4 py-2 text-xs"
              style={{ background: 'rgba(34,197,94,0.1)', borderBottom: '1px solid rgba(34,197,94,0.2)', color: '#86efac' }}>
              ✅ Запис завантажено!
              {recordingUrl && (
                <a href={recordingUrl} download className="underline text-emerald-400 hover:text-emerald-300">Завантажити</a>
              )}
              <button onClick={resetRecording} className="ml-auto text-white/30 hover:text-white">✕</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end justify-center gap-2 sm:gap-5 flex-wrap py-3 sm:py-4 px-3 sm:px-6"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>

          {/* ── Panel toggles (small, secondary) — desktop only ── */}
          {!isMobile && (
            <div className="flex items-end gap-2.5">
              <CtrlBtn
                icon={<Icon.Chat />} label="Чат"
                onClick={() => setSidePanel(sidePanel === 'chat' ? null : 'chat')}
                panel={sidePanel === 'chat'} badge={unreadCount} size="sm"
              />
              <CtrlBtn
                icon={<Icon.Board />} label="Дошка"
                onClick={() => setSidePanel(sidePanel === 'whiteboard' ? null : 'whiteboard')}
                panel={sidePanel === 'whiteboard'} size="sm"
              />
              <CtrlBtn
                icon={<Icon.People />} label="Учасники"
                onClick={() => setSidePanel(sidePanel === 'people' ? null : 'people')}
                panel={sidePanel === 'people'}
                badge={participantCount > 0 ? participantCount : undefined} size="sm"
              />
              <CtrlBtn
                icon={<Icon.Gear />} label="Пристрої"
                onClick={() => setShowSettings(true)} size="sm"
              />
            </div>
          )}

          {/* ── Divider ── */}
          {!isMobile && <div className="w-px h-10 self-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />}

          {/* ── Primary controls (large) ── */}
          <div className="flex items-end gap-2 sm:gap-4">
            {/* Chat — on mobile it lives in the primary row */}
            {isMobile && (
              <CtrlBtn
                icon={<Icon.Chat />} label="Чат"
                onClick={() => setSidePanel(sidePanel === 'chat' ? null : 'chat')}
                panel={sidePanel === 'chat'} badge={unreadCount}
              />
            )}
            {/* Mic */}
            <CtrlBtn icon={micOn ? <Icon.MicOn /> : <Icon.MicOff />} label={micOn ? 'Мікрофон' : 'Вимкнено'} active={micOn} onClick={toggleMic} />
            {/* Camera */}
            <CtrlBtn icon={cameraOn ? <Icon.CamOn /> : <Icon.CamOff />} label={cameraOn ? 'Камера' : 'Вимкнено'} active={cameraOn} onClick={toggleCamera} />
            {/* HANG UP — biggest, red, center */}
            <CtrlBtn icon={<Icon.HangUp />} label="Завершити" danger onClick={handleLeave} />
            {/* Screen share (hidden where the browser can't do it, e.g. iPhone) */}
            {canScreenShare && (
              <CtrlBtn
                icon={<Icon.Screen />}
                label={screenSharing ? 'Зупинити' : 'Екран'}
                active={screenSharing ? undefined : true}
                onClick={screenSharing ? stopScreenShare : startScreenShare}
              />
            )}
            {/* Raise hand */}
            {!isMobile && <CtrlBtn icon={<span className="text-2xl">✋</span>} label="Рука" onClick={raiseHand} />}
            {/* Reactions */}
            {!isMobile && (
              <div className="relative">
                <CtrlBtn icon={<span className="text-2xl">😊</span>} label="Реакція" onClick={() => setShowReactions(v => !v)} panel={showReactions} />
                <AnimatePresence>
                  {showReactions && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.9 }}
                      className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex gap-1 p-2 rounded-2xl"
                      style={{ background: '#1e1f26', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
                      {REACTION_EMOJIS.map(emoji => (
                        <button key={emoji}
                          onClick={() => { sendReaction(emoji); setShowReactions(false); }}
                          className="w-10 h-10 rounded-xl text-2xl hover:bg-white/10 transition flex items-center justify-center">
                          {emoji}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
            {/* Mobile: everything else lives in the "more" sheet */}
            {isMobile && (
              <CtrlBtn icon={<span className="text-2xl leading-none">⋯</span>} label="Ще" onClick={() => setShowMore(true)} panel={showMore} />
            )}
          </div>

          {/* ── Divider ── */}
          {!isMobile && <div className="w-px h-10 self-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />}

          {/* ── Secondary right: whiteboard fullscreen + record + host ── */}
          {!isMobile && (
          <div className="flex items-end gap-2.5">
            {/* Fullscreen whiteboard shortcut */}
            <CtrlBtn
              icon={<span className="text-xl">🖊</span>}
              label={whiteboardFullscreen ? 'Згорнути' : 'Дошка ↗'}
              panel={whiteboardFullscreen || sidePanel === 'whiteboard'}
              size="sm"
              onClick={() => {
                if (whiteboardFullscreen) { setWhiteboardFullscreen(false); }
                else { setWhiteboardFullscreen(true); setSidePanel('whiteboard'); }
              }}
            />

            {/* Record */}
            <CtrlBtn
              icon={
                recordingState === 'uploading' || recordingState === 'stopping'
                  ? <span className="text-base">{recordingProgress}%</span>
                  : recordingState === 'error'
                  ? <span className="text-lg">⚠️</span>
                  : recording ? <Icon.Stop /> : <Icon.Record />
              }
              label={
                recordingState === 'uploading' ? 'Завантаж…'
                : recordingState === 'stopping' ? 'Зупиняю…'
                : recordingState === 'error'    ? 'Помилка'
                : recording ? 'Стоп' : 'Запис'
              }
              active={recording}
              onClick={() => {
                if (recordingState === 'error') { resetRecording(); return; }
                if (recording) stopAndUpload(); else startRecording();
              }}
              disabled={recordingState === 'uploading' || recordingState === 'stopping'}
              size="sm"
            />

            {/* Download recording */}
            <AnimatePresence>
              {recordingUrl && (
                <motion.a initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                  href={recordingUrl} download
                  className="flex flex-col items-center gap-2 group">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center transition-all" style={{ background: '#1a5c3a' }}>
                    <Icon.Download />
                  </div>
                  <span className="text-[11px] text-emerald-400 font-medium">Запис</span>
                </motion.a>
              )}
            </AnimatePresence>

            {/* Host: end for all */}
            {isHost && (
              <CtrlBtn
                icon={<Icon.EndCall />} label="Для всіх"
                danger onClick={() => setShowEndConfirm(true)} size="sm"
              />
            )}
          </div>
          )}
        </div>
      </div>

      {/* ── Mobile "more" bottom sheet ───────────────────────────────────── */}
      <AnimatePresence>
        {showMore && isMobile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowMore(false)}
            className="fixed inset-0 z-[85]" style={{ background: 'rgba(0,0,0,0.55)' }}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="absolute inset-x-0 bottom-0 rounded-t-3xl p-4"
              style={{ background: '#1e1f26', borderTop: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
              <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.2)' }} />
              {/* Reactions row */}
              <div className="flex justify-between gap-1 mb-4">
                {REACTION_EMOJIS.map(emoji => (
                  <button key={emoji}
                    onClick={() => { sendReaction(emoji); setShowMore(false); }}
                    className="flex-1 h-11 rounded-xl text-2xl active:bg-white/15 transition flex items-center justify-center">
                    {emoji}
                  </button>
                ))}
              </div>
              {/* Actions */}
              <div className="grid grid-cols-4 gap-2.5">
                <MoreItem icon="✋" label="Рука" onClick={() => { raiseHand(); setShowMore(false); }} />
                <MoreItem icon="🖊" label="Дошка" active={sidePanel === 'whiteboard'}
                  onClick={() => { setSidePanel('whiteboard'); setShowMore(false); }} />
                <MoreItem icon="👥" label="Учасники" active={sidePanel === 'people'}
                  onClick={() => { setSidePanel('people'); setShowMore(false); }} />
                <MoreItem icon="⚙️" label="Пристрої" onClick={() => { setShowSettings(true); setShowMore(false); }} />
                <MoreItem icon={recording ? '⏹' : '⏺'} label={recording ? 'Стоп запис' : 'Запис'} active={recording}
                  onClick={() => {
                    if (recordingState === 'error') { resetRecording(); setShowMore(false); return; }
                    if (recording) stopAndUpload(); else startRecording();
                    setShowMore(false);
                  }} />
                {isHost && (
                  <MoreItem icon="🚫" label="Для всіх" danger
                    onClick={() => { setShowEndConfirm(true); setShowMore(false); }} />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── End for all — confirm modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showEndConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowEndConfirm(false)}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
            <motion.div initial={{ scale: 0.88, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="rounded-3xl p-7 max-w-sm w-full text-white"
              style={{ background: '#1e1f26', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-4xl mx-auto mb-5"
                style={{ background: 'rgba(239,68,68,0.15)' }}>⚠️</div>
              <h2 className="text-xl font-extrabold text-center mb-2">Завершити для всіх?</h2>
              <p className="text-white/50 text-sm text-center mb-7">
                Усіх учасників буде від'єднано. Кімната стане неактивною.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowEndConfirm(false)}
                  className="flex-1 py-3 rounded-2xl font-semibold text-sm transition"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}>
                  Скасувати
                </button>
                <button onClick={handleEndForAll}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm text-white transition"
                  style={{ background: '#dc2626' }}
                  onMouseOver={e => (e.currentTarget.style.background = '#b91c1c')}
                  onMouseOut={e => (e.currentTarget.style.background = '#dc2626')}>
                  Завершити
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating reactions ───────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
        <AnimatePresence>
          {reactions.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: 1, y: -window.innerHeight * 0.55, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 4, ease: 'easeOut' }}
              className="absolute bottom-28 flex flex-col items-center"
              style={{ left: `${12 + (i % 7) * 11}%` }}>
              <span className="text-5xl drop-shadow-lg">{r.emoji}</span>
              <span className="text-[11px] text-white/80 font-medium bg-black/40 px-2 py-0.5 rounded-full mt-1 max-w-[90px] truncate">{r.displayName}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Device settings ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <RoomSettings
            devices={devices}
            selectedCameraId={selectedCameraId}
            selectedMicId={selectedMicId}
            selectedSpeakerId={selectedSpeakerId}
            onCamera={switchCamera}
            onMic={switchMic}
            onSpeaker={switchSpeaker}
            onClose={() => setShowSettings(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
