import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShortLink } from './short-link.entity.js';
import { ShortLinksController } from './short-links.controller.js';
import { ShortLinksService } from './short-links.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ShortLink])],
  controllers: [ShortLinksController],
  providers: [ShortLinksService],
  exports: [ShortLinksService],
})
export class LinksModule {}
