import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { UploadsService } from './uploads.service';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

@Roles(UserRole.STORE_OWNER, UserRole.ADMIN)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /** Upload de imagem (logo, capa, foto de produto). Campo multipart: "file". */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED.includes(file.mimetype)) {
          cb(new BadRequestException('Envie uma imagem JPG, PNG ou WebP'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado (campo "file")');
    return this.uploadsService.save(file);
  }
}
