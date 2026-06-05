import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '../store/authStore';

export interface RemoteParticipant {
  connectionId: string;
  userId: string;
  displayName: string;
  stream: MediaStream | null;
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

export interface Stroke {
  tool: 'pen' | 'eraser' | 'line' | 'rect' | 'text' | 'arrow' | 'circle' | 'sticky';
  color: string;
  width: number;
  points: { x: number; y: number }[];
  text?: string;
  fontSize?: number;
  bgColor?: string;    // for sticky notes
}

export type RoomEndReason = 'ended' | 'deleted' | null;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  // TURN relay — потрібен коли обидва користувачі за NAT
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:80?transport=tcp',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function useWebRTC(roomId: string) {
  const { token } = useAuthStore();
  const hubRef = useRef<signalR.HubConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceCandidateQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
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
  const [participantCount, setParticipantCount] = useState(1);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [whiteboardClear, setWhiteboardClear] = useState(0);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [roomEnded, setRoomEnded] = useState<RoomEndReason>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // ── Create peer connection ──────────────────────────────────────────────
  const createPeer = useCallback((remoteConnId: string): RTCPeerConnection => {
    const existing = peersRef.current.get(remoteConnId);
    if (existing) existing.close();

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    const local = localStreamRef.current;
    if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));

    pc.onicecandidate = (e) => {
      if (e.candidate && hubRef.current?.state === signalR.HubConnectionState.Connected) {
        hubRef.current.invoke('SendIceCandidate', roomId, remoteConnId, JSON.stringify(e.candidate)).catch(() => {});
      }
    };

    pc.onconnectionstatechange = async () => {
      console.log(`[WebRTC] ${remoteConnId.slice(0,8)} connectionState=${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        // ICE restart: надсилаємо новий offer з iceRestart:true
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
      // Always create/reuse a stream even if participant not yet in map
      const track = e.track;
      const remoteStream = e.streams[0] ?? null;

      setParticipants((prev) => {
        const map = new Map(prev);
        const p = map.get(remoteConnId);
        const stream = p?.stream ?? new MediaStream();

        // Add all tracks from the associated stream (dedup)
        const incoming = remoteStream ? remoteStream.getTracks() : [track];
        incoming.forEach((t) => {
          if (t && !stream.getTracks().find((x) => x.id === t.id)) stream.addTrack(t);
        });

        if (p) {
          map.set(remoteConnId, { ...p, stream });
        } else {
          // Participant not yet in map — create placeholder so track isn't lost
          map.set(remoteConnId, {
            connectionId: remoteConnId, userId: '', displayName: '…',
            stream, micOn: true, cameraOn: true, isScreenSharing: false,
          });
        }
        return map;
      });
    };

    peersRef.current.set(remoteConnId, pc);
    return pc;
  }, [roomId]);

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
          m.set(p.connectionId, { connectionId: p.connectionId, userId: p.userId, displayName: p.displayName, stream: null, micOn: true, cameraOn: true, isScreenSharing: false });
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
        m.set(info.connectionId, { connectionId: info.connectionId, userId: info.userId, displayName, stream: null, micOn: true, cameraOn: true, isScreenSharing: false });
        return m;
      });
    });

    // FIX: reuse existing peer (supports renegotiation for screen-share addTrack)
    hub.on('ReceiveOffer', async (data: { fromConnectionId: string; fromUserId: string; displayName: string; sdp: string }) => {
      const { fromConnectionId, fromUserId, displayName, sdp } = data;
      setParticipants((prev) => {
        const m = new Map(prev);
        if (!m.has(fromConnectionId)) {
          m.set(fromConnectionId, { connectionId: fromConnectionId, userId: fromUserId, displayName, stream: null, micOn: true, cameraOn: true, isScreenSharing: false });
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

    hub.on('ScreenShareStarted', (data: { connectionId: string }) => {
      setParticipants((prev) => {
        const m = new Map(prev);
        const p = m.get(data.connectionId);
        if (p) m.set(data.connectionId, { ...p, isScreenSharing: true });
        return m;
      });
    });

    hub.on('ScreenShareStopped', (data: { userId: string }) => {
      setParticipants((prev) => {
        const m = new Map(prev);
        m.forEach((p, k) => { if (p.userId === data.userId) m.set(k, { ...p, isScreenSharing: false }); });
        return m;
      });
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

    // NEW: room ended/deleted by host
    hub.on('RoomEnded', (data: { reason: RoomEndReason }) => {
      setRoomEnded(data?.reason ?? 'ended');
    });

    const startHub = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
          localStreamRef.current = stream;
          setLocalStream(stream);
          setCameraOn(false); cameraOnRef.current = false;
          setMediaError('Камеру не знайдено — лише мікрофон');
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
          if (hub.state === signalR.HubConnectionState.Connected) {
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
  const toggleMic = useCallback(() => {
    const next = !micOnRef.current;
    micOnRef.current = next;
    setMicOn(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = next; });
    hubRef.current?.invoke('SetMediaState', roomId, next, cameraOnRef.current).catch(() => {});
  }, [roomId]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOnRef.current;
    cameraOnRef.current = next;
    setCameraOn(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = next; });
    hubRef.current?.invoke('SetMediaState', roomId, micOnRef.current, next).catch(() => {});
  }, [roomId]);

  const renegotiate = useCallback(async (connId: string, pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await hubRef.current?.invoke('SendOffer', roomId, connId, JSON.stringify(offer));
    } catch (err) { console.error('renegotiate error', err); }
  }, [roomId]);

  const startScreenShare = useCallback(async () => {
    try {
      const screen = await (navigator.mediaDevices as MediaDevices & {
        getDisplayMedia: (c?: MediaStreamConstraints) => Promise<MediaStream>;
      }).getDisplayMedia({ video: true, audio: true });

      screenStreamRef.current = screen;
      setScreenStream(screen);
      const screenTrack = screen.getVideoTracks()[0];

      for (const [connId, pc] of peersRef.current) {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack).catch(() => {});
        } else {
          pc.addTrack(screenTrack, screen);
          await renegotiate(connId, pc);
        }
      }

      screenTrack.addEventListener('ended', () => stopScreenShare());
      setScreenSharing(true);
      await hubRef.current?.invoke('StartScreenShare', roomId).catch(() => {});
    } catch (err) {
      console.error('Screen share error:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, renegotiate]);

  const stopScreenShare = useCallback(async () => {
    if (!screenStreamRef.current) return;
    screenStreamRef.current.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);

    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
    for (const [connId, pc] of peersRef.current) {
      const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (videoSender) {
        if (cameraTrack) {
          await videoSender.replaceTrack(cameraTrack).catch(() => {});
        } else {
          try { pc.removeTrack(videoSender); } catch { /* ignore */ }
          await renegotiate(connId, pc);
        }
      }
    }

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

  const leave = useCallback(async () => {
    try {
      if (hubRef.current?.state === signalR.HubConnectionState.Connected) {
        await hubRef.current.invoke('LeaveRoom', roomId);
      }
    } catch { /* ignore */ }
  }, [roomId]);

  return {
    localStream, screenStream, participants, messages, micOn, cameraOn, screenSharing, connected,
    participantCount, strokes, whiteboardClear, raisedHands, roomEnded, mediaError,
    toggleMic, toggleCamera, startScreenShare, stopScreenShare,
    sendChatMessage, sendStroke, clearWhiteboard, raiseHand, leave,
  };
}
