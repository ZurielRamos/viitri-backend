import { IsEnum } from 'class-validator';
import { BusinessRole } from '../business-role.enum.js';

export class UpdateMemberDto {
  @IsEnum(BusinessRole)
  role: BusinessRole;
}
