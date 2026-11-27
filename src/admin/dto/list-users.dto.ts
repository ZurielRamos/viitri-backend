import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto.js';
import { PlatformRole } from '../../users/platform-role.enum.js';

export class ListUsersQueryDto extends PaginationQueryDto {
  /** Busca en nombre, correo y celular. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(Object.values(PlatformRole))
  role?: PlatformRole;

  /** `account`: cuentas con correo o celular. `team`: perfiles con PIN. */
  @IsOptional()
  @IsIn(['account', 'team'])
  kind?: 'account' | 'team';
}
