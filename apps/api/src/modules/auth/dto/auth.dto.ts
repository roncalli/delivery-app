import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

/** Telefone no formato E.164: +5534999990000 */
const PHONE_REGEX = /^\+[1-9]\d{9,14}$/;
const PHONE_MSG = 'Informe o telefone no formato +5534999990000';

export class RequestOtpDto {
  @Matches(PHONE_REGEX, { message: PHONE_MSG })
  phone: string;
}

export class VerifyOtpDto {
  @Matches(PHONE_REGEX, { message: PHONE_MSG })
  phone: string;

  @IsString({ message: 'Informe o código recebido' })
  @Length(6, 6, { message: 'O código tem 6 dígitos' })
  code: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'A senha tem no mínimo 6 caracteres' })
  password: string;
}

export class RefreshDto {
  @IsString({ message: 'Informe o refresh token' })
  refreshToken: string;
}
