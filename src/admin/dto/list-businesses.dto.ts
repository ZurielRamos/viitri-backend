import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto.js';
import { PLANS, type Plan } from '../../businesses/plans/plans.js';
import {
  PLAN_STATUS_FILTERS,
  type PlanStatusFilter,
} from '../plan-status-sql.js';

export class ListBusinessesQueryDto extends PaginationQueryDto {
  /** Busca en nombre, slug y correo del propietario. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(PLANS)
  plan?: Plan;

  @IsOptional()
  @IsIn(PLAN_STATUS_FILTERS)
  status?: PlanStatusFilter;
}
