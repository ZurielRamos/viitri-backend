import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { MAX_IMAGE_BYTES } from '../storage/optimize-image.js';
import { ImportMenuDto } from './menu-import/menu-import.dto.js';
import { MenuImportService } from './menu-import/menu-import.service.js';
import {
  MAX_MENU_FILE_BYTES,
  MAX_MENU_FILES,
  type UploadedMenuFile,
} from './menu-import/menu-sources.js';
import { CatalogImagesService } from './catalog-images.service.js';
import { BusinessRole } from '../businesses/business-role.enum.js';
import { BusinessAccess } from '../businesses/decorators/business-roles.decorator.js';
import { RequireAnyFeature } from '../businesses/decorators/require-features.decorator.js';
import { CATALOG_FEATURES } from './catalog.enums.js';
import { CategoriesService } from './categories.service.js';
import {
  CreateCategoryDto,
  CreateItemDto,
  CreateOptionGroupDto,
  ItemAvailabilityDto,
  ListItemsQueryDto,
  ReorderItemsDto,
  UpdateCategoryDto,
  UpdateItemDto,
  UpdateOptionGroupDto,
} from './dto/catalog.dto.js';
import { PromotionInputDto } from './dto/promotion.dto.js';
import { ItemsService } from './items.service.js';
import { PromotionsService } from './promotions.service.js';
import { OptionGroupsService } from './option-groups.service.js';

const Manage = () => BusinessAccess(BusinessRole.Owner, BusinessRole.Admin);
const AnyMember = () => BusinessAccess();
const BusinessId = () => Param('businessId', ParseUUIDPipe);

/**
 * Catálogo del negocio: productos, servicios y planes. Lo comparten `menu`,
 * `ecommerce`, `bookings` y `memberships`; cada tipo exige la suya al crearlo.
 * Lectura y disponibilidad: cualquier miembro. Crear, editar y borrar: owner
 * y admin.
 */
