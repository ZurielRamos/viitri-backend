import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmtpTransport } from '@nestjs/mail';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { validateEnv } from '../config/env.validation.js';
import { vapidKeysMatch } from '../push/push.service.js';
import { User } from '../users/entities/user.entity.js';
import { PlatformSetting } from './platform-setting.entity.js';
import { ENV_DEFAULTS } from './settings-bootstrap.js';
import { encryptSetting, settingsKey } from './settings-crypto.js';
import {
  SETTING_GROUPS,
  settingGroup,
  type SettingField,
  type SettingGroup,
} from './settings.registry.js';

const MAX_LENGTH = 4096;
const TEST_TIMEOUT_MS = 10_000;

export type SettingSource = 'panel' | 'env' | null;

export interface TestResult {
  ok: boolean;
  message: string;
}

/** `••••a1b2`: deja reconocer la credencial sin mostrarla. */
function mask(value: string): string {
  return value.length >= 12 ? `••••${value.slice(-4)}` : '••••';
}

/** Credenciales de los servicios, guardadas cifradas y aplicadas sin reiniciar cuando se puede. */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly key: Buffer;
  /** Valor con el que arrancó la API, para saber qué falta reiniciar. */
  private readonly bootValues = new Map<string, string>();

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(PlatformSetting)
    private readonly settings: Repository<PlatformSetting>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    this.key = settingsKey({
      SETTINGS_ENCRYPTION_KEY: config.get<string>('SETTINGS_ENCRYPTION_KEY'),
      JWT_SECRET: config.get<string>('JWT_SECRET'),
      NODE_ENV: config.get<string>('NODE_ENV'),
    });
    for (const group of SETTING_GROUPS) {
      for (const field of group.fields) {
        if (field.restart)
          this.bootValues.set(field.key, this.value(field.key));
      }
    }
  }

  private value(key: string): string {
    return this.config.get<string>(key) ?? '';
  }

  async list() {
    const rows = await this.settings.find();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const editors = await this.users.findBy({
      id: In([
        ...new Set(rows.map((r) => r.updatedBy).filter(Boolean)),
      ] as string[]),
    });
    const editorName = new Map(editors.map((u) => [u.id, u.name]));

    const groups = SETTING_GROUPS.map((group) => {
      const fields = group.fields.map((field) => {
        const row = byKey.get(field.key);
        const value = this.value(field.key);
        const source: SettingSource = row
          ? 'panel'
          : ENV_DEFAULTS.get(field.key)
            ? 'env'
            : null;
        return {
          ...field,
          isSet: value !== '',
          value: field.secret ? null : value,
          preview: field.secret && value ? mask(value) : null,
          source,
          updatedAt: row?.updatedAt ?? null,
          updatedBy: row?.updatedBy
            ? (editorName.get(row.updatedBy) ?? null)
            : null,
        };
      });
      const setRequired = group.required.filter((k) => this.value(k)).length;
      return {
        id: group.id,
        name: group.name,
        description: group.description,
        docsUrl: group.docsUrl ?? null,
        testable: Boolean(group.testable),
        status:
          setRequired === group.required.length
            ? ('ready' as const)
            : setRequired > 0
              ? ('partial' as const)
              : ('off' as const),
        fields,
      };
    });
    return { groups, restartPending: this.restartPending() };
  }

  /** Claves que se leen al arrancar y cambiaron desde entonces. */
  private restartPending(): string[] {
    return [...this.bootValues]
      .filter(([k, v]) => this.value(k) !== v)
      .map(([k]) => k);
  }

  /**
   * `values`: texto para guardar; `null` para borrar lo del panel y volver al
   * `.env`. Las claves que no vienen no cambian.
   */
  async update(
    groupId: string,
    values: Record<string, unknown>,
    actorId: string,
  ) {
    const group = this.groupOrFail(groupId);
    const changes = this.parse(group, values);
    if (!changes.size)
      throw new BadRequestException('No hay cambios para guardar.');

    // Lo que regiría después del cambio: debe pasar la validación del arranque.
    const next = new Map(
      group.fields.map((f) => [f.key, this.value(f.key)] as const),
    );
    for (const [k, v] of changes) next.set(k, v ?? ENV_DEFAULTS.get(k) ?? '');
    this.checkGroup(group, next);
    try {
      validateEnv({ ...process.env, ...Object.fromEntries(next) });
    } catch (error) {
      throw new BadRequestException((error as Error).message.split('\n'));
    }

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PlatformSetting);
      const removed = [...changes]
        .filter(([, v]) => v === null)
        .map(([k]) => k);
      if (removed.length) await repo.delete({ key: In(removed) });
      const saved = [...changes].filter(([, v]) => v !== null);
      if (saved.length) {
        await repo.save(
          saved.map(([k, v]) =>
            repo.create({
              key: k,
              value: encryptSetting(v!, this.key),
              updatedBy: actorId,
            }),
          ),
        );
      }
    });

    for (const [k] of changes) this.config.set(k, next.get(k) ?? '');
    this.logger.log(
      `${group.name}: ${[...changes].map(([k, v]) => (v === null ? `${k} (vuelve al .env)` : k)).join(', ')} · por ${actorId}`,
    );
    return this.list();
  }

  /** Valida cada valor según su campo. */
  private parse(
    group: SettingGroup,
    values: Record<string, unknown>,
  ): Map<string, string | null> {
    const fields = new Map(group.fields.map((f) => [f.key, f]));
    const changes = new Map<string, string | null>();
    const errors: string[] = [];
    for (const [key, raw] of Object.entries(values)) {
      const field = fields.get(key);
      if (!field) {
        errors.push(`${key} no pertenece a ${group.name}.`);
        continue;
      }
      if (raw === null) {
        changes.set(key, null);
        continue;
      }
      if (typeof raw !== 'string') {
        errors.push(`${field.label}: debe ser texto.`);
        continue;
      }
      const value = raw.trim();
      const error = this.fieldError(field, value);
      if (error) errors.push(`${field.label}: ${error}`);
      else changes.set(key, value);
    }
    if (errors.length) throw new BadRequestException(errors);
    return changes;
  }

  private fieldError(field: SettingField, value: string): string | null {
    if (value.length > MAX_LENGTH) return 'es demasiado largo.';
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f]/.test(value)) return 'tiene caracteres no permitidos.';
    if (value === '') return null;
    switch (field.type) {
      case 'number': {
        const n = Number(value);
        return Number.isInteger(n) && n >= 1 && n <= 65535
          ? null
          : 'debe ser un puerto entre 1 y 65535.';
      }
      case 'url':
        return /^https?:\/\//.test(value) && URL.canParse(value)
          ? null
          : 'debe ser una URL http(s) válida.';
      case 'select':
        return field.options?.some((o) => o.value === value)
          ? null
          : 'no es una opción válida.';
      default:
        return null;
    }
  }

  /** Reglas entre campos del mismo servicio. */
  private checkGroup(group: SettingGroup, next: Map<string, string>) {
    const get = (k: string) => next.get(k) ?? '';
    if (group.id === 'push') {
      const pub = get('VAPID_PUBLIC_KEY');
      const priv = get('VAPID_PRIVATE_KEY');
      if (Boolean(pub) !== Boolean(priv)) {
        throw new BadRequestException(
          'Las claves VAPID van juntas: pon la pública y la privada del mismo par.',
        );
      }
      if (pub && priv && !vapidKeysMatch(pub, priv)) {
        throw new BadRequestException(
          'La clave privada no corresponde a la pública. Usa las dos del mismo par.',
        );
      }
    }
    if (group.id === 'payments') {
      const keys = group.required.map(get).filter(Boolean);
      const sandbox = keys.map((k) => /^(pub_test_|test_)/.test(k));
      if (sandbox.some(Boolean) && !sandbox.every(Boolean)) {
        throw new BadRequestException(
          'Mezclaste llaves de Sandbox y de producción. Usa las tres del mismo ambiente.',
        );
      }
    }
  }

  private groupOrFail(id: string): SettingGroup {
    const group = settingGroup(id);
    if (!group) throw new NotFoundException('Servicio no encontrado.');
    return group;
  }

  /** Prueba la conexión con los valores vigentes. */
  async test(groupId: string): Promise<TestResult> {
    this.groupOrFail(groupId);
    try {
      switch (groupId) {
        case 'mail':
          return await this.testMail();
        case 'ai':
          return await this.testOpenRouter();
        case 'payments':
          return await this.testWompi();
        default:
          throw new BadRequestException('Este servicio no tiene prueba.');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      return { ok: false, message: (error as Error).message };
    }
  }

  private async testMail(): Promise<TestResult> {
    const host = this.value('SMTP_HOST');
    if (!host) return { ok: false, message: 'Falta el servidor SMTP.' };
    const port = Number(this.value('SMTP_PORT') || 587);
    const user = this.value('SMTP_USER');
    const pass = this.value('SMTP_PASS');
    const transport = new SmtpTransport({
      host,
      port,
      secure: port === 465,
      ...(user && pass && { auth: { user, pass } }),
    });
    try {
      await transport.verify();
      return {
        ok: true,
        message: `Conectó con ${host}:${port}${user ? ' y aceptó el usuario.' : '.'}`,
      };
    } finally {
      await transport.close().catch(() => undefined);
    }
  }

  private async testOpenRouter(): Promise<TestResult> {
    const apiKey = this.value('OPENROUTER_API_KEY');
    if (!apiKey) return { ok: false, message: 'Falta la API key.' };
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'OpenRouter rechazó la API key.' };
    }
    if (!res.ok)
      return { ok: false, message: `OpenRouter respondió ${res.status}.` };
    const { data } = (await res.json()) as {
      data?: { label?: string; limit_remaining?: number | null };
    };
    const remaining =
      typeof data?.limit_remaining === 'number'
        ? ` Saldo del límite: ${data.limit_remaining.toFixed(2)} USD.`
        : '';
    return {
      ok: true,
      message: `La API key funciona (${data?.label ?? 'sin nombre'}).${remaining}`,
    };
  }

  private async testWompi(): Promise<TestResult> {
    const publicKey = this.value('WOMPI_PUBLIC_KEY');
    if (!publicKey) return { ok: false, message: 'Falta la llave pública.' };
    const sandbox = publicKey.startsWith('pub_test_');
    const base = sandbox
      ? 'https://sandbox.wompi.co'
      : 'https://production.wompi.co';
    const res = await fetch(
      `${base}/v1/merchants/${encodeURIComponent(publicKey)}`,
      {
        signal: AbortSignal.timeout(TEST_TIMEOUT_MS),
      },
    );
    if (res.status === 404 || res.status === 401 || res.status === 422) {
      return { ok: false, message: 'Wompi no reconoce la llave pública.' };
    }
    if (!res.ok)
      return { ok: false, message: `Wompi respondió ${res.status}.` };
    const { data } = (await res.json()) as { data?: { name?: string } };
    const missing = ['WOMPI_INTEGRITY_SECRET', 'WOMPI_EVENTS_SECRET'].filter(
      (k) => !this.value(k),
    );
    return {
      ok: missing.length === 0,
      message:
        `Comercio ${data?.name ?? 'encontrado'} en ${sandbox ? 'Sandbox' : 'producción'}.` +
        (missing.length
          ? ' Faltan los secretos de integridad y eventos.'
          : ' Los secretos solo se comprueban al recibir un pago.'),
    };
  }
}
