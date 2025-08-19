import { IsNumber, IsNotEmpty, Min, Max, IsString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ControlLogEntity } from '../entities/dynamodb-control.entity';

export class ControlLogDto {
  @IsNotEmpty({ message: '타임스탬프가 필요합니다.' })
  @IsString({ message: '타임스탬프는 문자열이어야 합니다.' })
  timestamp: string;

  @IsNotEmpty({ message: '센서 타입이 필요합니다.' })
  @IsString({ message: '센서 타입은 문자열이어야 합니다.' })
  sensor_type: string;

  @IsNotEmpty({ message: '이전값이 필요합니다.' })
  @IsNumber({}, { message: '이전값은 숫자여야 합니다.' })
  @Transform(({ value }) => parseFloat(value))
  before_value: number;

  @IsNotEmpty({ message: '상태값이 필요합니다.' })
  @IsString({ message: '상태값은 문자열이어야 합니다.' })
  status: string;

  @IsNotEmpty({ message: '설정 후 값이 필요합니다.' })
  @IsNumber({}, { message: '설정 후 값은 숫자여야 합니다.' })
  @Transform(({ value }) => parseFloat(value))
  after_value: number;
}

export class ControlResponseDto {
  success: boolean;
  controlLogs: ControlLogSummaryDto[];
  iotMessagesSent: number;
}

export class ControlLogSummaryDto {
  id: string;
  sensor_type: string;
  before_value: number;
  status: string;
  after_value: number;
}

export class HistoryQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber({}, { message: 'limit은 숫자여야 합니다.' })
  @Min(1, { message: 'limit은 1 이상이어야 합니다.' })
  @Max(1000, { message: 'limit은 1000 이하여야 합니다.' })
  limit?: number = 50;

  @IsOptional()
  @IsString({ message: '센서 타입은 문자열이어야 합니다.' })
  sensor_type?: string;

  @IsOptional()
  @IsString({ message: '날짜는 문자열이어야 합니다.' })
  date?: string; // YYYY-MM-DD 형식
}

export class HistoryResponseDto {
  success: boolean;
  totalCount: number;
  logs: ControlLogEntity[];
}