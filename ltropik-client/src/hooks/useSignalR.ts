import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { useAuthStore } from '../store/authStore';

export function useSignalR(
  hubUrl: string,
  handlers: Record<string, (...args: unknown[]) => void>,
) {
  const { token } = useAuthStore();
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  useEffect(() => {
    if (!token) return;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, { accessTokenFactory: () => token })
      .withAutomaticReconnect()
      .build();

    Object.entries(handlers).forEach(([event, handler]) => {
      connection.on(event, handler);
    });

    connection.start().catch((err) => {
      if (err && err.toString().includes('stopped')) return;
      console.error(err);
    });
    connectionRef.current = connection;

    return () => {
      connection.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hubUrl]);

  return connectionRef;
}
