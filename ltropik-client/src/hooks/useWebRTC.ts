import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '../store/authStore';

export interface RemoteParticipant {
  connectionId: string;
  userId: string;
  displayName: string;
  stream: MediaStream | null;        // camera + mic
  screenStream: MediaStream | null;  // dedicated screen share (when sharing)
  micOn: boolean;
  cameraOn: boolean;
  isScreenSharing: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  sentAt: string;
  local?: boolean;
}

export interface Reaction {
  id: string;
  userId: string;
  displayName: string;
  emoji: string;
}

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🎉', '🔥', '🙌'] as const;

export interface Stroke {
  tool: 'pen' | 'eraser' | 'line' | 'rect' | 'text' | 'arrow' | 'circle' | 'sticky';
  color: string;
  width: number;
  points: { x: number; y: number }[];
  text?: string;
  fontSize?: number;
  bgColor?: string;    // for sticky notes
}

export type RoomEndReason = 'ended' | 'deleted' | 'kicked' | 'denied' | null;

export interface MediaDeviceLite { deviceId: string; label: string; }
export interface DeviceList { cameras: MediaDeviceLite[]; mics: MediaDeviceLite[]; speakers: MediaDeviceLite[]; }

// Better audio quality: kill echo, background noise, and auto-level the mic.
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

// Bitrate ceilings so a weak uplink degrades gracefully instead of freezing.
const CAMERA_MAX_BITRATE = 1_000_000;  // ~1 Mbps
const SCREEN_MAX_BITRATE = 2_500_000;  // ~2.5 Mbps (sharper text)

async function capBitrate(sender: RTCRtpSender, maxBitrate: number, degradation?: RTCDegradationPreference) {
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].maxBitrate = maxBitrate;
    // Screen share: keep resolution and drop fps instead — otherwise the
    // encoder "pumps" resolution up/down on weak uplinks and text flickers.
    if (degradation) params.degradationPreference = degradation;
    await sender.setParameters(params);
  } catch { /* not all browsers allow this before negotiation */ }
}

