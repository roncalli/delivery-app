import { UserRole } from '@prisma/client';

/** Payload do access token. Anexado a request.user pelo JwtAuthGuard. */
export interface JwtPayload {
  sub: string; // user id
  role: UserRole;
  type?: 'refresh'; // presente apenas no refresh token
  jti?: string; // id do refresh token (rotação)
}
