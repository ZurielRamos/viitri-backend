import { IsOptional, IsString, Length } from 'class-validator';
import { IsBusinessSlug } from './slug.validator.js';

/** Los features se gestionan en /businesses/:businessId/features. */
export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsBusinessSlug()
  slug?: string;
}