// STUN fallback (always available, no auth needed)
const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// Fetch TURN credentials from backend so they're never in the JS bundle
async function fetchIceServers(token: string | null): Promise<RTCIceServer[]> {
  if (!token) return STUN_SERVERS;
  try {
    const res = await fetch('/api/rooms/turn-credentials', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return STUN_SERVERS;
    const turn = await res.json() as { urls: string[]; username: string; credential: string };
    return [...STUN_SERVERS, turn];
  } catch {
    return STUN_SERVERS;
  }
}

export function useWebRTC(roomId: string) {
  const { token } = useAuthStore();
  const hubRef = useRef<signalR.HubConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidateQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  // Per remote connection: every inbound MediaStream keyed by its stream id, plus
  // which of those ids is the screen share. Lets us keep camera + screen separate
  // and reclassify correctly no matter whether the track or the signal arrives first.
  const remoteStreamsRef = useRef<Map<string, Map<string, MediaStream>>>(new Map());
  const screenStreamIdsRef = useRef<Map<string, string>>(new Map());
  const iceServersRef = useRef<RTCIceServer[]>(STUN_SERVERS);
  const micOnRef = useRef(true);
  const cameraOnRef = useRef(true);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor' | 'unknown'>('unknown');
  const [participantCount, setParticipantCount] = useState(1);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [whiteboardClear, setWhiteboardClear] = useState(0);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [roomEnded, setRoomEnded] = useState<RoomEndReason>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [devices, setDevices] = useState<DeviceList>({ cameras: [], mics: [], speakers: [] });
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>('');

  // Enumerate available input/output devices (labels only show after permission)
  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const map = (d: MediaDeviceInfo, fallback: string): MediaDeviceLite => ({
        deviceId: d.deviceId, label: d.label || fallback,
      });
      setDevices({
        cameras: list.filter((d) => d.kind === 'videoinput').map((d, i) => map(d, `Камера ${i + 1}`)),
        mics: list.filter((d) => d.kind === 'audioinput').map((d, i) => map(d, `Мікрофон ${i + 1}`)),
        speakers: list.filter((d) => d.kind === 'audiooutput').map((d, i) => map(d, `Динамік ${i + 1}`)),
      });
    } catch { /* ignore */ }
  }, []);

  // Derive a participant's camera + screen streams from the inbound streams map
  // and the known screen-stream id, then push into state. Race-free: rendering
  // is computed purely from ids, so order of track/signal arrival doesn't matter.
  const recomputeStreams = useCallback((connId: string) => {
    const byId = remoteStreamsRef.current.get(connId);
    const screenId = screenStreamIdsRef.current.get(connId);
    let camera: MediaStream | null = null;
    let screen: MediaStream | null = null;
    if (byId) {
      for (const [id, ms] of byId) {
        if (screenId && id === screenId) screen = ms;
        else camera ??= ms;
      }
    }
    setParticipants((prev) => {
      const m = new Map(prev);
      const p = m.get(connId);
      if (p) m.set(connId, { ...p, stream: camera, screenStream: screen, isScreenSharing: !!screen });
      return m;
    });
  }, []);

  // ── Create peer connection ──────────────────────────────────────────────
  const createPeer = useCallback((remoteConnId: string): RTCPeerConnection => {
    const existing = peersRef.current.get(remoteConnId);
    if (existing) existing.close();

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    const local = localStreamRef.current;
    if (local) local.getTracks().forEach((t) => {
      const sender = pc.addTrack(t, local);
      if (t.kind === 'video') capBitrate(sender, CAMERA_MAX_BITRATE);
    });
    // If we're already sharing our screen, send it to this (possibly late) peer too.
    const screen = screenStreamRef.current;
    if (screen) screen.getTracks().forEach((t) => {
      const sender = pc.addTrack(t, screen);
      if (t.kind === 'video') capBitrate(sender, SCREEN_MAX_BITRATE, 'maintain-resolution');
    });

    pc.onicecandidate = (e) => {
      if (e.candidate && hubRef.current?.state === signalR.HubConnectionState.Connected) {
        hubRef.current.invoke('SendIceCandidate', roomId, remoteConnId, JSON.stringify(e.candidate)).catch(() => {});
      }
    };

    pc.onconnectionstatechange = async () => {
      console.log(`[WebRTC] ${remoteConnId.slice(0,8)} connectionState=${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        // ICE restart, but only ONE side initiates to avoid glare (both peers
        // hit 'failed' at once). Deterministic tiebreaker: the peer with the
        // larger connectionId restarts; the other waits for the new offer.
        const myId = hubRef.current?.connectionId ?? '';
        if (myId <= remoteConnId) return;
        try {
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          hubRef.current?.invoke('SendOffer', roomId, remoteConnId, JSON.stringify(offer)).catch(() => {});
        } catch { /* ignore if can't restart */ }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ${remoteConnId.slice(0,8)} iceState=${pc.iceConnectionState}`);
    };

    pc.ontrack = (e) => {
      const track = e.track;
      // Group tracks by their source MediaStream id (camera/mic share one id,
      // the screen share has its own). Fallback to a per-track id if absent.
      const streamId = e.streams[0]?.id ?? `solo_${track.id}`;

      const byId = remoteStreamsRef.current.get(remoteConnId) ?? new Map<string, MediaStream>();
      let ms = byId.get(streamId);
      if (!ms) { ms = new MediaStream(); byId.set(streamId, ms); }
      if (!ms.getTracks().find((x) => x.id === track.id)) ms.addTrack(track);
      remoteStreamsRef.current.set(remoteConnId, byId);

      // Ensure the participant exists so the track isn't lost on early arrival.
      setParticipants((prev) => {
        if (prev.has(remoteConnId)) return prev;
        const m = new Map(prev);
        m.set(remoteConnId, {
          connectionId: remoteConnId, userId: '', displayName: '…',
          stream: null, screenStream: null, micOn: true, cameraOn: true, isScreenSharing: false,
        });
        return m;
      });

      // Remove the track from its stream when it ends (camera off / share stop).
      track.addEventListener('ended', () => {
        const map = remoteStreamsRef.current.get(remoteConnId);
        const s = map?.get(streamId);
        if (s) { s.removeTrack(track); if (s.getTracks().length === 0) map!.delete(streamId); }
        recomputeStreams(remoteConnId);
      });

      recomputeStreams(remoteConnId);
    };

    peersRef.current.set(remoteConnId, pc);
    return pc;
  }, [roomId, recomputeStreams]);

  const flushIceCandidates = useCallback(async (connId: string, pc: RTCPeerConnection) => {
    const queue = iceCandidateQueueRef.current.get(connId) ?? [];
    iceCandidateQueueRef.current.delete(connId);
    for (const candidate of queue) {
      try { await pc.addIceCandidate(candidate); } catch { /* ignore */ }
    }
  }, []);

  const closePeer = useCallback((connId: string) => {
    peersRef.current.get(connId)?.close();
    peersRef.current.delete(connId);
    iceCandidateQueueRef.current.delete(connId);
    remoteStreamsRef.current.delete(connId);
    screenStreamIdsRef.current.delete(connId);
    setParticipants((prev) => { const m = new Map(prev); m.delete(connId); return m; });
  }, []);

  // ── SignalR setup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !token) return;
    let stopped = false;

    const hub = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/room', {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000])
      .build();

    hubRef.current = hub;

    hub.on('ExistingParticipants', async (list: { userId: string; displayName: string; connectionId: string }[]) => {
      for (const p of list) {
        setParticipants((prev) => {
          const m = new Map(prev);
          m.set(p.connectionId, { connectionId: p.connectionId, userId: p.userId, displayName: p.displayName, stream: null, screenStream: null, micOn: true, cameraOn: true, isScreenSharing: false });
          return m;
        });
        const pc = createPeer(p.connectionId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await hub.invoke('SendOffer', roomId, p.connectionId, JSON.stringify(offer)).catch(() => {});
      }
    });

    hub.on('ParticipantJoined', (info: { userId: string; firstName: string; lastName: string; displayName?: string; connectionId: string }) => {
      const displayName = info.displayName ?? `${info.firstName} ${info.lastName}`;
      setParticipants((prev) => {
        const m = new Map(prev);
        m.set(info.connectionId, { connectionId: info.connectionId, userId: info.userId, displayName, stream: null, screenStream: null, micOn: true, cameraOn: true, isScreenSharing: false });
        return m;
      });
      // If we're sharing our screen, let the newcomer know its stream id so they
      // can classify the incoming screen track correctly.
      const sid = screenStreamRef.current?.id;
      if (sid) hub.invoke('StartScreenShare', roomId, sid).catch(() => {});
    });

    // FIX: reuse existing peer (supports renegotiation for screen-share addTrack)
    hub.on('ReceiveOffer', async (data: { fromConnectionId: string; fromUserId: string; displayName: string; sdp: string }) => {
      const { fromConnectionId, fromUserId, displayName, sdp } = data;
      setParticipants((prev) => {
        const m = new Map(prev);
        if (!m.has(fromConnectionId)) {
          m.set(fromConnectionId, { connectionId: fromConnectionId, userId: fromUserId, displayName, stream: null, screenStream: null, micOn: true, cameraOn: true, isScreenSharing: false });
        }
        return m;
      });
      let pc = peersRef.current.get(fromConnectionId);
      if (!pc) pc = createPeer(fromConnectionId);
      try {
        await pc.setRemoteDescription(JSON.parse(sdp));
        await flushIceCandidates(fromConnectionId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await hub.invoke('SendAnswer', roomId, fromConnectionId, JSON.stringify(answer)).catch(() => {});
      } catch (err) { console.error('offer error', err); }
    });

    hub.on('ReceiveAnswer', async (data: { fromConnectionId: string; sdp: string }) => {
      const pc = peersRef.current.get(data.fromConnectionId);
      if (pc) {
        try {
          await pc.setRemoteDescription(JSON.parse(data.sdp));
          await flushIceCandidates(data.fromConnectionId, pc);
        } catch (err) { console.error('answer error', err); }
      }
    });

    hub.on('ReceiveIceCandidate', async (data: { fromConnectionId: string; candidate: string }) => {
      const pc = peersRef.current.get(data.fromConnectionId);
      const candidate: RTCIceCandidateInit = JSON.parse(data.candidate);
      if (!pc || !pc.remoteDescription) {
        const queue = iceCandidateQueueRef.current.get(data.fromConnectionId) ?? [];
        queue.push(candidate);
        iceCandidateQueueRef.current.set(data.fromConnectionId, queue);
      } else {
        try { await pc.addIceCandidate(candidate); } catch { /* ignore */ }
      }
    });

    hub.on('ParticipantLeft', (data: { connectionId: string }) => closePeer(data.connectionId));

    hub.on('ParticipantMediaState', (data: { connectionId: string; micOn: boolean; cameraOn: boolean }) => {
      setParticipants((prev) => {
        const m = new Map(prev);
        const p = m.get(data.connectionId);
        if (p) m.set(data.connectionId, { ...p, micOn: data.micOn, cameraOn: data.cameraOn });
        return m;
      });
    });

    hub.on('ScreenShareStarted', (data: { connectionId: string; streamId?: string }) => {
      if (data.streamId) {
        screenStreamIdsRef.current.set(data.connectionId, data.streamId);
        recomputeStreams(data.connectionId);
      }
    });

    hub.on('ScreenShareStopped', (data: { connectionId: string }) => {
      const screenId = screenStreamIdsRef.current.get(data.connectionId);
      screenStreamIdsRef.current.delete(data.connectionId);
      // Drop the cached screen stream so it doesn't linger.
      if (screenId) remoteStreamsRef.current.get(data.connectionId)?.delete(screenId);
      recomputeStreams(data.connectionId);
    });

    hub.on('ReceiveChatMessage', (msg: ChatMessage) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });

    hub.on('ReceiveStroke', (strokeJson: string) => {
      try { setStrokes((prev) => [...prev, JSON.parse(strokeJson)]); } catch { /* ignore */ }
    });

    hub.on('WhiteboardCleared', () => {
      setStrokes([]);
      setWhiteboardClear((n) => n + 1);
    });

    hub.on('ParticipantCount', (count: number) => setParticipantCount(count));

    hub.on('HandRaised', (data: { userId: string }) => {
      setRaisedHands((prev) => new Set([...prev, data.userId]));
      setTimeout(() => setRaisedHands((prev) => { const s = new Set(prev); s.delete(data.userId); return s; }), 6000);
    });

    hub.on('HandLowered', (data: { userId: string }) => {
      setRaisedHands((prev) => { const s = new Set(prev); s.delete(data.userId); return s; });
    });

    hub.on('ReceiveReaction', (data: { userId: string; displayName: string; emoji: string }) => {
      const id = (crypto.randomUUID?.() ?? `${Date.now()}_${Math.random()}`);
      setReactions((prev) => [...prev, { id, ...data }]);
      setTimeout(() => setReactions((prev) => prev.filter((r) => r.id !== id)), 4500);
    });

    // NEW: room ended/deleted by host
    hub.on('RoomEnded', (data: { reason: RoomEndReason }) => {
      setRoomEnded(data?.reason ?? 'ended');
    });

    // After an automatic reconnect SignalR has a NEW connectionId, so the server
    // no longer knows we're in the room. Re-join to re-sync presence + peers,
    // otherwise camera/audio silently stops flowing to everyone.
    hub.onreconnected(async () => {
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      iceCandidateQueueRef.current.clear();
      remoteStreamsRef.current.clear();
      screenStreamIdsRef.current.clear();
      setParticipants(new Map());
      setConnected(true);
      await hub.invoke('JoinRoom', roomId).catch(() => {});
    });

    hub.onreconnecting(() => setConnected(false));

    // Host forced us muted — turn the mic off locally and tell everyone.
    hub.on('ForceMuted', () => {
      micOnRef.current = false;
      setMicOn(false);
      localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = false; });
      hubRef.current?.invoke('SetMediaState', roomId, false, cameraOnRef.current).catch(() => {});
      setMediaError('Ведучий вимкнув ваш мікрофон');
    });

    // Host removed us from the room.
    hub.on('Kicked', () => setRoomEnded('kicked'));

    // Server refused entry (not enrolled / not host).
    hub.on('AccessDenied', () => setRoomEnded('denied'));

    const startHub = async () => {
      // Fetch TURN credentials from backend (keeps credentials out of JS bundle)
      iceServersRef.current = await fetchIceServers(token);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: AUDIO_CONSTRAINTS });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);
        refreshDevices();
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS, video: false });
          if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
          localStreamRef.current = stream;
          setLocalStream(stream);
          setCameraOn(false); cameraOnRef.current = false;
          setMediaError('Камеру не знайдено — лише мікрофон');
          refreshDevices();
        } catch {
          localStreamRef.current = new MediaStream();
          setLocalStream(new MediaStream());
          setCameraOn(false); cameraOnRef.current = false;
          setMicOn(false); micOnRef.current = false;
          setMediaError('Немає доступу до камери та мікрофона');
        }
      }

        // Guard: if stopped during media acquisition, abort before connecting
      if (stopped) return;

      try {
        await hub.start();
      } catch (err: unknown) {
        const msg = String(err);
        // Swallow expected teardown errors (React StrictMode double-mount)
        if (msg.includes('stopped') || msg.includes('negotiation') || msg.includes('Disconnected')) return;
        throw err;
      }

      if (stopped) {
        await hub.stop().catch(() => {});
        return;
      }

      setConnected(true);
      await hub.invoke('JoinRoom', roomId).catch(() => {});
    };

    startHub().catch((err: unknown) => {
      const msg = String(err);
      if (msg.includes('stopped') || msg.includes('negotiation') || msg.includes('Disconnected')) return;
      console.error('[RoomHub]', err);
    });

    return () => {
      stopped = true;
      const cleanup = async () => {
        try {
          // Only send LeaveRoom once (leave() may have already sent it)
          if (!leftRef.current && hub.state === signalR.HubConnectionState.Connected) {
            leftRef.current = true;
            await hub.invoke('LeaveRoom', roomId).catch(() => {});
          }
          // Only stop if not already stopped/stopping
          if (hub.state !== signalR.HubConnectionState.Disconnected &&
              hub.state !== signalR.HubConnectionState.Disconnecting) {
            await hub.stop();
          }
        } catch { /* teardown errors are expected */ }
      };
      cleanup();
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      iceCandidateQueueRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, token]);

  // ── Controls ────────────────────────────────────────────────────────────
  const renegotiate = useCallback(async (connId: string, pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await hubRef.current?.invoke('SendOffer', roomId, connId, JSON.stringify(offer));
    } catch (err) { console.error('renegotiate error', err); }
  }, [roomId]);

  // Acquire a track on demand and push it to every peer (used when the user
  // turns on a device that wasn't granted/available at join time).
  const addTrackToPeers = useCallback(async (track: MediaStreamTrack, stream: MediaStream) => {
    for (const [connId, pc] of peersRef.current) {
      const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
      if (sender) {
        await sender.replaceTrack(track).catch(() => {});
      } else {
        pc.addTrack(track, stream);
        await renegotiate(connId, pc);
      }
    }
  }, [renegotiate]);

  const toggleMic = useCallback(async () => {
    const next = !micOnRef.current;
    const stream = localStreamRef.current;

    // No mic track yet (joined without audio permission) — acquire on demand
    if (next && (!stream || stream.getAudioTracks().length === 0)) {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS });
        const track = mic.getAudioTracks()[0];
        const target = stream ?? new MediaStream();
        target.addTrack(track);
        localStreamRef.current = target;
        setLocalStream(new MediaStream(target.getTracks()));
        await addTrackToPeers(track, target);
        refreshDevices();
        setMediaError(null);
      } catch {
        setMediaError('Не вдалося увімкнути мікрофон');
        return;
      }
    } else {
      stream?.getAudioTracks().forEach((t) => { t.enabled = next; });
    }

    micOnRef.current = next;
    setMicOn(next);
    hubRef.current?.invoke('SetMediaState', roomId, next, cameraOnRef.current).catch(() => {});
  }, [roomId, addTrackToPeers]);

  const toggleCamera = useCallback(async () => {
    const next = !cameraOnRef.current;
    const stream = localStreamRef.current;

    // No camera track yet (joined audio-only or camera was denied) — acquire it
    // now so the user can turn the camera on whenever they want.
    if (next && (!stream || stream.getVideoTracks().length === 0)) {
      try {
        const cam = await navigator.mediaDevices.getUserMedia({ video: true });
        const track = cam.getVideoTracks()[0];
        const target = stream ?? new MediaStream();
        target.addTrack(track);
        localStreamRef.current = target;
        setLocalStream(new MediaStream(target.getTracks()));
        await addTrackToPeers(track, target);
        refreshDevices();
        setMediaError(null);
      } catch {
        setMediaError('Не вдалося увімкнути камеру');
        return;
      }
    } else {
      stream?.getVideoTracks().forEach((t) => { t.enabled = next; });
    }

    cameraOnRef.current = next;
    setCameraOn(next);
    hubRef.current?.invoke('SetMediaState', roomId, micOnRef.current, next).catch(() => {});
  }, [roomId, addTrackToPeers]);

  const startScreenShare = useCallback(async () => {
    try {
      const screen = await (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia: (c?: MediaStreamConstraints) => Promise<MediaStream>;
      }).getDisplayMedia({
        // 15 fps is plenty for slides/code and halves the bandwidth — less
        // encoder pressure means fewer quality drops ("blinking") for viewers.
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: true,
      });

      // Tell the encoder this is screen content: prioritize sharp text/detail
      // over smooth motion when bandwidth gets tight.
      screen.getVideoTracks().forEach((t) => { t.contentHint = 'detail'; });

      screenStreamRef.current = screen;
      setScreenStream(screen);

      // Tell peers our screen-stream id FIRST so they classify the incoming
      // tracks as "screen" (separate tile), not as our camera.
      await hubRef.current?.invoke('StartScreenShare', roomId, screen.id).catch(() => {});

      // Add the screen video (+ optional system audio) as NEW tracks, so the
      // camera keeps flowing — viewers see both the presenter and the screen.
      for (const [connId, pc] of peersRef.current) {
        screen.getTracks().forEach((t) => {
          const sender = pc.addTrack(t, screen);
          if (t.kind === 'video') capBitrate(sender, SCREEN_MAX_BITRATE, 'maintain-resolution');
        });
        await renegotiate(connId, pc);
      }

      screen.getVideoTracks()[0]?.addEventListener('ended', () => stopScreenShare());
      setScreenSharing(true);
    } catch (err) {
      console.error('Screen share error:', err);
      screenStreamRef.current = null;
      setScreenStream(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, renegotiate]);

  const stopScreenShare = useCallback(async () => {
    const screen = screenStreamRef.current;
    if (!screen) return;
    const screenTracks = screen.getTracks();

    // Remove exactly the screen senders from every peer; camera/mic untouched.
    for (const [connId, pc] of peersRef.current) {
      let needsRenegotiation = false;
      for (const sender of pc.getSenders()) {
        if (sender.track && screenTracks.includes(sender.track)) {
          try { pc.removeTrack(sender); needsRenegotiation = true; } catch { /* ignore */ }
        }
      }
      if (needsRenegotiation) await renegotiate(connId, pc);
    }

    screenTracks.forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setScreenSharing(false);
    await hubRef.current?.invoke('StopScreenShare', roomId).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, renegotiate]);

  const sendChatMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    await hubRef.current?.invoke('SendChatMessage', roomId, content).catch(() => {});
  }, [roomId]);

  const sendStroke = useCallback(async (stroke: Stroke) => {
    setStrokes((prev) => [...prev, stroke]);
    await hubRef.current?.invoke('SendStroke', roomId, JSON.stringify(stroke)).catch(() => {});
  }, [roomId]);

  const clearWhiteboard = useCallback(async () => {
    setStrokes([]);
    setWhiteboardClear((n) => n + 1);
    await hubRef.current?.invoke('ClearWhiteboard', roomId).catch(() => {});
  }, [roomId]);

  const raiseHand = useCallback(async () => {
    await hubRef.current?.invoke('RaiseHand', roomId).catch(() => {});
  }, [roomId]);

  const sendReaction = useCallback(async (emoji: string) => {
    await hubRef.current?.invoke('SendReaction', roomId, emoji).catch(() => {});
  }, [roomId]);

  // ── Host controls ─────────────────────────────────────────────────────────
  const muteParticipant = useCallback(async (connectionId: string) => {
    await hubRef.current?.invoke('MuteParticipant', roomId, connectionId).catch(() => {});
  }, [roomId]);

  const kickParticipant = useCallback(async (connectionId: string) => {
    await hubRef.current?.invoke('KickParticipant', roomId, connectionId).catch(() => {});
  }, [roomId]);

  // ── Device switching ──────────────────────────────────────────────────────
  // Swap to a different camera: re-acquire, replace the track on every peer
  // (unless we're screen-sharing — then just keep it ready for when we stop).
  const switchCamera = useCallback(async (deviceId: string) => {
    try {
      const cam = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
      const track = cam.getVideoTracks()[0];
      track.enabled = cameraOnRef.current;
      const stream = localStreamRef.current ?? new MediaStream();
      stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
      stream.addTrack(track);
      localStreamRef.current = stream;
      setLocalStream(new MediaStream(stream.getTracks()));
      setSelectedCameraId(deviceId);
      if (!screenStreamRef.current) {
        for (const [connId, pc] of peersRef.current) {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) await sender.replaceTrack(track).catch(() => {});
          else { pc.addTrack(track, stream); await renegotiate(connId, pc); }
        }
      }
    } catch { setMediaError('Не вдалося перемкнути камеру'); }
  }, [renegotiate]);

  const switchMic = useCallback(async (deviceId: string) => {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { ...AUDIO_CONSTRAINTS, deviceId: { exact: deviceId } },
      });
      const track = mic.getAudioTracks()[0];
      track.enabled = micOnRef.current;
      const stream = localStreamRef.current ?? new MediaStream();
      stream.getAudioTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
      stream.addTrack(track);
      localStreamRef.current = stream;
      setLocalStream(new MediaStream(stream.getTracks()));
      setSelectedMicId(deviceId);
      for (const [connId, pc] of peersRef.current) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
        if (sender) await sender.replaceTrack(track).catch(() => {});
        else { pc.addTrack(track, stream); await renegotiate(connId, pc); }
      }
    } catch { setMediaError('Не вдалося перемкнути мікрофон'); }
  }, [renegotiate]);

  // Speaker switch is applied per <video> element via setSinkId — just store it.
  const switchSpeaker = useCallback((deviceId: string) => setSelectedSpeakerId(deviceId), []);

  // Track whether we already called LeaveRoom so the useEffect cleanup doesn't
  // send it a second time when React unmounts after navigation.
  const leftRef = useRef(false);

  const leave = useCallback(async () => {
    if (leftRef.current) return;
    leftRef.current = true;
    try {
      if (hubRef.current?.state === signalR.HubConnectionState.Connected) {
        await hubRef.current.invoke('LeaveRoom', roomId);
      }
    } catch { /* ignore */ }
  }, [roomId]);

  // Sample WebRTC stats to surface a "your connection is weak" hint before
  // things actually freeze. Takes the worst RTT / packet loss across peers.
  useEffect(() => {
    const interval = setInterval(async () => {
      const peers = [...peersRef.current.values()];
      if (peers.length === 0) { setConnectionQuality('unknown'); return; }
      let worstRtt = 0, worstLoss = 0, sawData = false;
      for (const pc of peers) {
        try {
          const stats = await pc.getStats();
          stats.forEach((r) => {
            if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated && typeof r.currentRoundTripTime === 'number') {
              sawData = true; worstRtt = Math.max(worstRtt, r.currentRoundTripTime);
            }
            if (r.type === 'remote-inbound-rtp' && typeof r.fractionLost === 'number') {
              sawData = true; worstLoss = Math.max(worstLoss, r.fractionLost);
            }
          });
        } catch { /* ignore */ }
      }
      if (!sawData) return;
      const quality = (worstRtt < 0.25 && worstLoss < 0.03) ? 'good'
        : (worstRtt < 0.5 && worstLoss < 0.08) ? 'fair' : 'poor';
      setConnectionQuality(quality);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Keep the device list fresh when the user plugs/unplugs a camera or headset.
  useEffect(() => {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const handler = () => refreshDevices();
    md.addEventListener('devicechange', handler);
    return () => md.removeEventListener('devicechange', handler);
  }, [refreshDevices]);

  return {
    localStream, screenStream, participants, messages, micOn, cameraOn, screenSharing, connected,
    connectionQuality, participantCount, strokes, whiteboardClear, raisedHands, reactions, roomEnded, mediaError,
    toggleMic, toggleCamera, startScreenShare, stopScreenShare,
    sendChatMessage, sendStroke, clearWhiteboard, raiseHand, sendReaction, leave,
    muteParticipant, kickParticipant,
    devices, selectedCameraId, selectedMicId, selectedSpeakerId,
    switchCamera, switchMic, switchSpeaker, refreshDevices,
  };
}
