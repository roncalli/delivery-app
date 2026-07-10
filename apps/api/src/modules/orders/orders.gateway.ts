import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UserRole } from '@prisma/client';
import { WS_EVENTS } from '@delivery/shared';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';

type AuthedSocket = Socket & { user?: JwtPayload };

/**
 * Tempo real dos pedidos.
 * Conexão: socket.io com { auth: { token: <accessToken> } }.
 * Salas: customer:{userId} (auto), admin (auto para ADMIN),
 * store:{storeId} (via mensagem "join:store", com validação de posse).
 */
@WebSocketGateway({
  namespace: '/ws',
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' },
})
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthedSocket) {
    const token = client.handshake.auth?.token as string | undefined;
    try {
      if (!token) throw new Error('sem token');
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (payload.type === 'refresh') throw new Error('refresh token não vale');
      client.user = payload;
    } catch {
      client.emit('error', { message: 'Não autenticado' });
      client.disconnect(true);
      return;
    }

    // Salas automáticas por papel
    client.join(`customer:${client.user.sub}`);
    if (client.user.role === UserRole.ADMIN) client.join('admin');
  }

  /** Lojista entra na sala da própria loja para receber pedidos. */
  @SubscribeMessage('join:store')
  async joinStore(@ConnectedSocket() client: AuthedSocket, @MessageBody() storeId: string) {
    const user = client.user;
    if (!user) return { ok: false, message: 'Não autenticado' };

    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        ...(user.role === UserRole.ADMIN ? {} : { ownerId: user.sub }),
      },
    });
    if (!store) return { ok: false, message: 'Loja não encontrada' };

    client.join(`store:${storeId}`);
    return { ok: true };
  }

  // --- Emissões (chamadas pelo OrdersService APÓS o commit) ---

  emitOrderCreated(storeId: string, order: unknown) {
    this.server.to(`store:${storeId}`).emit(WS_EVENTS.ORDER_CREATED, order);
  }

  emitStatusChanged(params: {
    orderId: string;
    storeId: string;
    customerId: string;
    status: string;
  }) {
    const payload = {
      orderId: params.orderId,
      status: params.status,
      changedAt: new Date().toISOString(),
    };
    this.server
      .to(`store:${params.storeId}`)
      .to(`customer:${params.customerId}`)
      .emit(WS_EVENTS.ORDER_STATUS_CHANGED, payload);
  }

  emitOrderStuck(order: { id: string; number: number; storeId: string }) {
    this.server.to('admin').emit(WS_EVENTS.ORDER_STUCK, order);
    this.logger.warn(`Pedido #${order.number} sem aceite do lojista (${order.storeId})`);
  }
}
