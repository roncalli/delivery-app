import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Armazenamento de imagens.
 * Dev: salva em ./uploads e serve estático em /uploads (ver main.ts).
 * Produção (TODO Etapa 9): trocar por R2/S3 com URL pré-assinada quando as
 * variáveis S3_* estiverem configuradas — a interface pública não muda.
 */
@Injectable()
export class UploadsService {
  private readonly dir = join(process.cwd(), 'uploads');

  constructor(private readonly config: ConfigService) {
    mkdirSync(this.dir, { recursive: true });
  }

  save(file: Express.Multer.File): { url: string } {
    const ext = EXT_BY_MIME[file.mimetype] ?? 'bin';
    const filename = `${randomUUID()}.${ext}`;
    writeFileSync(join(this.dir, filename), file.buffer);

    const base =
      this.config.get<string>('API_PUBLIC_URL') ??
      `http://localhost:${this.config.get<string>('API_PORT') ?? 3001}`;
    return { url: `${base}/uploads/${filename}` };
  }
}
