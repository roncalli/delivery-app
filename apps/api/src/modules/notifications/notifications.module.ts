import { Module } from '@nestjs/common';

// Etapa 4+: push (Web Push/FCM), fallback WhatsApp e e-mails transacionais.
// Em dev, provider "mock" que só loga no console.
@Module({})
export class NotificationsModule {}
