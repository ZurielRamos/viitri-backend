import type { ConfigService } from '@nestjs/config';
import { LocalDisk, S3Disk, type StorageModuleOptions } from '@nestjs/storage';

/** Disco de imágenes de los negocios (logos y portadas). */
export const IMAGES_DISK = 'images';

/** Única carpeta que la API sirve en /media. */
export const PUBLIC_MEDIA_PREFIX = 'businesses/';

/**
 * Con STORAGE_BUCKET, las imágenes van a Google Cloud Storage por su API
 * compatible con S3 (claves HMAC). Sin él, en desarrollo se guardan en
 * var/uploads. En ambos casos la API las sirve en /media, y el bucket
 * puede seguir siendo privado.
 */
export function createStorageOptions(
  config: ConfigService,
): StorageModuleOptions {
  const bucket = config.get<string>('STORAGE_BUCKET');
  const apiUrl = config.get<string>('API_PUBLIC_URL', 'http://localhost:3000');
  const publicUrl = `${apiUrl}/media`;
  if (bucket) {
    return {
      default: IMAGES_DISK,
      disks: {
        [IMAGES_DISK]: new S3Disk({
          bucket,
          endpoint: 'https://storage.googleapis.com',
          region: 'auto',
          // El nombre del bucket tiene puntos: va en la ruta, no en el dominio.
          forcePathStyle: true,
          // GCS no admite el borrado por lotes de S3.
          batchDelete: false,
          credentials: {
            accessKeyId: config.getOrThrow<string>('STORAGE_HMAC_ACCESS_KEY'),
            secretAccessKey: config.getOrThrow<string>('STORAGE_HMAC_SECRET'),
          },
          publicUrl,
        }),
      },
    };
  }
  return {
    default: IMAGES_DISK,
    disks: {
      [IMAGES_DISK]: new LocalDisk({
        root: 'var/uploads',
        publicUrl,
      }),
    },
  };
}
