import { IsIn, IsOptional } from 'class-validator';
import {
  REFERRAL_SOURCES,
  type ReferralSource,
} from '../../users/referral-source.js';

export class OnboardingDto {
  /** Se omite si el usuario saltó la pregunta. */
  @IsOptional()
  @IsIn(REFERRAL_SOURCES)
  referralSource?: ReferralSource;
}
