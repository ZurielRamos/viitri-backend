import { IsIn } from 'class-validator';
import type { Plan } from '../plans/plans.js';

export class StartTrialDto {
  @IsIn(['advanced', 'pro'])
  plan: Exclude<Plan, 'basic'>;
}
