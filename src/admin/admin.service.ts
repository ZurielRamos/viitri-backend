import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Brackets, DataSource, Repository } from 'typeorm';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessMember } from '../businesses/entities/business-member.entity.js';
import { Business } from '../businesses/entities/business.entity.js';
import {
  monthlyCharge,
  planStatus,
  type Plan,
} from '../businesses/plans/plans.js';
import { escapeLike } from '../common/sql.js';
import { storeUrl } from '../common/store-url.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { CreateAdminUserDto } from './dto/create-admin-user.dto.js';
import type { ListBusinessesQueryDto } from './dto/list-businesses.dto.js';
import type { ListUsersQueryDto } from './dto/list-users.dto.js';
import {
  expiresWithinSql,
  PLAN_PRICE_SQL,
  PLAN_STATUS_SQL,
  type PlanStatusFilter,
} from './plan-status-sql.js';

/** Zona horaria de los reportes del panel (el equipo trabaja en Colombia). */
const REPORT_TZ = 'America/Bogota';
/** Días de la gráfica de registros. */
const SERIES_DAYS = 14;

type BusinessWithOwner = Business & { ownerMember?: BusinessMember };

/** Estado del plan en una palabra, para mostrar y filtrar. */
function statusOf(business: Business): PlanStatusFilter {
  const s = planStatus(business);
  if (business.plan === 'basic') return 'basic';
  if (s.expired) return 'expired';
  if (s.graceDaysLeft !== null) return 'grace';
  if (s.paidDaysLeft !== null) return 'paid';
  return 'trial';
}

const num = (value: unknown) => Number(value ?? 0);

