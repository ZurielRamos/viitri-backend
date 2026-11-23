import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '@nestjs/ai';
import { InjectDisk, type StorageDisk } from '@nestjs/storage';
import { InjectRepository } from '@nestjs/typeorm';
import sharp from 'sharp';
import { Repository } from 'typeorm';
import * as z from 'zod';
import { aiEnabled } from '../../ai/ai.config.js';
import { IMAGES_DISK } from '../../storage/storage.config.js';
import { BusinessProfile } from '../entities/business-profile.entity.js';
import { extractLogoPalette, type LogoPalette } from './logo-palette.js';
import {
  BACKGROUND_INFO,
  backgroundFor,
  THEME_COLORS,
  THEME_CORNERS,
  THEME_FONTS,
  type OfferedBackground,
  type StoreTheme,
} from './theme.js';

const BACKGROUNDS = Object.keys(BACKGROUND_INFO) as [
  OfferedBackground,
  ...OfferedBackground[],
];

export interface ThemeSuggestion {
  theme: StoreTheme;
  /** Una frase para el dueño del negocio: por qué este diseño. */
  reason: string;
  /** `ai` si lo eligió el modelo; `palette` si solo se tomó el color del logo. */
  source: 'ai' | 'palette';
}

const INSTRUCTIONS = `Eres diseñador gráfico. Eliges el diseño de la tienda en línea de un negocio pequeño de Colombia a partir de su logo.
Solo puedes elegir entre las opciones del esquema:
- primary: el color de la marca: header, categorías y botones. Elige el color que identifica la marca en el logo.
- accent: el segundo color: precios y el botón de agregar. Elige otro color del logo que contraste con el principal y destaque sobre el papel claro u oscuro; si el logo tiene un solo color, uno de la lista que combine (por ejemplo naranja o dorado con azul oscuro).
- background: el fondo de la tienda (el texto se adapta solo: claro sobre fondos oscuros). Elige el que vaya con el tipo de negocio, lo que vende y el estilo del logo, y en el que el logo y el color principal se vean bien. Opciones (id: qué evoca, claro u oscuro):
${BACKGROUNDS.map((id) => `  - ${id}: ${BACKGROUND_INFO[id].description} (${BACKGROUND_INFO[id].mode === 'dark' ? 'oscuro' : 'claro'})`).join('\n')}
- font: "modern" (sin serifa, limpia), "classic" (con serifa, tradicional), "friendly" (redondeada, cercana), "elegant" (serifa de alto contraste, lujo), "street" (títulos condensados en mayúsculas, como un letrero: comidas rápidas, perros, hamburguesas, bares). Elige la más parecida al estilo y a las letras del logo.
- corners: "round" (muy redondeadas, informal), "soft" (un poco redondeadas), "square" (rectas, sobrio o lujoso). Elige según las formas del logo.
- reason: una sola frase en español de Colombia, de tú, sencilla, sin palabras técnicas ni códigos de color, de máximo 120 caracteres, que mencione el fondo. Ejemplo: "Usamos el rojo de tu logo, letras clásicas y un fondo de madera, que van con tu cocina casera."`;

/**
 * Sugiere el diseño de la tienda según el logo. Los colores salen del logo
 * (sharp, exactos); el modelo solo elige entre ellos y entre las opciones del
 * editor, nunca inventa valores. Sin modelo o si falla, se usa el color
 * principal del logo y se deja lo demás como estaba.
 */
@Injectable()
export class ThemeSuggestionService {
  private readonly logger = new Logger(ThemeSuggestionService.name);

  constructor(
    private readonly ai: AiService,
    private readonly config: ConfigService,
    @InjectDisk(IMAGES_DISK) private readonly images: StorageDisk,
    @InjectRepository(BusinessProfile)
    private readonly profiles: Repository<BusinessProfile>,
  ) {}

