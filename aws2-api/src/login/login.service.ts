import { Injectable, OnModuleInit } from '@nestjs/common';
import { DynamoDBCodeDatabase, CodeEntity } from './entities/dynamodb-code.entity';

@Injectable()
export class LoginService implements OnModuleInit {
  private readonly codeDatabase = new DynamoDBCodeDatabase();

  async onModuleInit() {
    // 초기 데이터 자동 생성 비활성화
    console.log('LoginService 초기화 완료 - 자동 코드 생성 없음');
  }

  /**
   * 입장코드 검증
   * @param code - 검증할 코드
   * @returns {boolean} - 유효한 코드인지 여부
   */
  async validateCode(code: string): Promise<boolean> {
    const foundCode = await this.codeDatabase.findByCode(code);
    return foundCode !== null;
  }

  /**
   * 모든 코드 조회
   * @returns {CodeEntity[]} - 모든 코드 목록
   */
  async getAllCodes(): Promise<CodeEntity[]> {
    return await this.codeDatabase.findAll();
  }
}