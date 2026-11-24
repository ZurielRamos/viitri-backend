import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { ShortLinksService } from './short-links.service.js';

/** La web resuelve `viitri.com/ir/{código}` con esta ruta y redirige. */
@Public()
@Controller('public/links')
export class ShortLinksController {
  constructor(private readonly links: ShortLinksService) {}

  @Get(':code')
  async resolve(@Param('code') code: string) {
    return { url: await this.links.resolve(code) };
  }
}
