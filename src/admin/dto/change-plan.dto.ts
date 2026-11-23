import { IsIn } from 'class-validator';
import { PLANS, type Plan } from '../../businesses/plans/plans.js';

export class ChangePlanDto {
  @IsIn(PLANS)
  plan: Plan;
}
