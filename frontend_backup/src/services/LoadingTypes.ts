/**
 * LoadingTypes.ts - 로딩 화면 관련 타입 정의 및 API
 * 
 * 애플리케이션 초기 로딩 과정에서 사용하는 타입과 API 통신 로직을
 * 정의합니다. 로딩 진행률, 상태 메시지, 백엔드 연결 확인 등의 기능을 제공합니다.
 */
import { ENV_CONFIG } from '../config/env';

/**
 * 로딩 화면의 로컬 상태 관리 타입
 */
export interface LoadingState {
  /** 로딩 중 여부 */
  isLoading: boolean;
  /** 시스템 준비 완료 여부 */
  isReady: boolean;
  /** 로딩 진행률 (0-100) */
  progress: number;
  /** 현재 로딩 단계 메시지 */
  message: string;
  /** 오류 메시지 */
  error: string | null;
  /** 재시도 버튼 표시 여부 */
  showRetryButton: boolean;
}

/**
 * 백엔드에서 반환하는 로딩 성공 응답 타입
 */
export interface LoadingResponse {
  /** 응답 성공 여부 */
  success: boolean;
  /** 시스템 준비 완료 여부 */
  isReady: boolean;
  /** 다음으로 이동할 페이지 경로 */
  redirect: string;
  /** 페이지 전환 지연 시간 (밀리초) */
  delay: number;
  /** 시스템 초기화 상태 */
  status: 'ready' | 'initializing' | 'error';
  /** 상태 메시지 */
  message: string;
  /** 센서 연결 상태 */
  sensorConnected: boolean;
  /** 응답 생성 시간 (timestamp) */
  timestamp: number;
}

/**
 * 백엔드에서 반환하는 로딩 오류 응답 타입
 */
export interface LoadingError {
  /** 응답 성공 여부 (항상 false) */
  success: false;
  /** 사용자에게 표시할 주요 오류 메시지 */
  message: string;
  /** 추가 오류 세부사항 (선택사항) */
  error?: string;
}

/**
 * 로딩 화면 API 클래스
 * 
 * 애플리케이션 초기 로딩 시 백엔드와 통신하여 시스템 상태를 확인하고
 * 다음 단계로 진행할지 결정하는 API 로직을 제공합니다.
 */
export class LoadingAPI {
  /** API 베이스 URL */
  private static baseURL = `${ENV_CONFIG.API_BASE_URL}/api/main`;

  /**
   * 메인 화면 진입 API 호출
   * 
   * 애플리케이션 시작 시 백엔드에 시스템 초기화 상태를 확인합니다.
   * API 호출이 실패하면 대비용 목 데이터를 반환합니다.
   * 
   * @returns Promise<LoadingResponse | LoadingError> 로딩 결과 또는 오류
   */
  static async enterMainView(): Promise<LoadingResponse | LoadingError> {
    try {
      const response = await fetch(`${this.baseURL}/enter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // API 실패 시 대비용 목 데이터 반환
      return {
        success: true,
        isReady: true,
        redirect: '/main',
        delay: 3000,
        status: 'ready',
        message: 'System ready (Mock data)',
        sensorConnected: true,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 개발용 목 응답 데이터 생성
   * 
   * 백엔드 API가 준비되지 않았을 때 사용하는 목 데이터입니다.
   * 실제 운영 환경에서는 사용하지 마세요.
   * 
   * @returns Promise<LoadingResponse | LoadingError> 목 로딩 응답 데이터
   */
  static async generateMockResponse(): Promise<LoadingResponse | LoadingError> {
    // 1초 지연 후 목 응답 반환
    await LoadingUtils.delay(1000);
    return {
      success: true,
      isReady: true,
      redirect: '/main',
      delay: 3000,
      status: 'ready',
      message: 'System initialized successfully',
      sensorConnected: true,
      timestamp: Date.now()
    };
  }
}

/**
 * 로딩 화면 유틸리티 함수들
 * 
 * 로딩 화면에서 사용하는 다양한 유틸리티 함수들을 제공합니다.
 * 메시지 포맷팅, 지연 처리, 애니메이션 단계 계산 등의 기능을 포함합니다.
 */
export class LoadingUtils {
  /**
   * 로딩 진행률에 따른 메시지 포맷팅
   * 
   * 로딩 진행 단계에 따라 적절한 메시지를 반환합니다.
   * 
   * @param progress 로딩 진행률 (0-100)
   * @returns 현재 단계에 맞는 로딩 메시지
   */
  static formatLoadingMessage(progress: number): string {
    if (progress < 20) return 'Initializing system...';
    if (progress < 40) return 'Checking sensor connections...';
    if (progress < 60) return 'Loading configuration...';
    if (progress < 80) return 'Preparing dashboard...';
    return 'Almost ready...';
  }

  /**
   * 비동기 지연 함수
   * 
   * 지정된 시간만큼 대기한 후 Promise를 완료합니다.
   * 
   * @param ms 지연 시간 (밀리초)
   * @returns Promise<void>
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 진행률에 따른 화살 길이 계산
   * 
   * 로딩 진행률에 따라 화살의 길이를 계산합니다.
   * 100을 초과하지 않도록 제한합니다.
   * 
   * @param progress 로딩 진행률 (0-100)
   * @returns 화살 길이 (0-100)
   */
  static getArrowLength(progress: number): number {
    return Math.min(progress, 100);
  }

  /**
   * 진행률에 따른 애니메이션 단계 계산
   * 
   * 로딩 진행률에 따라 애니메이션 단계를 계산합니다.
   * 각 단계마다 다른 시각적 효과를 제공할 때 사용합니다.
   * 
   * @param progress 로딩 진행률 (0-100)
   * @returns 애니메이션 단계 (1-4)
   */
  static getAnimationStage(progress: number): number {
    if (progress < 25) return 1;
    if (progress < 50) return 2;
    if (progress < 75) return 3;
    return 4;
  }
}