import { IsEnum } from 'class-validator';
import { PlatformRole } from '../../users/platform-role.enum.js';

export class UpdatePlatformRoleDto {
  @IsEnum(PlatformRole)
  platformRole: PlatformRole;
}