/** Consultas del panel del equipo de viitri, por encima de los negocios. */
@Injectable()
export class AdminService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(BusinessMember)
    private readonly memberRepo: Repository<BusinessMember>,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async stats() {
    const [users] = await this.dataSource.query<Record<string, string>[]>(`
      SELECT
        count(*) FILTER (WHERE team_business_id IS NULL) AS accounts,
        count(*) FILTER (WHERE team_business_id IS NULL AND created_at > now() - interval '7 days') AS new7,
        count(*) FILTER (WHERE team_business_id IS NULL AND created_at > now() - interval '30 days') AS new30,
        count(*) FILTER (WHERE platform_role = 'super_admin') AS super_admins,
        count(*) FILTER (WHERE team_business_id IS NOT NULL) AS team_profiles
      FROM users`);

    const [biz] = await this.dataSource.query<Record<string, string>[]>(`
      SELECT
        count(*) AS total,
        count(*) FILTER (WHERE b.created_at > now() - interval '7 days') AS new7,
        count(*) FILTER (WHERE ${PLAN_STATUS_SQL.basic}) AS basic,
        count(*) FILTER (WHERE ${PLAN_STATUS_SQL.trial}) AS trial,
        count(*) FILTER (WHERE ${PLAN_STATUS_SQL.paid}) AS paid,
        count(*) FILTER (WHERE ${PLAN_STATUS_SQL.grace}) AS grace,
        count(*) FILTER (WHERE ${PLAN_STATUS_SQL.expired}) AS expired,
        count(*) FILTER (WHERE ${expiresWithinSql(7)}) AS expiring7,
        COALESCE(sum(${PLAN_PRICE_SQL}) FILTER (WHERE ${PLAN_STATUS_SQL.paid}), 0) AS mrr
      FROM businesses b`);

    const [orders] = await this.dataSource.query<Record<string, string>[]>(`
      SELECT
        count(*) FILTER (WHERE created_at > now() - interval '30 days') AS last30,
        count(*) FILTER (WHERE (created_at AT TIME ZONE '${REPORT_TZ}')::date = (now() AT TIME ZONE '${REPORT_TZ}')::date) AS today
      FROM orders
      WHERE status NOT IN ('rejected', 'cancelled')`);

    const series = await this.dataSource.query<
      { day: string; users: string; businesses: string }[]
    >(
      `
      WITH days AS (
        SELECT generate_series(
          (now() AT TIME ZONE $1)::date - ($2::int - 1),
          (now() AT TIME ZONE $1)::date,
          interval '1 day'
        )::date AS day
      )
      SELECT
        to_char(d.day, 'YYYY-MM-DD') AS day,
        (SELECT count(*) FROM users u
          WHERE u.team_business_id IS NULL
            AND (u.created_at AT TIME ZONE $1)::date = d.day) AS users,
        (SELECT count(*) FROM businesses b
          WHERE (b.created_at AT TIME ZONE $1)::date = d.day) AS businesses
      FROM days d
      ORDER BY d.day`,
      [REPORT_TZ, SERIES_DAYS],
    );

    return {
      users: {
        total: num(users.accounts),
        new7: num(users.new7),
        new30: num(users.new30),
        superAdmins: num(users.super_admins),
        teamProfiles: num(users.team_profiles),
      },
      businesses: {
        total: num(biz.total),
        new7: num(biz.new7),
        byStatus: {
          basic: num(biz.basic),
          trial: num(biz.trial),
          paid: num(biz.paid),
          grace: num(biz.grace),
          expired: num(biz.expired),
        },
        expiring7: num(biz.expiring7),
      },
      /** Lo que entra al mes por los planes pagados y vigentes, en COP. */
      mrr: num(biz.mrr),
      orders: { last30: num(orders.last30), today: num(orders.today) },
      signups: series.map((row) => ({
        day: row.day,
        users: num(row.users),
        businesses: num(row.businesses),
      })),
    };
  }

  async listUsers(query: ListUsersQueryDto) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .orderBy('u.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);
    const search = query.search?.trim();
    if (search) {
      const term = `%${escapeLike(search)}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('u.name ILIKE :term', { term })
            .orWhere('u.email ILIKE :term', { term })
            .orWhere('u.phone ILIKE :digits', {
              digits: `%${escapeLike(search.replace(/\D/g, '') || search)}%`,
            }),
        ),
      );
    }
    if (query.role) qb.andWhere('u.platformRole = :role', { role: query.role });
    if (query.kind === 'account') qb.andWhere('u.teamBusinessId IS NULL');
    if (query.kind === 'team') qb.andWhere('u.teamBusinessId IS NOT NULL');
    const [items, total] = await qb.getManyAndCount();
    const counts = await this.membershipCounts('user_id', items);
    return {
      items: items.map((u) =>
        Object.assign(u, { businessCount: counts.get(u.id) ?? 0 }),
      ),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /** Membresías por usuario o por negocio, en una sola consulta. */
  private async membershipCounts(
    column: 'user_id' | 'business_id',
    rows: { id: string }[],
  ): Promise<Map<string, number>> {
    if (!rows.length) return new Map();
    const result = await this.dataSource.query<{ id: string; n: string }[]>(
      `SELECT ${column} AS id, count(*) AS n FROM business_members
       WHERE ${column} = ANY($1::uuid[]) GROUP BY ${column}`,
      [rows.map((r) => r.id)],
    );
    return new Map(result.map((r) => [r.id, Number(r.n)]));
  }

  async getUser(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: { teamBusiness: true },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado.');
    const memberships = await this.memberRepo.find({
      where: { userId: id },
      relations: { business: true },
      order: { createdAt: 'ASC' },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      platformRole: user.platformRole,
      hasGoogle: user.googleSub !== null,
      referralSource: user.referralSource,
      acquisition: user.acquisition,
      marketingOptInAt: user.marketingOptInAt,
      termsAcceptedAt: user.termsAcceptedAt,
      onboardedAt: user.onboardedAt,
      createdAt: user.createdAt,
      teamBusiness: user.teamBusiness
        ? {
            id: user.teamBusiness.id,
            name: user.teamBusiness.name,
            slug: user.teamBusiness.slug,
          }
        : null,
      memberships: memberships.map((m) => ({
        role: m.role,
        joinedAt: m.createdAt,
        business: {
          id: m.business.id,
          name: m.business.name,
          slug: m.business.slug,
          plan: m.business.plan,
          status: statusOf(m.business),
        },
      })),
    };
  }

  /** Persona del equipo de viitri: entra al panel con correo y contraseña. */
  async createUser(dto: CreateAdminUserDto) {
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash: await argon2.hash(dto.password),
      // Creada por el equipo: los términos aplican a los dueños de negocios.
      termsAcceptedAt: new Date(),
    });
    if (dto.platformRole !== user.platformRole) {
      await this.users.setPlatformRole(user.id, dto.platformRole);
    }
    return this.getUser(user.id);
  }

  async listBusinesses(query: ListBusinessesQueryDto) {
    const qb = this.businessQuery()
      .orderBy('b.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);
    const search = query.search?.trim();
    if (search) {
      const term = `%${escapeLike(search)}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where('b.name ILIKE :term', { term })
            .orWhere('b.slug ILIKE :term', { term })
            .orWhere('ou.email ILIKE :term', { term })
            .orWhere('ou.name ILIKE :term', { term }),
        ),
      );
    }
    if (query.plan) qb.andWhere('b.plan = :plan', { plan: query.plan });
    if (query.status) qb.andWhere(PLAN_STATUS_SQL[query.status]);
    const [items, total] = await qb.getManyAndCount();
    const counts = await this.membershipCounts('business_id', items);
    return {
      items: items.map((b) => this.toBusinessRow(b, counts.get(b.id) ?? 0)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getBusiness(id: string) {
    const business = await this.businessQuery()
      .where('b.id = :id', { id })
      .getOne();
    if (!business) throw new NotFoundException('Negocio no encontrado.');
    const members = await this.memberRepo.find({
      where: { businessId: id },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    const teamProfiles = await this.userRepo.countBy({ teamBusinessId: id });
    const row = this.toBusinessRow(business, members.length);
    const [orders] = await this.dataSource.query<Record<string, string>[]>(
      `SELECT
         count(*) AS total,
         count(*) FILTER (WHERE created_at > now() - interval '30 days') AS last30,
         max(created_at) AS last_at
       FROM orders
       WHERE business_id = $1 AND status NOT IN ('rejected', 'cancelled')`,
      [id],
    );
    const profile = business.profile;
    return {
      ...row,
      features: business.features,
      freeBasic: business.freeBasic,
      monthlyCharge: monthlyCharge(business),
      profile: profile && {
        description: profile.description,
        phone: profile.phone,
        city: profile.city,
        addressLine: profile.addressLine,
        currency: profile.currency,
        timezone: profile.timezone,
      },
      members: members.map((m) => ({
        role: m.role,
        joinedAt: m.createdAt,
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          phone: m.user.phone,
        },
      })),
      teamProfiles,
      orders: {
        total: num(orders.total),
        last30: num(orders.last30),
        lastAt: orders.last_at ?? null,
      },
    };
  }

  /** Negocio con su perfil, el propietario y cuántas personas tiene. */
  private businessQuery() {
    return this.businessRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.profile', 'p')
      .leftJoinAndMapOne(
        'b.ownerMember',
        BusinessMember,
        'om',
        'om.businessId = b.id AND om.role = :owner',
        { owner: BusinessRole.Owner },
      )
      .leftJoinAndSelect('om.user', 'ou');
  }

  private toBusinessRow(b: BusinessWithOwner, memberCount: number) {
    const owner = b.ownerMember?.user;
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      plan: b.plan as Plan,
      businessType: b.businessType,
      trialEndsAt: b.trialEndsAt,
      paidUntil: b.paidUntil,
      createdAt: b.createdAt,
      ...planStatus(b),
      status: statusOf(b),
      logoUrl: b.profile?.logoUrl ?? null,
      city: b.profile?.city ?? null,
      storeUrl: storeUrl(this.config, b.slug),
      memberCount,
      owner: owner
        ? {
            id: owner.id,
            name: owner.name,
            email: owner.email,
            phone: owner.phone,
          }
        : null,
    };
  }
}
