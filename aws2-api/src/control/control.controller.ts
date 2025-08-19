// 환경 제어 API 컨트롤러

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ControlService } from './control.service';
import { ControlLogDto, HistoryQueryDto } from './dto/control.dto';

@Controller('control')
export class ControlController {
  constructor(private readonly controlService: ControlService) {}

  /**
   * @api {POST} /control/log 제어 로그 생성
   * @apiName CreateControlLog
   * @apiGroup Control
   * 
   * @apiDescription 센서의 이전값, 상태, 설정 후 값을 받아서 제어 로그를 처리합니다.
   * 제어 로그를 DynamoDB에 저장하고, AWS IoT Core로 명령을 전송합니다.
   * 
   * @apiBody {String} timestamp 타임스탬프 (YYYY-MM-DDTHH:mm:ss)
   * @apiBody {String} sensor_type 센서 타입 (temp, humidity, gas)
   * @apiBody {Number} before_value 이전값
   * @apiBody {String} status 상태 (good, warning, critical)
   * @apiBody {Number} after_value 설정 후 값
   * 
   * @apiSuccess {Boolean} success 성공 여부
   * @apiSuccess {Object[]} controlLogs 제어 로그 배열
   * @apiSuccess {String} controlLogs.id 제어 로그 ID
   * @apiSuccess {String} controlLogs.sensor_type 센서 타입
   * @apiSuccess {Number} controlLogs.before_value 이전값
   * @apiSuccess {String} controlLogs.status 상태
   * @apiSuccess {Number} controlLogs.after_value 설정 후 값
   * @apiSuccess {Number} iotMessagesSent IoT로 전송된 메시지 수
   * 
   * @apiExample {curl} Example usage:
   *     curl -X POST https://aws2aws2.com/control/log \
   *       -H "X-API-Key: your-api-key" \
   *       -H "Content-Type: application/json" \
   *       -d '{"timestamp": "2025-08-18T14:59:00", "sensor_type": "temp", "before_value": 22.5, "status": "warning", "after_value": 25.0}'
   * 
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "success": true,
   *       "controlLogs": [
   *         {"id": "0000001", "sensor_type": "temp", "before_value": 22.5, "status": "warning", "after_value": 25.0}
   *       ],
   *       "iotMessagesSent": 1
   *     }
   */
  @UseGuards(ThrottlerGuard, ApiKeyGuard)
  @Post('log')
  @HttpCode(HttpStatus.OK)
  async createControlLog(
    @Body(ValidationPipe) controlLogDto: ControlLogDto,
  ) {
    return await this.controlService.processControlLog(controlLogDto);
  }

  /**
   * @api {GET} /control/history 제어 로그 히스토리 조회
   * @apiName GetControlHistory
   * @apiGroup Control
   * 
   * @apiDescription timestamp 기준 내림차순으로 제어 로그 히스토리를 조회합니다.
   * 
   * @apiQuery {Number} [limit=50] 조회할 개수 (1-1000)
   * @apiQuery {String} [sensor_type] 센서 타입 필터 (temp, humidity, gas)
   * @apiQuery {String} [date] 특정 날짜 필터 (YYYY-MM-DD)
   * 
   * @apiSuccess {Boolean} success 성공 여부
   * @apiSuccess {Number} totalCount 조회된 로그 개수
   * @apiSuccess {Object[]} logs 제어 로그 배열
   * @apiSuccess {String} logs.id 제어 로그 ID
   * @apiSuccess {String} logs.timestamp 타임스탬프
   * @apiSuccess {String} logs.sensor_type 센서 타입
   * @apiSuccess {Number} logs.before_value 이전값
   * @apiSuccess {String} logs.status 상태
   * @apiSuccess {Number} logs.after_value 설정 후 값
   * 
   * @apiExample {curl} Example usage:
   *     curl -X GET https://aws2aws2.com/control/history?limit=100&sensor_type=temp&date=2025-08-18 \
   *       -H "X-API-Key: your-api-key"
   * 
   * @apiSuccessExample {json} Success-Response:
   *     HTTP/1.1 200 OK
   *     {
   *       "success": true,
   *       "totalCount": 10,
   *       "logs": [
   *         {
   *           "id": "0000003",
   *           "timestamp": "2025-08-18T15:30:00",
   *           "sensor_type": "temp",
   *           "before_value": 23.5,
   *           "status": "good", 
   *           "after_value": 25.0
   *         }
   *       ]
   *     }
   */
  @UseGuards(ThrottlerGuard, ApiKeyGuard)
  @Get('history')
  @HttpCode(HttpStatus.OK)
  async getControlHistory(
    @Query(ValidationPipe) queryDto: HistoryQueryDto,
  ) {
    return await this.controlService.getControlHistory(queryDto);
  }
}