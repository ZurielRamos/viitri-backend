import { IsString, Length } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @Length(20, 200)
  token: string;
}
