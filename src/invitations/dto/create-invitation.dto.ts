import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  Validate,
  ValidatorConstraint,
  isEmail,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { E164_PATTERN } from '../../common/phone.js';
import { NotificationChannel } from '../../notifications/notification-channel.enum.js';
import { BusinessRole } from '../../businesses/business-role.enum.js';

@ValidatorConstraint({ name: 'invitationRecipient' })
class InvitationRecipient implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string') return false;
    const { channel } = args.object as CreateInvitationDto;
    return channel === NotificationChannel.Email
      ? value.length <= 254 && isEmail(value)
      : E164_PATTERN.test(value);
  }

  defaultMessage(args: ValidationArguments): string {
    const { channel } = args.object as CreateInvitationDto;
    return channel === NotificationChannel.Email
      ? 'El destinatario debe ser un email válido.'
      : 'El destinatario debe ser un teléfono en formato E.164, por ejemplo +5491122334455.';
  }
}

export class CreateInvitationDto {
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  /** Email para el canal email; teléfono E.164 para whatsapp y sms. */
  @Transform(({ value, obj }: { value: unknown; obj: CreateInvitationDto }) => {
    if (typeof value !== 'string') return value;
    return obj.channel === NotificationChannel.Email
      ? value.trim().toLowerCase()
      : value.replace(/[\s()-]/g, '');
  })
  @IsString()
  @Validate(InvitationRecipient)
  recipient: string;

  @IsEnum(BusinessRole)
  role: BusinessRole;
}
