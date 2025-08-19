import { IsString, IsOptional, IsBoolean, IsDateString, Length, Matches } from 'class-validator';

export class CreateCodeDto {
  @IsString()
  @Length(1, 20, { message: '코드는 1-20자 사이여야 합니다.' })
  @Matches(/^[a-zA-Z0-9]+$/, { message: '코드는 영문자와 숫자만 허용됩니다.' })
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateCodeDto {
  @IsOptional()
  @IsString()
  @Length(1, 20, { message: '코드는 1-20자 사이여야 합니다.' })
  @Matches(/^[a-zA-Z0-9]+$/, { message: '코드는 영문자와 숫자만 허용됩니다.' })
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}