import { motion } from 'framer-motion';
import type { DeviceList } from '../../hooks/useWebRTC';

interface Props {
  devices: DeviceList;
  selectedCameraId: string;
  selectedMicId: string;
  selectedSpeakerId: string;
  onCamera: (id: string) => void;
  onMic: (id: string) => void;
  onSpeaker: (id: string) => void;
  onClose: () => void;
}

function Select({ label, icon, value, options, onChange, empty }: {
  label: string; icon: string; value: string;
  options: { deviceId: string; label: string }[];
  onChange: (id: string) => void; empty: string;
}) {
  return (
    <label className="block">
      <span className="text-white/60 text-xs font-medium mb-1.5 flex items-center gap-1.5">{icon} {label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={options.length === 0}
        className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none disabled:opacity-50"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {options.length === 0 && <option>{empty}</option>}
        {options.map((o) => (
          <option key={o.deviceId} value={o.deviceId} style={{ background: '#1e1f26' }}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function RoomSettings({
  devices, selectedCameraId, selectedMicId, selectedSpeakerId,
  onCamera, onMic, onSpeaker, onClose,
}: Props) {
  // setSinkId (speaker selection) is Chromium-only; hide it where unsupported.
  const speakerSupported = typeof (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId === 'function';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-3xl p-6 max-w-sm w-full text-white"
        style={{ background: '#1e1f26', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold">⚙️ Пристрої</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white" style={{ background: 'rgba(255,255,255,0.06)' }}>✕</button>
        </div>
        <div className="flex flex-col gap-4">
          <Select label="Камера" icon="📷" value={selectedCameraId} options={devices.cameras} onChange={onCamera} empty="Немає камер" />
          <Select label="Мікрофон" icon="🎙" value={selectedMicId} options={devices.mics} onChange={onMic} empty="Немає мікрофонів" />
          {speakerSupported && (
            <Select label="Динамік" icon="🔊" value={selectedSpeakerId} options={devices.speakers} onChange={onSpeaker} empty="Немає динаміків" />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
