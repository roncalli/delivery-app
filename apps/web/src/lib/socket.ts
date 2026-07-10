import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

/** Conecta ao namespace /ws com o access token da sessão da área atual. */
export function createSocket(): Socket {
  const token = getAccessToken();
  return io(`${WS_URL}/ws`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
}
