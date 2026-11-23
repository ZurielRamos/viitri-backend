import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BusinessAccess } from '../decorators/business-roles.decorator.js';
import { BusinessRole } from '../business-role.enum.js';
import { UpdateBusinessProfileDto } from './dto/update-business-profile.dto.js';
import { BusinessProfileService } from './business-profile.service.js';
import {
  BusinessImagesService,
  IMAGE_KINDS,
  MAX_IMAGE_BYTES,
  type ImageKind,
} from './business-images.service.js';
import { ThemeSuggestionService } from './theme-suggestion.service.js';

const kindPipe = new ParseEnumPipe(
  Object.fromEntries(IMAGE_KINDS.map((k) => [k, k])),
);

@Controller('businesses/:businessId/profile')
export class BusinessProfileController {
  constructor(
    private readonly profiles: BusinessProfileService,
    private readonly images: BusinessImagesService,
    private readonly themeSuggestions: ThemeSuggestionService,
  ) {}

  @BusinessAccess()
  @Get()
  get(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.profiles.findByBusinessIdOrFail(businessId);
  }

  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @Patch()
  update(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Body() dto: UpdateBusinessProfileDto,
  ) {
    return this.profiles.update(businessId, dto);
  }

  /**
   * Diseño sugerido según el logo: colores sacados del logo y, con IA, el
   * fondo, la letra y las esquinas. No guarda nada: la web lo muestra en la
   * vista previa y el dueño decide. Va antes de `:kind` para que no lo tome.
   */
  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @HttpCode(200)
  @Post('theme-suggestion')
  suggestTheme(@Param('businessId', ParseUUIDPipe) businessId: string) {
    return this.themeSuggestions.suggest(businessId);
  }
  /** Sube el logo o la portada (campo `image`). La imagen se optimiza en el servidor. */
  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @Post(':kind')
  @UseInterceptors(
    FileInterceptor('image', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  uploadImage(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('kind', kindPipe) kind: ImageKind,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ) {
    if (!file)
      throw new BadRequestException('Adjunta la imagen en el campo "image".');
    return this.images.replace(businessId, kind, file.buffer);
  }

  @BusinessAccess(BusinessRole.Owner, BusinessRole.Admin)
  @HttpCode(204)
  @Delete(':kind')
  async removeImage(
    @Param('businessId', ParseUUIDPipe) businessId: string,
    @Param('kind', kindPipe) kind: ImageKind,
  ) {
    await this.images.remove(businessId, kind);
  }
}
