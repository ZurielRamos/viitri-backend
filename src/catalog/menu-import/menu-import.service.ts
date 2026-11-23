import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '@nestjs/ai';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as z from 'zod';
import { aiEnabled } from '../../ai/ai.config.js';
import { BusinessesService } from '../../businesses/businesses.service.js';
import { TTL_STORE, type TtlStore } from '../../common/ttl-store/ttl-store.js';
import { PriceType } from '../catalog.enums.js';
import { CategoriesService } from '../categories.service.js';
import { Category } from '../entities/category.entity.js';
import { Item } from '../entities/item.entity.js';
import { ItemsService } from '../items.service.js';
import type { ImportMenuDto } from './menu-import.dto.js';
import { toMenuParts, type UploadedMenuFile } from './menu-sources.js';

/** Lecturas con IA por negocio al día: alcanza para varios intentos, frena el abuso. */
const READS_PER_DAY = 15;
const DAY_SECONDS = 24 * 60 * 60;

const draftSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().describe('Nombre de la categoría, como en la carta'),
        items: z.array(
          z.object({
            name: z.string().describe('Nombre del plato o bebida'),
            description: z
              .string()
              .nullable()
              .describe('Ingredientes o descripción, si la carta la trae'),
            price: z
              .number()
              .nullable()
              .describe(
                'Precio único en pesos enteros; null si tiene tamaños o no se lee',
              ),
            variants: z
              .array(
                z.object({
                  name: z.string().describe('Tamaño o presentación'),
                  price: z.number(),
                }),
              )
              .describe(
                'Tamaños con su precio (Personal, Mediana…); vacío si no tiene',
              ),
          }),
        ),
      }),
    )
    .describe('Las categorías en el orden de la carta'),
  notes: z
    .string()
    .nullable()
    .describe(
      'Algo que el dueño deba revisar (precios borrosos, partes cortadas); null si nada',
    ),
});

export type MenuDraft = {
  categories: {
    name: string;
    items: {
      name: string;
      description: string | null;
      price: number | null;
      variants: { name: string; price: number }[];
    }[];
  }[];
  notes: string | null;
};

const INSTRUCTIONS = `Lees la carta (menú) de un restaurante, comidas rápidas, bar o café de Colombia y la pasas a datos. Puede venir en fotos (también escrita a mano, en un tablero o un papel), en PDF, o como texto de un documento o una hoja de cálculo.
Reglas:
- Copia los nombres como están en la carta, corrigiendo solo la ortografía evidente y las mayúsculas (Hamburguesa Doble, no HAMBURGUESA DOBLE).
- Agrupa en las categorías de la carta. Si no tiene, crea categorías cortas y lógicas (Hamburguesas, Bebidas, Postres).
- Precios en pesos colombianos enteros, sin puntos ni símbolos. Si la carta abrevia en miles ("12", "12k", "12 mil", "$12") entiéndelo como 12000. Nunca inventes un precio: si no se lee, déjalo en null.
- Si un producto tiene tamaños o presentaciones con precios distintos (Personal / Mediana / Familiar, Sencilla / Doble, Copa / Botella), ponlos en variants y deja price en null.
- La descripción solo si la carta la trae (ingredientes, acompañantes). No la inventes.
- Ignora teléfonos, direcciones, horarios, redes sociales y textos que no sean productos.
- No repitas productos. Si hay varias fotos, pueden ser partes de la misma carta.
- Si algo está borroso, cortado o dudoso, dilo en notes en una frase sencilla para el dueño.`;

/**
 * Carga del menú: la IA lee la carta (fotos, PDF, Word, Excel, CSV o texto)
 * y devuelve un borrador. No guarda nada: el dueño lo revisa y lo corrige, y
 * solo al confirmar se crean las categorías y los productos.
 */
@Injectable()
export class MenuImportService {
  private readonly logger = new Logger(MenuImportService.name);

  constructor(
    private readonly ai: AiService,
    private readonly config: ConfigService,
    @Inject(TTL_STORE) private readonly ttl: TtlStore,
    private readonly businesses: BusinessesService,
    private readonly categoriesService: CategoriesService,
    private readonly items: ItemsService,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(Item) private readonly itemRows: Repository<Item>,
  ) {}

