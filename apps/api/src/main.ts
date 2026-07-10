import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Imagens enviadas em dev (ver UploadsService); em produção vira R2/S3
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove campos não declarados nos DTOs
      transform: true,
    }),
  );

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
  console.log(`API rodando em http://localhost:${port}/api`);
}

bootstrap();