@RequireAnyFeature(...CATALOG_FEATURES)
@Controller('businesses/:businessId/catalog')
export class CatalogController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly items: ItemsService,
    private readonly images: CatalogImagesService,
    private readonly optionGroups: OptionGroupsService,
    private readonly promotions: PromotionsService,
    private readonly menuImport: MenuImportService,
  ) {}

  // ---------- Promociones (happy hour) ----------

  @AnyMember()
  @Get('promotions')
  listPromotions(@BusinessId() businessId: string) {
    return this.promotions.list(businessId);
  }

  @Manage()
  @Post('promotions')
  createPromotion(
    @BusinessId() businessId: string,
    @Body() dto: PromotionInputDto,
  ) {
    return this.promotions.create(businessId, dto);
  }

  @Manage()
  @Patch('promotions/:promotionId')
  updatePromotion(
    @BusinessId() businessId: string,
    @Param('promotionId', ParseUUIDPipe) id: string,
    @Body() dto: PromotionInputDto,
  ) {
    return this.promotions.update(businessId, id, dto);
  }

  @Manage()
  @HttpCode(204)
  @Delete('promotions/:promotionId')
  async removePromotion(
    @BusinessId() businessId: string,
    @Param('promotionId', ParseUUIDPipe) id: string,
  ) {
    await this.promotions.remove(businessId, id);
  }

  // ---------- Categorías ----------

  @AnyMember()
  @Get('categories')
  listCategories(@BusinessId() businessId: string) {
    return this.categories.list(businessId);
  }

  @Manage()
  @Post('categories')
  createCategory(
    @BusinessId() businessId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categories.create(businessId, dto);
  }

  @Manage()
  @Patch('categories/:categoryId')
  updateCategory(
    @BusinessId() businessId: string,
    @Param('categoryId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(businessId, id, dto);
  }

  @Manage()
  @HttpCode(204)
  @Delete('categories/:categoryId')
  async removeCategory(
    @BusinessId() businessId: string,
    @Param('categoryId', ParseUUIDPipe) id: string,
  ) {
    await this.categories.remove(businessId, id);
  }

  /** Foto de una categoría (campo `image`): 192 × 192. Devuelve su URL. */
  @Manage()
  @Post('category-images')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  uploadCategoryImage(
    @BusinessId() businessId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Adjunta la foto en el campo "image".');
    }
    return this.images.uploadCategoryImage(businessId, file.buffer);
  }

  // ---------- Cargar el menú desde la carta ----------

  /**
   * Lee la carta con IA (campo `files`: fotos, PDF, Word, Excel o CSV; y/o
   * `text`, texto pegado) y devuelve un borrador para revisar. No guarda nada.
   */
  @Manage()
  @HttpCode(200)
  @Post('import/read')
  @UseInterceptors(
    FilesInterceptor('files', MAX_MENU_FILES, {
      limits: { fileSize: MAX_MENU_FILE_BYTES, files: MAX_MENU_FILES },
    }),
  )
  readMenu(
    @BusinessId() businessId: string,
    @UploadedFiles() files: UploadedMenuFile[] | undefined,
    @Body('text') text?: string,
  ) {
    return this.menuImport.read(
      businessId,
      files ?? [],
      typeof text === 'string' ? text.slice(0, 60_000) : undefined,
    );
  }

  /** Crea las categorías y los productos del borrador que el dueño confirmó. */
  @Manage()
  @Post('import')
  importMenu(@BusinessId() businessId: string, @Body() dto: ImportMenuDto) {
    return this.menuImport.import(businessId, dto);
  }

  // ---------- Elementos (productos, servicios y planes) ----------

  /**
   * Sube una foto (campo `image`), la deja cuadrada y devuelve su URL, que
   * luego va en `imageUrls` al crear o editar el elemento.
   */
  @Manage()
  @Post('images')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  uploadImage(
    @BusinessId() businessId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Adjunta la foto en el campo "image".');
    }
    return this.images.upload(businessId, file.buffer);
  }

  @AnyMember()
  @Get('items')
  listItems(
    @BusinessId() businessId: string,
    @Query() query: ListItemsQueryDto,
  ) {
    return this.items.list(businessId, query);
  }

  @AnyMember()
  @Get('items/:itemId')
  findItem(
    @BusinessId() businessId: string,
    @Param('itemId', ParseUUIDPipe) id: string,
  ) {
    return this.items.findOneOrFail(businessId, id);
  }

  @Manage()
  @Post('items')
  createItem(@BusinessId() businessId: string, @Body() dto: CreateItemDto) {
    return this.items.create(businessId, dto);
  }

  @Manage()
  @Patch('items/:itemId')
  updateItem(
    @BusinessId() businessId: string,
    @Param('itemId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.items.update(businessId, id, dto);
  }

  /** Orden de los elementos que se envían (por ejemplo, los de una categoría). */
  @Manage()
  @HttpCode(204)
  @Put('items/order')
  async reorderItems(
    @BusinessId() businessId: string,
    @Body() dto: ReorderItemsDto,
  ) {
    await this.items.reorder(businessId, dto.itemIds);
  }

  /** Marcar agotado o disponible: cualquier miembro (por ejemplo, cocina). */
  @AnyMember()
  @Patch('items/:itemId/availability')
  setAvailability(
    @BusinessId() businessId: string,
    @Param('itemId', ParseUUIDPipe) id: string,
    @Body() dto: ItemAvailabilityDto,
  ) {
    return this.items.setAvailability(businessId, id, dto.isAvailable);
  }

  @Manage()
  @Get('deleted-items')
  listDeleted(@BusinessId() businessId: string) {
    return this.items.listDeleted(businessId);
  }

  @Manage()
  @HttpCode(200)
  @Post('items/:itemId/restore')
  restoreItem(
    @BusinessId() businessId: string,
    @Param('itemId', ParseUUIDPipe) id: string,
  ) {
    return this.items.restore(businessId, id);
  }

  @Manage()
  @HttpCode(204)
  @Delete('items/:itemId')
  async removeItem(
    @BusinessId() businessId: string,
    @Param('itemId', ParseUUIDPipe) id: string,
  ) {
    await this.items.remove(businessId, id);
  }

  // ---------- Grupos de opciones (preferencias y adicionales) ----------

  @AnyMember()
  @Get('option-groups')
  listOptionGroups(@BusinessId() businessId: string) {
    return this.optionGroups.list(businessId);
  }

  @AnyMember()
  @Get('option-groups/:groupId')
  findOptionGroup(
    @BusinessId() businessId: string,
    @Param('groupId', ParseUUIDPipe) id: string,
  ) {
    return this.optionGroups.findOneOrFail(businessId, id);
  }

  @Manage()
  @Post('option-groups')
  createOptionGroup(
    @BusinessId() businessId: string,
    @Body() dto: CreateOptionGroupDto,
  ) {
    return this.optionGroups.create(businessId, dto);
  }

  @Manage()
  @Patch('option-groups/:groupId')
  updateOptionGroup(
    @BusinessId() businessId: string,
    @Param('groupId', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOptionGroupDto,
  ) {
    return this.optionGroups.update(businessId, id, dto);
  }

  @Manage()
  @HttpCode(204)
  @Delete('option-groups/:groupId')
  async removeOptionGroup(
    @BusinessId() businessId: string,
    @Param('groupId', ParseUUIDPipe) id: string,
  ) {
    await this.optionGroups.remove(businessId, id);
  }
}
