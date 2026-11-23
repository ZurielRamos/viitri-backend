import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDisk, type StorageDisk } from '@nestjs/storage';
import { Repository } from 'typeorm';
import {
  MAX_IMAGE_BYTES,
  optimizeImage,
} from '../../storage/optimize-image.js';
import {
  APP_ICON_VARIANTS,
  appIconKey,
  buildAppIcons,
} from '../../storage/app-icons.js';
import { IMAGES_DISK } from '../../storage/storage.config.js';
import { BusinessProfile } from '../entities/business-profile.entity.js';

export const IMAGE_KINDS = ['logo', 'cover'] as const;
export type ImageKind = (typeof IMAGE_KINDS)[number];

export { MAX_IMAGE_BYTES };

/**
 * Tamaño y proporción final de cada imagen: logo 1:1 y portada 2:1. La web
 * ya las envía recortadas; si no, se recorta al centro.
 */
export const IMAGE_SIZES: Record<ImageKind, { width: number; height: number }> =
  {
    logo: { width: 512, height: 512 },
    cover: { width: 1600, height: 800 },
  };

const FIELD: Record<ImageKind, 'logoUrl' | 'coverUrl'> = {
  logo: 'logoUrl',
  cover: 'coverUrl',
};

@Injectable()
export class BusinessImagesService {
  constructor(
    @InjectDisk(IMAGES_DISK) private readonly images: StorageDisk,
    @InjectRepository(BusinessProfile)
    private readonly profiles: Repository<BusinessProfile>,
  ) {}

  /** Optimiza la imagen, la guarda, la asigna al perfil y borra la anterior. */
  async replace(
    businessId: string,
    kind: ImageKind,
    file: Buffer,
  ): Promise<{ url: string }> {
    const webp = await optimizeImage(file, IMAGE_SIZES[kind]);
    // Nombre nuevo en cada subida: el celular y la CDN nunca ven una versión vieja.
    const key = `businesses/${businessId}/${kind}-${randomUUID()}.webp`;
    await this.images.put(key, webp, {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=31536000, immutable',
    });

    // Del logo salen el favicon y los íconos de la app, guardados a su lado.
    if (kind === 'logo') {
      for (const { variant, png } of await buildAppIcons(webp)) {
        await this.images.put(appIconKey(key, variant), png, {
          contentType: 'image/png',
          cacheControl: 'public, max-age=31536000, immutable',
        });
      }
    }
    const url = this.images.url(key);
    const previous = await this.swap(businessId, kind, url);
    await this.deleteIfOurs(previous);
    return { url };
  }

  /** Quita la imagen del perfil y la borra del almacenamiento. */
  async remove(businessId: string, kind: ImageKind): Promise<void> {
    const previous = await this.swap(businessId, kind, null);
    await this.deleteIfOurs(previous);
  }

  /** Cambia la URL en el perfil y devuelve la que tenía. */
  private async swap(
    businessId: string,
    kind: ImageKind,
    url: string | null,
  ): Promise<string | null> {
    const profile = await this.profiles.findOneByOrFail({ businessId });
    const previous = profile[FIELD[kind]];
    await this.profiles.update({ businessId }, { [FIELD[kind]]: url });
    return previous;
  }

  /**
   * Solo borra archivos de nuestro almacenamiento, no enlaces externos. Con
   * un logo se van también sus íconos (los logos viejos pueden no tenerlos).
   */
  private async deleteIfOurs(url: string | null): Promise<void> {
    if (!url) return;
    const base = this.images.url('x').slice(0, -1);
    if (!url.startsWith(base)) return;
    const key = url.slice(base.length);
    await this.images.delete(key);
    if (/\/logo-[^/]+\.webp$/.test(key)) {
      for (const variant of APP_ICON_VARIANTS) {
        await this.images
          .delete(appIconKey(key, variant))
          .catch(() => undefined);
      }
    }
  }
}