  async suggest(businessId: string): Promise<ThemeSuggestion> {
    const profile = await this.profiles.findOneOrFail({
      where: { businessId },
      relations: { business: true },
    });
    const logo = await this.readLogo(profile.logoUrl);
    let palette: LogoPalette;
    try {
      palette = await extractLogoPalette(logo);
    } catch {
      throw new BadRequestException(
        'No pudimos leer tu logo. Súbelo de nuevo.',
      );
    }
    // Logo en blanco y negro: se ofrecen los colores de la lista del editor.
    const candidates = palette.colors.length
      ? palette.colors
      : [...THEME_COLORS];

    if (aiEnabled(this.config)) {
      try {
        return await this.askModel(logo, palette, candidates, profile);
      } catch (error) {
        this.logger.warn(
          `Sugerencia de diseño sin IA para ${businessId}: ${String(error)}`,
        );
      }
    }
    return this.fromPalette(
      palette,
      profile.theme,
      profile.business.businessType,
    );
  }

  private async askModel(
    logo: Buffer,
    palette: LogoPalette,
    candidates: string[],
    profile: BusinessProfile,
  ): Promise<ThemeSuggestion> {
    const schema = z.object({
      primary: z
        .enum(candidates as [string, ...string[]])
        .describe('Color principal, uno de la lista'),
      accent: z
        .enum([...new Set([...candidates, ...THEME_COLORS])] as [
          string,
          ...string[],
        ])
        .describe('Color de acento, uno de la lista'),
      background: z.enum(BACKGROUNDS).describe('Fondo, uno de la lista'),
      font: z.enum(THEME_FONTS),
      corners: z.enum(THEME_CORNERS),
      reason: z.string().min(1).max(200),
    });
    // PNG pequeño: todos los modelos con visión lo aceptan y cuesta pocos tokens.
    const image = await sharp(logo)
      .resize(256, 256, { fit: 'inside' })
      .png()
      .toBuffer();
    const facts = [
      `Negocio: ${profile.business.name}.`,
      profile.business.businessType
        ? `Tipo de negocio: ${profile.business.businessType}.`
        : '',
      palette.colors.length
        ? `Colores del logo, del que más ocupa al que menos: ${palette.colors.join(', ')}.`
        : 'El logo es en blanco y negro: elige el color que mejor le quede de la lista.',
      `Luminosidad media del logo: ${palette.lightness} (0 negro, 1 blanco).`,
      profile.specialties.length
        ? `Lo que ofrece: ${profile.specialties.join(', ')}.`
        : '',
      profile.description
        ? `Descripción: ${profile.description.slice(0, 300)}`
        : '',
    ].filter(Boolean);

    const { object } = await this.ai.generateObject({
      label: 'theme-suggestion',
      schema,
      schemaName: 'store_theme',
      instructions: INSTRUCTIONS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: facts.join('\n') },
            { type: 'image', image, mediaType: 'image/png' },
          ],
        },
      ],
      maxOutputTokens: 300,
    });
    const { reason, ...rest } = object;
    // El claro u oscuro sale del fondo, para que el texto siempre se lea.
    const theme: StoreTheme = {
      ...rest,
      mode: BACKGROUND_INFO[rest.background].mode,
    };
    return {
      theme,
      reason: reason.trim().slice(0, 200),
      source: 'ai',
    };
  }

  /** Sin modelo: el color del logo y un fondo según el tipo de negocio. */
  private fromPalette(
    palette: LogoPalette,
    current: StoreTheme,
    businessType: string | null,
  ): ThemeSuggestion {
    const primary = palette.colors[0] ?? current.primary;
    const background = backgroundFor(businessType, primary);
    const theme: StoreTheme = {
      ...current,
      primary,
      // El segundo color del logo; si no hay, uno que combine.
      accent: palette.colors[1] ?? '#f97316',
      background,
      mode: BACKGROUND_INFO[background].mode,
      preset: undefined,
    };
    return {
      theme,
      reason: palette.colors[0]
        ? 'Usamos el color de tu logo y un fondo que va con tu tipo de negocio.'
        : 'Tu logo es en blanco y negro: elegimos un fondo que va con tu negocio. Escoge el color que más te guste.',
      source: 'palette',
    };
  }

  /** El logo guardado en nuestro almacenamiento. */
  private async readLogo(url: string | null): Promise<Buffer> {
    const base = this.images.url('x').slice(0, -1);
    if (!url?.startsWith(base)) {
      throw new BadRequestException('Primero sube el logo de tu negocio.');
    }
    return this.images.getBuffer(url.slice(base.length));
  }
}
