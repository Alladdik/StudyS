import type { RemoteParticipant } from '../../hooks/useWebRTC';

interface Props {
  localName: string;
  localMicOn: boolean;
  localCameraOn: boolean;
  isHost: boolean;
  participants: RemoteParticipant[];
  raisedHands: Set<string>;
}

function Row({ name, micOn, cameraOn, handRaised, you, host }: {
  name: string; micOn: boolean; cameraOn: boolean; handRaised?: boolean; you?: boolean; host?: boolean;
}) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition">
      <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {initials || '?'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">
          {name}{you && ' (Ви)'}
          {host && <span className="ml-1.5 text-[10px] bg-brand-500/30 text-brand-200 px-1.5 py-0.5 rounded-full">Ведучий</span>}
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {handRaised && <span className="text-sm">✋</span>}
        <span className={micOn ? 'text-emerald-400' : 'text-rose-400'}>
          {micOn ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>
          )}
        </span>
        <span className={cameraOn ? 'text-white/50' : 'text-rose-400'}>
          {cameraOn ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M21 6.5l-4-4-15 15 1.5 1.5 3.5-3.5H16c.55 0 1-.45 1-1v-3.5l4 4V6.5zM16 16H5.5L13 8.5V15h3v1z"/></svg>
          )}
        </span>
      </div>
    </div>
  );
}

export function ParticipantsPanel({ localName, localMicOn, localCameraOn, isHost, participants, raisedHands }: Props) {
  const total = participants.length + 1;
  return (
    <div className="flex flex-col h-full bg-ink-800 rounded-2xl overflow-hidden border border-white/10">
      <div className="px-4 py-3 border-b border-white/10">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          👥 Учасники <span className="text-white/40 font-normal">({total})</span>
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        <Row name={localName} micOn={localMicOn} cameraOn={localCameraOn} you host={isHost} />
        {participants.map((p) => (
          <Row key={p.connectionId} name={p.displayName} micOn={p.micOn}
            cameraOn={p.cameraOn} handRaised={raisedHands.has(p.userId)} />
        ))}
        {participants.length === 0 && (
          <p className="text-center text-white/30 text-xs py-6">Поки що ви один тут.<br />Поділіться посиланням 🔗</p>
        )}
      </div>
    </div>
  );
}
