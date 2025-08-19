// AWS IoT Core 통신 서비스

import { Injectable, Logger } from '@nestjs/common';
import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';
import { ControlLogEntity } from '../entities/dynamodb-control.entity';

@Injectable()
export class IoTService {
  private readonly logger = new Logger(IoTService.name);
  private client: IoTDataPlaneClient;
  private readonly topicPrefix = 'device/control';

  constructor() {
    const endpoint = process.env.IOT_ENDPOINT_URL;
    
    if (!endpoint || endpoint.includes('your-iot-endpoint')) {
      this.logger.warn('IoT 엔드포인트가 설정되지 않았습니다. 테스트 모드로 동작합니다.');
      // IoT 클라이언트를 null로 설정하여 테스트 모드로 동작
      this.client = null as any;
    } else {
      // IoT Data Plane 클라이언트 초기화
      this.client = new IoTDataPlaneClient({
        region: process.env.AWS_REGION || 'ap-northeast-2',
        endpoint: endpoint,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      });
    }
  }

  /**
   * 제어 메시지를 IoT Core로 발행
   */
  async publishControlMessage(controlLog: ControlLogEntity): Promise<boolean> {
    try {
      const topic = `${this.topicPrefix}/environment`;
      
      // One-line JSON 메시지 생성
      const message = {
        id: controlLog.id,
        timestamp: controlLog.timestamp,
        sensor_type: controlLog.sensor_type,
        before_value: controlLog.before_value,
        status: controlLog.status,
        after_value: controlLog.after_value
      };

      // JSON을 한 줄로 압축
      const payload = JSON.stringify(message);

      // 테스트 모드인 경우
      if (!this.client) {
        this.logger.log(
          `[테스트 모드] IoT 메시지 시뮬레이션: ${topic} -> ${payload}`
        );
        return true;
      }

      const command = new PublishCommand({
        topic: topic,
        qos: 1, // At least once delivery
        payload: Buffer.from(payload, 'utf8'),
      });

      const result = await this.client.send(command);
      
      this.logger.log(
        `IoT 메시지 발행 성공: ${topic} -> ${payload}`
      );

      return true;

    } catch (error) {
      this.logger.error('IoT 메시지 발행 실패:', error);
      // IoT 실패가 전체 프로세스를 중단시키지 않도록 함
      return false;
    }
  }

  /**
   * 배치로 여러 제어 메시지 발행
   */
  async publishBatchControlMessages(controlLogs: ControlLogEntity[]): Promise<number> {
    let successCount = 0;

    for (const log of controlLogs) {
      try {
        const success = await this.publishControlMessage(log);
        if (success) {
          successCount++;
        }
      } catch (error) {
        this.logger.error(`제어 로그 ${log.id} IoT 발행 실패:`, error);
        // 개별 실패는 전체 배치를 중단시키지 않음
      }
    }

    this.logger.log(`IoT 배치 발행 완료: ${successCount}/${controlLogs.length} 성공`);
    return successCount;
  }

  /**
   * 센서별 제어 토픽으로 메시지 발행
   */
  async publishSensorSpecificMessage(
    sensorType: string, 
    controlLog: ControlLogEntity
  ): Promise<boolean> {
    try {
      const topic = `${this.topicPrefix}/${sensorType}`;
      
      const message = {
        id: controlLog.id,
        timestamp: controlLog.timestamp,
        sensor_type: controlLog.sensor_type,
        before_value: controlLog.before_value,
        status: controlLog.status,
        after_value: controlLog.after_value
      };

      const payload = JSON.stringify(message);

      const command = new PublishCommand({
        topic: topic,
        qos: 1,
        payload: Buffer.from(payload, 'utf8'),
      });

      await this.client.send(command);
      
      this.logger.log(
        `센서별 IoT 메시지 발행 성공: ${topic} -> ${payload}`
      );

      return true;

    } catch (error) {
      this.logger.error(`센서별 IoT 메시지 발행 실패 (${sensorType}):`, error);
      throw error;
    }
  }

  /**
   * IoT 연결 상태 확인
   */
  async checkConnection(): Promise<boolean> {
    try {
      // 테스트 메시지 발행으로 연결 상태 확인
      const testMessage = {
        type: 'health_check',
        timestamp: new Date().toISOString(),
        status: 'testing'
      };

      const command = new PublishCommand({
        topic: `${this.topicPrefix}/health`,
        qos: 0, // At most once for health check
        payload: Buffer.from(JSON.stringify(testMessage), 'utf8'),
      });

      await this.client.send(command);
      this.logger.log('IoT 연결 상태 확인 성공');
      return true;

    } catch (error) {
      this.logger.error('IoT 연결 상태 확인 실패:', error);
      return false;
    }
  }

  /**
   * 환경변수 검증
   */
  validateConfiguration(): boolean {
    const requiredEnvs = ['IOT_ENDPOINT_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'];
    const missing = requiredEnvs.filter(env => !process.env[env]);

    if (missing.length > 0) {
      this.logger.error(`IoT 서비스 설정 오류 - 누락된 환경변수: ${missing.join(', ')}`);
      return false;
    }

    return true;
  }
}