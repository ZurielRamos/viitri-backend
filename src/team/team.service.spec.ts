import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { DataSource, Repository } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthService } from '../auth/auth.service.js';
import type { BusinessMember } from '../businesses/entities/business-member.entity.js';
import type { Business } from '../businesses/entities/business.entity.js';
import type { TtlStore } from '../common/ttl-store/ttl-store.js';
import type { User } from '../users/entities/user.entity.js';
import { TeamService } from './team.service.js';

const KEY = 'abcdefghijkl';

describe('TeamService: entrar solo con el PIN', () => {
  /** Perfiles guardados: pinLookup → usuario. */
  let byLookup: Map<string, User>;
  let business: Business | null;
  let ttlValues: Map<string, number>;
  let auth: { issueTeamToken: ReturnType<typeof vi.fn> };
  let service: TeamService;
  let lookupOf: (pin: string) => string;

  beforeEach(() => {
    business = {
      id: 'b1',
      slug: 'donde-pepe',
      plan: 'advanced',
      trialEndsAt: new Date(Date.now() + 86_400_000),
      paidUntil: null,
    } as Business;
    byLookup = new Map();
    ttlValues = new Map();
    const qb = {
      where: () => qb,
      andWhere: () => qb,
      getOne: () => Promise.resolve(business),
    };
    const businesses = { createQueryBuilder: vi.fn(() => qb) };
    const users = {
      findOne: vi.fn(({ where }: { where: { pinLookup: string } }) =>
        Promise.resolve(byLookup.get(where.pinLookup) ?? null),
      ),
    };
    const ttl = {
      setIfAbsent: vi.fn((k: string, v: number) => {
        if (!ttlValues.has(k)) ttlValues.set(k, v);
        return Promise.resolve(true);
      }),
      mutate: vi.fn(
        (
          k: string,
          fn: (c: number | null) => { value?: number | null; result: unknown },
        ) => {
          const current = ttlValues.get(k) ?? null;
          const { value, result } = fn(current);
          if (current !== null && typeof value === 'number')
            ttlValues.set(k, value);
          return Promise.resolve(result);
        },
      ),
    };
    auth = {
      issueTeamToken: vi
        .fn()
        .mockImplementation((user: User) =>
          Promise.resolve({ accessToken: 't', user }),
        ),
    };
    service = new TeamService(
      {} as DataSource,
      auth as unknown as AuthService,
      ttl as unknown as TtlStore,
      { getOrThrow: () => 'x'.repeat(32) } as unknown as ConfigService,
      users as unknown as Repository<User>,
      businesses as unknown as Repository<Business>,
      {} as Repository<BusinessMember>,
    );
    lookupOf = (pin) =>
      (
        service as unknown as {
          pinLookup: (b: string, p: string) => string;
        }
      ).pinLookup('b1', pin);
    byLookup.set(lookupOf('1234'), { id: 'carlos', name: 'Carlos' } as User);
    byLookup.set(lookupOf('5678'), { id: 'ana', name: 'Ana' } as User);
  });

  it('el PIN identifica a la persona', async () => {
    const result = await service.login('donde-pepe', null, { pin: '5678' });
    expect(result.user).toMatchObject({ id: 'ana' });
  });

  it('el mismo PIN da otro valor en otro negocio', () => {
    const other = (
      service as unknown as { pinLookup: (b: string, p: string) => string }
    ).pinLookup('b2', '1234');
    expect(other).not.toBe(lookupOf('1234'));
  });

  it('rechaza un PIN que no es de nadie', async () => {
    await expect(
      service.login('donde-pepe', null, { pin: '0000' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auth.issueTeamToken).not.toHaveBeenCalled();
  });

  it('desde la tienda, pausa el negocio tras 10 PIN equivocados; con el enlace sigue entrando', async () => {
    for (let i = 0; i < 10; i++) {
      await expect(
        service.login('donde-pepe', null, { pin: '0000' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    await expect(
      service.login('donde-pepe', null, { pin: '1234' }),
    ).rejects.toMatchObject({ status: 429 });
    await expect(
      service.login('donde-pepe', KEY, { pin: '1234' }),
    ).resolves.toMatchObject({ user: { id: 'carlos' } });
  });

  it('con una clave del enlace equivocada responde 404', async () => {
    business = null;
    await expect(
      service.login('donde-pepe', KEY, { pin: '1234' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.login('donde-pepe', 'x', { pin: '1234' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sin colaboradores en el plan vigente (prueba vencida), no deja entrar', async () => {
    business!.trialEndsAt = new Date(Date.now() - 1000);
    await expect(
      service.login('donde-pepe', null, { pin: '1234' }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
