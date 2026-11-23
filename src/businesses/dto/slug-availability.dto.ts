import { IsBusinessSlug } from './slug.validator.js';

export class SlugAvailabilityQueryDto {
  @IsBusinessSlug()
  slug: string;
}
