import { InMemoryDisk } from '@nestjs/storage';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessImagesService } from './business-images.service.js';

describe('BusinessImagesService', () => {
  let disk: InMemoryDisk;
  let profile: { logoUrl: string | null; coverUrl: string | null };
  let service: BusinessImagesService;

  beforeEach(() => {
    disk = new InMemoryDisk({ publicUrl: 'https://cdn.test/bucket' });
    profile = { logoUrl: null, coverUrl: null };
    const profiles = {
      findOneByOrFail: vi.fn(async () => ({ ...profile })),
      update: vi.fn(async (_where: unknown, data: Partial<typeof profile>) =>
        Object.assign(profile, data),
      ),
    };
    service = new BusinessImagesService(disk, profiles as never);
  });

  /** Una foto grande con EXIF, como la de un celular. */
  const photo = () =>
    sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#0b5cff' },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'gps' } } })
      .toBuffer();

  it('guarda el logo reducido, en WebP y sin metadatos', async () => {
    const { url } = await service.replace('b1', 'logo', await photo());

    expect(url).toMatch(
      /^https:\/\/cdn\.test\/bucket\/businesses\/b1\/logo-.+\.webp$/,
    );
    const stored = await disk.getBuffer(
      url.replace('https://cdn.test/bucket/', ''),
    );
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe('webp');
    expect([meta.width, meta.height]).toEqual([512, 512]);
    expect(meta.exif).toBeUndefined();
    expect(profile.logoUrl).toBe(url);
  });

  it('al reemplazar, borra la imagen anterior y sus íconos', async () => {
    const first = await service.replace('b1', 'logo', await photo());
    const second = await service.replace('b1', 'logo', await photo());
    const firstKey = first.url.replace('https://cdn.test/bucket/', '');
    const secondKey = second.url.replace('https://cdn.test/bucket/', '');

    // El logo nuevo y sus 5 íconos; nada del anterior.
    expect(disk.keys()).toHaveLength(6);
    expect(disk.keys()).toContain(secondKey);
    expect(disk.keys()).toContain(secondKey.replace('.webp', '-icon-512.png'));
    expect(
      disk.keys().some((k) => k.startsWith(firstKey.replace('.webp', ''))),
    ).toBe(false);
  });

  it('no borra enlaces externos', async () => {
    profile.coverUrl = 'https://otro-sitio.com/foto.jpg';
    await service.remove('b1', 'cover');
    expect(profile.coverUrl).toBeNull();
  });

  it('rechaza archivos que no son imágenes', async () => {
    await expect(
      service.replace('b1', 'logo', Buffer.from('<svg onload=alert(1)>')),
    ).rejects.toMatchObject({
      status: 415,
    });
  });

  it('la portada queda en 2:1 aunque la foto sea vertical', async () => {
    const vertical = await sharp({
      create: { width: 900, height: 1600, channels: 3, background: '#fff' },
    })
      .jpeg()
      .toBuffer();
    const { url } = await service.replace('b1', 'cover', vertical);
    const meta = await sharp(
      await disk.getBuffer(url.replace('https://cdn.test/bucket/', '')),
    ).metadata();
    expect([meta.width, meta.height]).toEqual([1600, 800]);
  });
});