  async read(
    businessId: string,
    files: UploadedMenuFile[],
    text?: string,
  ): Promise<MenuDraft> {
    if (!aiEnabled(this.config)) {
      throw new ServiceUnavailableException(
        'La lectura automática de la carta no está disponible ahora. Agrega tus productos a mano.',
      );
    }
    const parts = await toMenuParts(files, text);
    await this.countRead(businessId);
    const business = await this.businesses.findByIdOrFail(businessId);
    let object: z.infer<typeof draftSchema>;
    try {
      ({ object } = await this.ai.generateObject({
        label: 'menu-import',
        schema: draftSchema,
        schemaName: 'menu',
        instructions: INSTRUCTIONS,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Negocio: ${business.name}${business.businessType ? ` (${business.businessType})` : ''}. Pasa esta carta a datos.`,
              },
              ...parts,
            ],
          },
        ],
        maxOutputTokens: 16_000,
        timeout: '120s',
        retry: { attempts: 1 },
        temperature: 0,
      }));
    } catch (error) {
      this.logger.warn(`No se pudo leer la carta: ${String(error)}`);
      throw new UnprocessableEntityException(
        'No pudimos leer tu carta. Prueba con una foto más clara, de frente y con buena luz.',
      );
    }
    const draft = cleanDraft(object);
    if (!draft.categories.length) {
      throw new UnprocessableEntityException(
        'No encontramos productos en lo que subiste. Prueba con una foto más clara de la carta.',
      );
    }
    return draft;
  }

  /**
   * Crea lo que el dueño confirmó. Las categorías con el mismo nombre que una
   * existente se reutilizan, y no se repite un producto que ya está en ella.
   */
  async import(
    businessId: string,
    dto: ImportMenuDto,
  ): Promise<{ categories: number; items: number; skipped: number }> {
    const existing = await this.categories.find({ where: { businessId } });
    const byName = new Map(existing.map((c) => [key(c.name), c]));
    let sortOrder = existing.reduce((max, c) => Math.max(max, c.sortOrder), 0);
    let createdCategories = 0;
    let createdItems = 0;
    let skipped = 0;
    for (const category of dto.categories) {
      let target = byName.get(key(category.name));
      if (!target) {
        target = await this.categoriesService.create(businessId, {
          name: category.name,
          sortOrder: ++sortOrder,
        });
        byName.set(key(target.name), target);
        createdCategories++;
      }
      const taken = new Set(
        (
          await this.itemRows.find({
            where: { businessId, categoryId: target.id },
            select: { name: true },
          })
        ).map((i) => key(i.name)),
      );
      let itemOrder = 0;
      for (const item of category.items) {
        if (taken.has(key(item.name))) {
          skipped++;
          continue;
        }
        const variants = item.variants?.filter((v) => v.name.trim()) ?? [];
        const priced =
          variants.length > 0 ||
          (item.price !== null && item.price !== undefined);
        await this.items.create(businessId, {
          name: item.name,
          description: item.description || null,
          categoryId: target.id,
          sortOrder: ++itemOrder,
          ...(variants.length > 1
            ? { variants, priceType: PriceType.From }
            : variants.length === 1
              ? { price: variants[0].price }
              : { price: item.price ?? 0 }),
          // Sin precio legible: queda "A convenir" y oculto hasta que el dueño lo ponga.
          ...(!priced && { priceType: PriceType.OnRequest, isActive: false }),
        });
        taken.add(key(item.name));
        createdItems++;
      }
    }
    return { categories: createdCategories, items: createdItems, skipped };
  }

  private async countRead(businessId: string) {
    const counter = `menu-import:${businessId}`;
    await this.ttl.setIfAbsent(counter, 0, DAY_SECONDS);
    const used = await this.ttl.mutate<number, number>(counter, (current) => {
      const next = (current ?? 0) + 1;
      return { value: next, result: next };
    });
    if (used > READS_PER_DAY) {
      throw new HttpException(
        'Ya leímos muchas cartas hoy para tu negocio. Vuelve a intentarlo mañana o agrega los productos a mano.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

const key = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const money = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;

/** Recorta, quita lo vacío y los repetidos, y deja los precios en pesos enteros. */
export function cleanDraft(raw: z.infer<typeof draftSchema>): MenuDraft {
  const seen = new Set<string>();
  const categories = raw.categories
    .map((category) => ({
      name: category.name.trim().slice(0, 120),
      items: category.items
        .map((item) => {
          const variants = item.variants
            .map((v) => ({
              name: v.name.trim().slice(0, 80),
              price: money(v.price),
            }))
            .filter(
              (v): v is { name: string; price: number } =>
                Boolean(v.name) && v.price !== null,
            )
            .slice(0, 20);
          return {
            name: item.name.trim().slice(0, 160),
            description: item.description?.trim().slice(0, 1000) || null,
            price: variants.length ? null : money(item.price),
            variants,
          };
        })
        .filter((item) => {
          const id = key(item.name);
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .slice(0, 200),
    }))
    .filter((c) => c.name && c.items.length)
    .slice(0, 50);
  return { categories, notes: raw.notes?.trim().slice(0, 300) || null };
}
