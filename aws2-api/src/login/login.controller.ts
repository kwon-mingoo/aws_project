/**
 * ================================================
 * Login Controller - 입장코드 검증시스템
 * ================================================
 * 
 * 📌 주요 기능:
 * - 입장코드 검증 (Rate Limited)
 * - 관리자용 코드 조회 (API Key 인증 필요)
 * - 보안 로깅 및 접근 제어
 * 
 * 🔒 보안 기능:
 * - Rate Limiting: 코드 검증 API는 1분에 10회 제한
 * - API Key 인증: 관리자 기능은 x-api-key 헤더 필요
 * - 입력 유효성 검사: 영문자/숫자만 허용, 1-20자 제한
 * - 보안 로깅: 모든 접근 시도 로그 기록
 * 
 * 💡 사용법:
 * - 일반 사용자: GET /login/code/:code (코드 검증)
 * - 관리자: GET /login/codes (API 키 필요)
 * 
 * 🗄️ 데이터베이스: AWS DynamoDB (LoginCodes 테이블)
 */

import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { LoginService } from './login.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { SecurityLoggingInterceptor } from '../common/interceptors/security-logging.interceptor';

/**
 * 입장코드 검증 컨트롤러
 * - 보안 로깅 인터셉터 적용으로 모든 요청 추적
 * - DynamoDB 기반 코드 저장 및 관리
 */
@Controller('login')
@UseInterceptors(SecurityLoggingInterceptor)
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  /**
   * 🔓 입장코드 검증 API (공개 API)
   * 
   * ✅ 기능: 프론트엔드에서 입장코드가 유효한지 검증
   * 🛡️ 보안: Rate Limiting 적용 (1분에 10회 제한)
   * 📊 로깅: 모든 검증 시도 로그 기록
   * 
   * @example
   * GET /login/code/0610
   * Response: {"success": true}
   * 
   * @param code - 검증할 입장코드 (예: 0404, admin0610, 0816)
   * @returns {object} - 검증 결과 {success: boolean}
   */
  @Get('code/:code')
  @UseGuards(ThrottlerGuard) // Rate Limiting 가드 적용
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 1분에 10회 제한
  async validateCode(@Param('code') code: string): Promise<{ success: boolean }> {
    const isValid = await this.loginService.validateCode(code);
    return { success: isValid };
  }

  /**
   * 🔐 모든 입장코드 목록 조회 (관리자 전용)
   * 
   * ✅ 기능: DynamoDB에 저장된 모든 입장코드 정보 조회
   * 🛡️ 보안: API Key 인증 필수 (x-api-key 헤더)
   * 📋 반환: 코드, 설명, 활성 상태, 생성/수정 시간 등
   * 
   * @example
   * GET /login/codes
   * Headers: x-api-key: admin-secure-key-2024-aws2
   * Response: [{"id": "...", "code": "3251", "description": "기본 입장코드", ...}]
   * 
   * @returns {CodeEntity[]} - 모든 코드 목록
   */
  @Get('codes')
  @UseGuards(ApiKeyGuard) // API Key 인증 가드 적용
  async getAllCodes() {
    return await this.loginService.getAllCodes();
  }
}