import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { tightenLogo } from '../storage/logo-trim.js';
import { TTL_STORE, type TtlStore } from '../common/ttl-store/ttl-store.js';
import { buildLogoPrompt, type LogoAnswers } from './logo-prompt.js';

/**
 * Recraft v4.1 flash: en la comparación de docs/logo-lab escribió bien los
 * nombres, costó US$ 0,007 por imagen y tardó unos 2 s. Se cambia con LOGO_MODEL.
 */
export const DEFAULT_LOGO_MODEL = 'recraft/recraft-v4.1-flash';
/** Opciones por intento, para que el dueño elija. */
const VARIANTS = 3;
/** Intentos por negocio al día (cada uno son 3 imágenes). */
const ROUNDS_PER_DAY = 5;
const DAY_SECONDS = 24 * 60 * 60;
const OUTPUT_SIDE = 1024;

/**
 * Crea logos con un modelo de imagen (OpenRouter) a partir de las respuestas
 * del cuestionario. No guarda nada: devuelve las opciones y el dueño sube la
 * que elija como cualquier logo (así se generan también sus íconos).
 */
@Injectable()
export class LogoGeneratorService {
  private readonly logger = new Logger(LogoGeneratorService.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(TTL_STORE) private readonly ttl: TtlStore,
  ) {}

  async generate(
    businessId: string,
    answers: LogoAnswers,
  ): Promise<{ images: string[]; remaining: number }> {
    const apiKey = this.config.get<string>('OPENROUTER_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'El creador de logos no está disponible ahora. Sube tu logo como imagen.',
      );
    }
    // Primero el prompt: respuestas inválidas no gastan un intento.
    const prompt = buildLogoPrompt(answers);
    const remaining = await this.useRound(businessId);
    const model = this.config.get<string>('LOGO_MODEL') || DEFAULT_LOGO_MODEL;
    const results = await Promise.allSettled(
      Array.from({ length: VARIANTS }, () =>
        this.request(apiKey, model, prompt),
      ),
    );
    const images = results
      .filter(
        (r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled',
      )
      .map((r) => r.value);
    results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .forEach((r) =>
        this.logger.warn(`Logo sin generar: ${String(r.reason)}`),
      );
    if (!images.length) {
      throw new ServiceUnavailableException(
        'No pudimos crear tu logo esta vez. Inténtalo de nuevo en un momento.',
      );
    }
    return { images, remaining };
  }

  /** Una imagen como data URL (WebP cuadrado sobre blanco, listo para recortar en círculo). */
  private async request(
    apiKey: string,
    model: string,
    prompt: string,
  ): Promise<string> {
    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://viitri.com',
          'X-Title': 'viitri',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          // Gemini exige también 'text'; Recraft y Flux solo devuelven imagen.
          modalities: model.startsWith('google/')
            ? ['image', 'text']
            : ['image'],
          usage: { include: true },
        }),
        signal: AbortSignal.timeout(90_000),
      },
    );
    const json = (await response.json().catch(() => null)) as {
      error?: unknown;
      usage?: { cost?: number };
      choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[];
    } | null;
    if (!response.ok || !json || json.error) {
      throw new Error(
        `${model} ${response.status}: ${JSON.stringify(json?.error ?? json).slice(0, 200)}`,
      );
    }
    const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const match = url && /^data:image\/[\w+.-]+;base64,(.+)$/s.exec(url);
    if (!match) throw new Error(`${model}: la respuesta no trae imagen`);
    if (json.usage?.cost !== undefined) {
      this.logger.log(`Logo generado con ${model}: US$ ${json.usage.cost}`);
    }
    const flat = await sharp(Buffer.from(match[1], 'base64'))
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
    // Sin el aire que suele dejar el modelo alrededor del logo.
    const image = await sharp(await tightenLogo(flat))
      .resize(OUTPUT_SIDE, OUTPUT_SIDE, {
        fit: 'contain',
        background: '#ffffff',
      })
      .webp({ quality: 90 })
      .toBuffer();
    return `data:image/webp;base64,${image.toString('base64')}`;
  }

  /** Cuenta el intento del día; sin intentos, 429. Devuelve cuántos quedan. */
  private async useRound(businessId: string): Promise<number> {
    const counter = `logo-rounds:${businessId}`;
    await this.ttl.setIfAbsent(counter, 0, DAY_SECONDS);
    const used = await this.ttl.mutate<number, number>(counter, (current) => {
      const next = (current ?? 0) + 1;
      return { value: next, result: next };
    });
    if (used > ROUNDS_PER_DAY) {
      throw new HttpException(
        'Ya creaste varios logos hoy. Vuelve mañana para intentar de nuevo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return ROUNDS_PER_DAY - used;
  }
}
