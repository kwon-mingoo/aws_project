// src/quicksight/quicksight.module.ts
// AWS QuickSight 기능을 위한 NestJS 모듈
//
// 📦 모듈 구성:
// - QuickSightController: HTTP 엔드포인트 처리
// - QuickSightService: AWS QuickSight API 연동 로직
//
// 🔄 의존성 주입:
// - QuickSightService가 QuickSightController에 주입
// - AWS SDK 클라이언트 설정 및 초기화
//
// 🎯 기능:
// - 대시보드 목록 조회
// - 대시보드 상세 정보 조회  
// - 임베드 URL 생성 (등록된 사용자 & 익명 사용자)

import { Module } from '@nestjs/common';
import { QuickSightController } from './quicksight.controller';
import { QuickSightService } from './quicksight.service';

@Module({
  controllers: [QuickSightController], // HTTP 요청을 처리할 컨트롤러 등록
  providers: [QuickSightService],     // 의존성 주입이 가능한 서비스 등록
  exports: [QuickSightService],       // 다른 모듈에서도 QuickSightService 사용 가능하도록 내보내기
})
export class QuickSightModule {}