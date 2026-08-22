import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SessionStatusEvent {
  sessionId: string;
  status: string;
  timestamp: string;
}

interface QRCodeEvent {
  sessionId: string;
  qrCode: string;
  timestamp: string;
}

interface MessageEvent {
  sessionId: string;
  message: Record<string, unknown>;
  timestamp: string;
}

interface WebSocketEvents {
  onSessionStatus?: (event: SessionStatusEvent) => void;
  onQRCode?: (event: QRCodeEvent) => void;
  onMessage?: (event: MessageEvent) => void;
}

/**
 * The gateway sends every server -> client message on the single socket.io
 * event named 'message'. The real event name lives in payload.event, so we
 * unwrap here instead of listening to per-event channels.
 */
interface ServerEnvelope {
  type: string;
  payload?: {
    event: string;
    sessionId: string;
    data: unknown;
  };
  timestamp: string;
}

// Use current origin for WebSocket (goes through nginx proxy in Docker)
// Falls back to env var or localhost for development
const SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin;

export function useWebSocket(events: WebSocketEvents = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Handlers are read through a ref so that a caller passing inline callbacks
  // does not tear down and rebuild the socket on every render.
  const handlersRef = useRef(events);
  useEffect(() => {
    handlersRef.current = events;
  });

  useEffect(() => {
    // Get API key from sessionStorage (same as api.ts)
    const apiKey = sessionStorage.getItem('openwa_api_key');

    if (!apiKey) {
      console.warn('[WebSocket] No API key found, skipping connection');
      return;
    }

    const socket = io(`${SOCKET_URL}/events`, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: {
        apiKey,
      },
      extraHeaders: {
        'X-API-Key': apiKey,
      },
      query: {
        apiKey,
      },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);

      // The gateway only forwards events to rooms the client has joined, and
      // rooms are dropped on every reconnect, so subscribe on each connect.
      socket.emit('message', { type: 'subscribe', sessionId: '*', events: ['*'] });
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', error => {
      console.warn('[WebSocket] Connection error:', error.message);
    });

    socket.on('message', (envelope: ServerEnvelope) => {
      if (envelope?.type !== 'event' || !envelope.payload) return;

      const { event, sessionId, data } = envelope.payload;
      const handlers = handlersRef.current;

      switch (event) {
        case 'session.status':
          handlers.onSessionStatus?.({
            sessionId,
            status: (data as { status?: string })?.status ?? '',
            timestamp: envelope.timestamp,
          });
          break;
        case 'session.qr':
          handlers.onQRCode?.({
            sessionId,
            qrCode: (data as { qrCode?: string })?.qrCode ?? '',
            timestamp: envelope.timestamp,
          });
          break;
        case 'message.received':
          handlers.onMessage?.({
            sessionId,
            message: data as Record<string, unknown>,
            timestamp: envelope.timestamp,
          });
          break;
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { isConnected };
}
