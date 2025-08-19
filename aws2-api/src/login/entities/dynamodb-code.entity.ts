import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable } from '@nestjs/common';

export interface CodeEntity {
  id: string;
  code: string;
  description?: string;
  isActive: boolean;
  expiresAt?: string; // ISO string format
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class DynamoDBCodeDatabase {
  private client: DynamoDBDocumentClient;
  private tableName = 'LoginCodes';

  constructor() {
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.client = DynamoDBDocumentClient.from(dynamoClient);
  }

  async findAll(): Promise<CodeEntity[]> {
    try {
      const command = new ScanCommand({
        TableName: this.tableName,
      });
      
      const result = await this.client.send(command);
      return result.Items as CodeEntity[] || [];
    } catch (error) {
      console.error('DynamoDB findAll error:', error);
      throw error;
    }
  }

  async findByCode(code: string): Promise<CodeEntity | null> {
    try {
      const command = new QueryCommand({
        TableName: this.tableName,
        IndexName: 'CodeIndex',
        KeyConditionExpression: 'code = :code',
        ExpressionAttributeValues: {
          ':code': code,
        },
      });

      const result = await this.client.send(command);
      const items = result.Items as CodeEntity[];
      
      if (!items || items.length === 0) return null;
      
      const foundCode = items[0];
      
      // 활성 상태 체크
      if (!foundCode.isActive) return null;
      
      // 만료 시간 체크
      if (foundCode.expiresAt && new Date(foundCode.expiresAt) < new Date()) {
        return null;
      }
      
      return foundCode;
    } catch (error) {
      console.error('DynamoDB findByCode error:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<CodeEntity | null> {
    try {
      const command = new GetCommand({
        TableName: this.tableName,
        Key: { id },
      });

      const result = await this.client.send(command);
      return result.Item as CodeEntity || null;
    } catch (error) {
      console.error('DynamoDB findById error:', error);
      throw error;
    }
  }

  async create(data: Omit<CodeEntity, 'id' | 'createdAt' | 'updatedAt'>): Promise<CodeEntity> {
    try {
      const now = new Date().toISOString();
      const id = `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newCode: CodeEntity = {
        ...data,
        id,
        createdAt: now,
        updatedAt: now,
      };

      const command = new PutCommand({
        TableName: this.tableName,
        Item: newCode,
      });

      await this.client.send(command);
      return newCode;
    } catch (error) {
      console.error('DynamoDB create error:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<Omit<CodeEntity, 'id' | 'createdAt'>>): Promise<CodeEntity | null> {
    try {
      // 먼저 기존 아이템 조회
      const existing = await this.findById(id);
      if (!existing) return null;

      const updateExpression: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id' && key !== 'createdAt') {
          updateExpression.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = value;
        }
      });

      // updatedAt 추가
      updateExpression.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const command = new UpdateCommand({
        TableName: this.tableName,
        Key: { id },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: 'ALL_NEW',
      });

      const result = await this.client.send(command);
      return result.Attributes as CodeEntity;
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

  // 초기 데이터 삽입 (개발용)
  async seedData(): Promise<void> {
    const defaultCodes = [
      {
        code: '3251',
        description: '기본 입장코드',
        isActive: true,
      },
      {
        code: '1234',
        description: '테스트 코드',
        isActive: true,
      },
      {
        code: 'admin',
        description: '관리자 코드',
        isActive: true,
      },
    ];

    for (const codeData of defaultCodes) {
      // 이미 존재하는지 확인
      const existing = await this.findByCode(codeData.code);
      if (!existing) {
        await this.create(codeData);
        console.log(`초기 코드 생성: ${codeData.code}`);
      }
    }
  }
}