import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { InjectDisk, serveFile, type StorageDisk } from '@nestjs/storage';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { IMAGES_DISK, PUBLIC_MEDIA_PREFIX } from './storage.config.js';

/**
 * Sirve las imágenes de los negocios desde el almacenamiento. El bucket
 * queda privado; esta ruta solo da acceso a la carpeta pública. Cada imagen
 * tiene un nombre único, así que se cachea por un año.
 */
@Public()
@Controller('media')
export class MediaController {
  constructor(@InjectDisk(IMAGES_DISK) private readonly images: StorageDisk) {}

  @Get('*key')
  serve(
    @Param('key') key: string | string[],
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const path = Array.isArray(key) ? key.join('/') : key;
    // Nada fuera de businesses/: el bucket puede tener otros archivos del proyecto.
    if (!path.startsWith(PUBLIC_MEDIA_PREFIX)) throw new NotFoundException();
    return serveFile(this.images, path, { req, res, disposition: 'inline' });
  }
}
