import { useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import api from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type { Action } from './types';

interface UseMultiplayerOptions {
  roomCode: string | null;
  dispatch: React.Dispatch<Action>;
}

export function useMultiplayer({ roomCode, dispatch }: UseMultiplayerOptions) {
  const { token } = useAuthStore();
  const connRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    if (!roomCode || !token) return;

    const conn = new signalR.HubConnectionBuilder()
      .withUrl('/hubs/civ', { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    conn.on('CivTurnUpdate', (data: { stateJson: string }) => {
      dispatch({ type: 'MULTIPLAYER_TURN_RECEIVED', stateJson: data.stateJson });
    });

    conn.on('CivPlayerJoined', (data: { name: string }) => {
      dispatch({ type: 'CHAT_RECEIVED', from: 'Система', text: `✅ ${data.name} приєднався до кімнати!` });
    });

    conn.on('CivChat', (data: { from: string; text: string }) => {
      dispatch({ type: 'CHAT_RECEIVED', from: data.from, text: data.text });
    });

    conn.on('CivRoomClosed', (data: { by: string }) => {
      dispatch({ type: 'CHAT_RECEIVED', from: 'Система', text: `❌ ${data.by} залишив гру. Кімнату закрито.` });
    });

    conn.start()
      .then(() => conn.invoke('JoinRoom', roomCode))
      .catch(err => console.error('CivHub connect error:', err));

    connRef.current = conn;
    return () => { conn.stop(); connRef.current = null; };
  }, [roomCode, token, dispatch]);

  const submitTurn = useCallback(async (stateJson: string) => {
    if (!roomCode) return;
    try {
      await api.post(`/civ/rooms/${roomCode}/turn`, { stateJson });
    } catch (e) {
      console.error('Failed to submit turn:', e);
    }
  }, [roomCode]);

  const sendChat = useCallback(async (text: string) => {
    if (!roomCode) return;
    try {
      await api.post(`/civ/rooms/${roomCode}/chat`, { text });
    } catch (e) {
      console.error('Failed to send chat:', e);
    }
  }, [roomCode]);

  return { submitTurn, sendChat };
}

export async function createRoom(): Promise<string> {
  const res = await api.post<{ code: string }>('/civ/rooms');
  return res.data.code;
}

export async function joinRoom(code: string) {
  const res = await api.post(`/civ/rooms/${code}/join`);
  return res.data;
}

export async function setReady(code: string, civId: string) {
  await api.post(`/civ/rooms/${code}/ready`, { civId });
}
