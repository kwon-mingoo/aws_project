// 환경 제어 서비스

import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { ControlLogDto, ControlResponseDto, ControlLogSummaryDto, HistoryQueryDto, HistoryResponseDto } from './dto/control.dto';
import { DynamoDBControlDatabase } from './entities/dynamodb-control.entity';
import { IoTService } from './services/iot.service';

@Injectable()
export class ControlService implements OnModuleInit {
  private readonly logger = new Logger(ControlService.name);
  private readonly controlDb: DynamoDBControlDatabase;
  private readonly iotService: IoTService;

  constructor() {
    this.controlDb = new DynamoDBControlDatabase();
    this.iotService = new IoTService();
  }

  async onModuleInit() {
    // 서비스 초기화 시 IoT 설정 검증
    const isIoTConfigValid = this.iotService.validateConfiguration();
    if (!isIoTConfigValid) {
      this.logger.warn('IoT 설정이 올바르지 않습니다. 환경변수를 확인하세요.');
    }
  }

  /**
   * 제어 로그 처리
   */
  async processControlLog(controlDto: ControlLogDto): Promise<ControlResponseDto> {
    const controlLogs: ControlLogSummaryDto[] = [];
    let iotMessagesSent = 0;

    try {
      // 제어 로그 생성
      const controlLog = await this.createControlLog(controlDto);

      // DynamoDB에 저장
      const savedLog = await this.controlDb.create(controlLog);
      
      // IoT Core로 전송
      await this.iotService.publishControlMessage(savedLog);
      
      controlLogs.push({
        id: savedLog.id,
        sensor_type: savedLog.sensor_type,
        before_value: savedLog.before_value,
        status: savedLog.status,
        after_value: savedLog.after_value
      });
      
      iotMessagesSent++;
      
      this.logger.log(
        `제어 로그 처리 완료: ${controlDto.sensor_type} ${controlDto.before_value} -> ${controlDto.after_value} (${controlDto.status})`
      );

      return {
        success: true,
        controlLogs,
        iotMessagesSent
      };

    } catch (error) {
      this.logger.error('제어 로그 처리 실패:', error);
      throw new BadRequestException('제어 로그 처리에 실패했습니다.');
    }
  }

  /**
   * 제어 로그 데이터 생성
   */
  private async createControlLog(controlDto: ControlLogDto) {
    const id = await this.controlDb.getNextControlId(); // 순차 ID 생성
    
    return {
      id,
      timestamp: controlDto.timestamp,
      sensor_type: controlDto.sensor_type,
      before_value: parseFloat(controlDto.before_value.toFixed(1)),
      status: controlDto.status,
      after_value: parseFloat(controlDto.after_value.toFixed(1))
    };
  }

  /**
   * 제어 로그 히스토리 조회
   */
  async getControlHistory(queryDto: HistoryQueryDto): Promise<HistoryResponseDto> {
    try {
      let logs: any[] = [];

      if (queryDto.date) {
        // 특정 날짜로 필터링 (YYYY-MM-DD -> YYYY-MM-DDTHH:mm:ss 범위)
        const startDate = `${queryDto.date}T00:00:00`;
        const endDate = `${queryDto.date}T23:59:59`;
        
        logs = await this.controlDb.findLogsByDateRange(startDate, endDate);
      } else if (queryDto.sensor_type) {
        // 센서 타입으로 필터링
        logs = await this.controlDb.findBySensorType(queryDto.sensor_type, queryDto.limit || 50);
      } else {
        // 전체 로그에서 최근순으로 조회
        logs = await this.controlDb.findRecentLogs(queryDto.limit || 50);
      }

      // 센서 타입과 날짜 필터가 모두 있는 경우 추가 필터링
      if (queryDto.sensor_type && queryDto.date) {
        logs = logs.filter(log => log.sensor_type === queryDto.sensor_type);
      }

      // limit 적용 (날짜 필터링 후에도 제한)
      if (queryDto.limit && logs.length > queryDto.limit) {
        logs = logs.slice(0, queryDto.limit);
      }

      this.logger.log(
        `히스토리 조회 완료: ${logs.length}개 로그, 필터 - 센서타입: ${queryDto.sensor_type || '전체'}, 날짜: ${queryDto.date || '전체'}`
      );

      return {
        success: true,
        totalCount: logs.length,
        logs
      };

    } catch (error) {
      this.logger.error('히스토리 조회 실패:', error);
      throw new BadRequestException('히스토리 조회에 실패했습니다.');
    }
  }

}