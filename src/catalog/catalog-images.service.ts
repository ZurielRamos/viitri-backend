import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDisk, type StorageDisk } from '@nestjs/storage';
import { optimizeImage } from '../storage/optimize-image.js';
import { IMAGES_DISK } from '../storage/storage.config.js';

/**
 * Fotos cuadradas, como una publicación: 1080 × 1080 (el tamaño de Instagram)
 * se ve nítida a pantalla completa en cualquier celular. La miniatura de
 * 320 × 320 es para las listas y la cuadrícula (cuadros de 80 a 130 px en
 * pantallas de 2x y 3x) y pesa unas diez veces menos.
 */
export const ITEM_IMAGE_SIZE = { width: 1080, height: 1080 };
export const ITEM_THUMB_SIZE = { width: 320, height: 320 };
/** Foto de una categoría: un círculo de 64 px en pantallas de 3x. */
export const CATEGORY_IMAGE_SIZE = { width: 192, height: 192 };

/** La miniatura vive junto a la foto: foto.webp → foto-thumb.webp. */
export function thumbKey(key: string): string {
  return key.replace(/\.webp$/, '-thumb.webp');
}

/**
 * Fotos de los elementos del catálogo. Se suben antes de crear o editar el
 * elemento, que luego guarda sus URLs; las que deja de usar se borran.
 */
@Injectable()
export class CatalogImagesService {
  private readonly logger = new Logger(CatalogImagesService.name);

  constructor(@InjectDisk(IMAGES_DISK) private readonly images: StorageDisk) {}

  /** Guarda la foto y su miniatura. El elemento guarda solo la URL de la foto. */
  async upload(
    businessId: string,
    file: Buffer,
  ): Promise<{ url: string; thumbUrl: string }> {
    const [full, thumb] = await Promise.all([
      optimizeImage(file, ITEM_IMAGE_SIZE),
      optimizeImage(file, ITEM_THUMB_SIZE, { quality: 75 }),
    ]);
    const key = `${prefix(businessId)}${randomUUID()}.webp`;
    const options = {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    };
    await Promise.all([
      this.images.put(key, full, options),
      this.images.put(thumbKey(key), thumb, options),
    ]);
    return {
      url: this.images.url(key),
      thumbUrl: this.images.url(thumbKey(key)),
    };
  }

  /** Foto de una categoría, pequeña y sin miniatura. */
  async uploadCategoryImage(
    businessId: string,
    file: Buffer,
  ): Promise<{ url: string }> {
    const webp = await optimizeImage(file, CATEGORY_IMAGE_SIZE, {
      quality: 80,
    });
    const key = `businesses/${businessId}/categories/${randomUUID()}.webp`;
    await this.images.put(key, webp, {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });
    return { url: this.images.url(key) };
  }

  /**
   * Borra las fotos de este negocio que ya no se usan. Ignora enlaces
   * externos y fotos de otros negocios. Un fallo no interrumpe la edición.
   */
  async deleteUnused(businessId: string, urls: string[]): Promise<void> {
    const base = this.images.url('x').slice(0, -1);
    const keys = urls
      .filter((url) => url.startsWith(base))
      .map((url) => url.slice(base.length))
      .filter((key) => key.startsWith(`businesses/${businessId}/`))
      // Las fotos de productos tienen miniatura; las de categorías, no.
      .flatMap((key) =>
        key.startsWith(prefix(businessId)) ? [key, thumbKey(key)] : [key],
      );
    if (!keys.length) return;
    try {
      await this.images.delete(keys);
    } catch (error) {
      this.logger.warn(
        `No se pudieron borrar fotos del catálogo: ${String(error)}`,
      );
    }
  }
}

function prefix(businessId: string): string {
  return `businesses/${businessId}/items/`;
}
