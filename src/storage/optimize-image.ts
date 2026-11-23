import {
  BadRequestException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { detectContentType } from '@nestjs/storage';
import sharp from 'sharp';

/** Fotos de celular de hasta 15 MB; la imagen guardada pesa mucho menos. */
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const ACCEPTED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
]);

/**
 * Gira según la cámara, recorta al centro al tamaño pedido y convierte a
 * WebP. sharp no copia los metadatos (EXIF con la ubicación GPS de la foto)
 * salvo que se le pida.
 */
export async function optimizeImage(
  file: Buffer,
  size: { width: number; height: number },
  { quality = 82 }: { quality?: number } = {},
): Promise<Buffer> {
  const type = detectContentType(file.subarray(0, 16));
  if (!type || !ACCEPTED.has(type)) {
    throw new UnsupportedMediaTypeException(
      'Sube una foto en formato JPG, PNG o WebP.',
    );
  }
  try {
    return await sharp(file)
      .rotate()
      .resize({ ...size, fit: 'cover', position: 'centre' })
      .webp({ quality })
      .toBuffer();
  } catch {
    throw new BadRequestException(
      'No pudimos leer esa imagen. Prueba con otra foto.',
    );
  }
}
