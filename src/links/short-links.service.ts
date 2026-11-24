import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { isUniqueViolation } from '../common/database-errors.js';
import { ShortLink } from './short-link.entity.js';

const DAY_MS = 86_400_000;
/** Sin 0/O ni 1/l/I: se leen bien si alguien los copia a mano. */
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newCode(length = 8): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

@Injectable()
export class ShortLinksService {
  constructor(
    @InjectRepository(ShortLink) private readonly links: Repository<ShortLink>,
  ) {}

  /** Crea un enlace corto. `days`: cuánto dura (por defecto, 60 días). */
  async create(url: string, days = 60): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newCode();
      try {
        await this.links.insert({
          code,
          url,
          expiresAt: new Date(Date.now() + days * DAY_MS),
        });
        return code;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new Error('No se pudo crear el enlace corto.');
  }

  /** La dirección real de un código vigente. */
  async resolve(code: string): Promise<string> {
    if (!/^[A-Za-z0-9]{4,16}$/.test(code))
      throw new NotFoundException('Enlace no encontrado.');
    const link = await this.links.findOneBy({ code });
    if (!link || (link.expiresAt && link.expiresAt.getTime() < Date.now())) {
      throw new NotFoundException('Este enlace ya venció.');
    }
    return link.url;
  }
}
