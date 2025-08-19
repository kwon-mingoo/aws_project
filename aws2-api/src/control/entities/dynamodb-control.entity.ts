import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';

export interface ControlLogEntity {
  id: string;                // 제어 로그 ID (예: "0000001")
  timestamp: string;         // 타임스탬프 (예: "2025-08-18T14:59:00")
  sensor_type: string;       // 센서 타입 (예: "temp", "humidity", "gas")
  before_value: number;      // 이전값 (예: 22.5)
  status: string;           // 상태 (예: "good", "warning", "critical")
  after_value: number;       // 설정 후 값 (예: 25.0)
}

@Injectable()
export class DynamoDBControlDatabase {
  private client: DynamoDBDocumentClient;
  private tableName: string;
  private counterTableName: string;

  constructor() {
    this.tableName = process.env.DYNAMODB_CONTROL_TABLE || 'EnvironmentControlLogs';
    this.counterTableName = 'ControlIdCounter';
    
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
    
    console.log(`DynamoDB 연결 설정: 테이블명=${this.tableName}, 카운터=${this.counterTableName}, 리전=${process.env.AWS_REGION || 'ap-northeast-2'}`);
  }

  async findAll(): Promise<ControlLogEntity[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
      });
      
      const result = await this.client.send(command);
      return result.Items as ControlLogEntity[] || [];
    } catch (error) {
      console.error('DynamoDB findAll error:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<ControlLogEntity | null> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { id },
      });

      const result = await this.client.send(command);
      return result.Item as ControlLogEntity || null;
    } catch (error) {
      console.error('DynamoDB findById error:', error);
      throw error;
    }
  }

  async findBySensorType(sensorType: string, limit = 50): Promise<ControlLogEntity[]> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'SensorTypeTimestampIndex', // GSI 필요
        KeyConditionExpression: 'sensor_type = :sensor_type',
        ExpressionAttributeValues: {
          ':sensor_type': sensorType,
        },
        ScanIndexForward: false, // 최신순 정렬
        Limit: limit,
      });

      const result = await this.client.send(command);
      return result.Items as ControlLogEntity[] || [];
    } catch (error) {
      console.error('DynamoDB findBySensorType error:', error);
      // GSI가 없을 경우 Scan으로 대체
      return await this.scanBySensorType(sensorType, limit);
    }
  }

  private async scanBySensorType(sensorType: string, limit: number): Promise<ControlLogEntity[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'sensor_type = :sensor_type',
        ExpressionAttributeValues: {
          ':sensor_type': sensorType,
        },
        Limit: limit,
      });

      const result = await this.client.send(command);
      const items = result.Items as ControlLogEntity[] || [];
      
      // 타임스탬프 기준 최신순 정렬
      return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (error) {
      console.error('DynamoDB scanBySensorType error:', error);
      return [];
    }
  }

  async create(data: ControlLogEntity): Promise<ControlLogEntity> {
    try {
      const command = new PutCommand({
        TableName: this.tableName,
        Item: data,
      });

      await this.client.send(command);
      return data;
    } catch (error) {
      console.error('DynamoDB create error:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<ControlLogEntity>): Promise<ControlLogEntity | null> {
    try {
      // 먼저 기존 아이템 조회
      const existing = await this.findById(id);
      if (!existing) return null;

      const updateExpression: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id') {
          updateExpression.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = value;
        }
      });

      if (updateExpression.length === 0) return existing;

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });

      const result = await this.client.send(command);
      return result.Attributes as ControlLogEntity;
    } catch (error) {
      console.error('DynamoDB update error:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const command = new DeleteCommand({
        TableName: this.tableName,
        Key: { id },
        ReturnValues: 'ALL_OLD',
      });

      const result = await this.client.send(command);
      return !!result.Attributes;
    } catch (error) {
      console.error('DynamoDB delete error:', error);
      throw error;
    }
  }

  /**
   * 최근 제어 로그 조회 (모든 센서 타입)
   */
  async findRecentLogs(limit = 20): Promise<ControlLogEntity[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        Limit: limit,
      });

      const result = await this.client.send(command);
      const items = result.Items as ControlLogEntity[] || [];
      
      // 타임스탬프 기준 최신순 정렬
      return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (error) {
      console.error('DynamoDB findRecentLogs error:', error);
      return [];
    }
  }

  /**
   * 특정 기간의 제어 로그 조회
   */
  async findLogsByDateRange(startDate: string, endDate: string): Promise<ControlLogEntity[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
        FilterExpression: '#timestamp BETWEEN :start_date AND :end_date',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':start_date': startDate,
          ':end_date': endDate,
        },
      });

      const result = await this.client.send(command);
      const items = result.Items as ControlLogEntity[] || [];
      
      // 타임스탬프 기준 최신순 정렬
      return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (error) {
      console.error('DynamoDB findLogsByDateRange error:', error);
      return [];
    }
  }

  /**
   * 다음 순차 ID 생성 (원자적 증가)
   */
  async getNextControlId(): Promise<string> {
    try {
      const command = new UpdateCommand({
        TableName: this.counterTableName,
        Key: {
          id: 'control_sequence'
        },
        UpdateExpression: 'ADD #counter :increment SET #lastUpdated = :timestamp',
        ExpressionAttributeNames: {
          '#counter': 'counter',
          '#lastUpdated': 'lastUpdated'
        },
        ExpressionAttributeValues: {
          ':increment': 1,
          ':timestamp': new Date().toISOString()
        },
        ReturnValues: 'UPDATED_NEW'
      });

      const result = await this.client.send(command);
      const newCounter = result.Attributes?.counter as number;
      
      if (!newCounter) {
        throw new Error('카운터 증가 실패');
      }

      // 7자리 문자열로 패딩 (0000001, 0000002, ...)
      return newCounter.toString().padStart(7, '0');

    } catch (error) {
      console.error('다음 제어 ID 생성 실패:', error);
      
      // 카운터 테이블이 초기화되지 않았을 경우 초기화 시도
      if (error.name === 'ValidationException') {
        await this.initializeCounter();
        return await this.getNextControlId(); // 재시도
      }
      
      throw error;
    }
  }

  /**
   * 카운터 초기화
   */
  async initializeCounter(): Promise<void> {
    try {
      const command = new PutCommand({
        TableName: this.counterTableName,
        Item: {
          id: 'control_sequence',
          counter: 0,
          lastUpdated: new Date().toISOString()
        },
        ConditionExpression: 'attribute_not_exists(id)' // 이미 존재하면 실행하지 않음
      });

      await this.client.send(command);
      console.log('제어 ID 카운터 초기화 완료');

    } catch (error) {
      // 이미 존재하는 경우는 무시
      if (error.name !== 'ConditionalCheckFailedException') {
        console.error('카운터 초기화 실패:', error);
        throw error;
      }
    }
  }

  /**
   * 현재 카운터 값 조회
   */
  async getCurrentCounter(): Promise<number> {
    try {
      const command = new GetCommand({
        TableName: this.counterTableName,
        Key: {
          id: 'control_sequence'
        }
      });

      const result = await this.client.send(command);
      return result.Item?.counter as number || 0;

    } catch (error) {
      console.error('현재 카운터 조회 실패:', error);
      return 0;
    }
  }
}