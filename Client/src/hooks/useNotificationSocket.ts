/* ───────────────────────────────────────────────────────────────────────────
   useNotificationSocket — dedicated listener for the `notification` event on
   the project's existing Socket.IO connection.

   This mirrors useSocket.ts's own connection pattern exactly (same URL, same
   auth, same reconnection options) rather than introducing any new socket
   architecture. It exists as its own hook — instead of inlining a second
   io() call inside AppStore.tsx — for the same reason useSocket.ts is its
   own hook: one hook per real-time concern, each independently testable and
   each cleaning up its own connection.
─────────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getAccessToken } from '../api/client';
import type { ApiNotification } from '../types/notification';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4002';

interface UseNotificationSocketOptions {
  /** Only connects when true — pass `!!user` so there's no socket pre-login. */
  enabled: boolean;
  onNotification?: (notification: ApiNotification) => void;
}

interface UseNotificationSocketResult {
  connected: boolean;
}

export function useNotificationSocket({
  enabled,
  onNotification,
}: UseNotificationSocketOptions): UseNotificationSocketResult {
  const [connected, setConnected] = useState(false);
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

    let socket: Socket | null = null;
    let destroyed = false;

    async function connect() {
      try {
        const { io } = await import('socket.io-client');

        socket = io(SOCKET_URL, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 10,
          timeout: 8000,
          withCredentials: true,
          auth: {
            token: getAccessToken(),
          },
        });

        if (destroyed) {
          socket.disconnect();
          return;
        }

        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));
        socket.on('connect_error', () => setConnected(false));

        socket.on('notification', (data: ApiNotification) => {
          onNotificationRef.current?.(data);
        });
      } catch {
        setConnected(false);
      }
    }

    connect();

    return () => {
      destroyed = true;
      socket?.disconnect();
      setConnected(false);
    };
  }, [enabled]);

  return { connected };
}

export default useNotificationSocket;