/**
 * MainTypes.ts - 메인 화면 타입 정의 및 시스템 초기화 API
 * 
 * 이 파일은 메인 화면의 시스템 초기화 과정에서 사용되는
 * 타입 정의와 API 통신 로직을 포함합니다.
 */
import { ENV_CONFIG } from '../config/env';

/**
 * 메인 화면 진입 시 백엔드로 전송하는 요청 타입
 */
export interface MainViewRequest {
  /** 이벤트 타입 - 메인 화면 진입 */
  event: 'main_view_enter';
  /** 요청 시간 (ISO 8601 형식) */
  timestamp: string;
  /** 디바이스 정보 (선택사항) */
  deviceInfo?: {
    /** 디바이스 타입 */
    type: 'web' | 'mobile';
    /** 브라우저 이름 */
    browser: string;
    /** 화면 해상도 */
    resolution: string;
  };
}

/**
 * 백엔드에서 반환하는 초기화 성공 응답 타입
 */
export interface MainViewResponse {
  /** 시스템 초기화 상태 */
  status: 'ready' | 'initializing' | 'error';
  /** 사용자 인증 여부 */
  userAuth: boolean;
  /** 센서 연결 상태 */
  sensorConnected: boolean;
  /** 다음으로 이동할 페이지 */
  nextPage: string;
  /** 화면 전환 지연 시간 (밀리초) */
  delay: number;
}

/**
 * 백엔드에서 반환하는 초기화 오류 응답 타입
 */
export interface MainViewError {
  /** 오류 타입 */
  error: 'sensor_connection_failed' | 'auth_required' | 'init_timeout';
  /** 사용자에게 표시할 오류 메시지 */
  message: string;
}

/**
 * 메인 화면의 로컬 상태 관리 타입
 */
export interface MainScreenState {
  /** 초기화 진행 중 여부 */
  isInitializing: boolean;
  /** 시스템 준비 완료 여부 */
  isReady: boolean;
  /** 사용자 인증 상태 */
  userAuth: boolean;
  /** 센서 연결 상태 */
  sensorConnected: boolean;
  /** 오류 메시지 */
  error: string | null;
  /** 재시도 버튼 표시 여부 */
  showRetryButton: boolean;
  /** 다음 화면 경로 */
  nextPage: string;
}

/**
 * 메인 화면 시스템 초기화 API 클래스
 * 
 * 애플리케이션 시작 시 백엔드와 통신하여 시스템 상태를 확인하고
 * 필요한 초기화 작업을 수행합니다.
 */
export class MainAPI {
  /** API 엔드포인트 */
  private static readonly API_ENDPOINT = `${ENV_CONFIG.API_BASE_URL}/api/main/initialize`;
  /** 요청 타임아웃 시간 (밀리초) */
  private static readonly TIMEOUT_DURATION = 5000; // 5초

  /**
   * 메인 화면 초기화 API 호출
   * 
   * 시스템 상태 점검을 위해 백엔드에 초기화 요청을 보냅니다.
   * 센서 연결 상태, 사용자 인증 상태 등을 확인합니다.
   * 
   * @returns Promise<MainViewResponse | MainViewError> 초기화 결과
   */
  static async initializeMainView(): Promise<MainViewResponse | MainViewError> {
    try {
      // 디바이스 정보 수집
      const deviceInfo = this.getDeviceInfo();
      const request: MainViewRequest = {
        event: 'main_view_enter',
        timestamp: new Date().toISOString(),
        deviceInfo
      };

      // 타임아웃 설정
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_DURATION);

      // API 요청
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // 'Authorization': `Bearer ${this.getAuthToken()}` // 필요시 추가
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // 에러 타입별 처리
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            error: 'init_timeout',
            message: '초기 상태 점검이 지연되고 있습니다.'
          };
        }
        
        if (error.message.includes('network') || error.message.includes('fetch')) {
          return {
            error: 'sensor_connection_failed',
            message: '센서 연결에 실패했습니다. 다시 시도해주세요.'
          };
        }
      }

      return {
        error: 'init_timeout',
        message: '시스템 초기화에 실패했습니다.'
      };
    }
  }

  /**
   * 디바이스 정보 수집
   * 
   * 사용자의 디바이스 정보를 수집하여 백엔드에 전송합니다.
   * 
   * @returns 디바이스 정보 객체
   */
  private static getDeviceInfo() {
    return {
      type: 'web' as const,
      browser: this.getBrowserName(),
      resolution: `${window.screen.width}x${window.screen.height}`
    };
  }

  /**
   * 브라우저 이름 감지
   * 
   * User-Agent 문자열을 분석하여 브라우저 이름을 반환합니다.
   * 
   * @returns 브라우저 이름
   */
  private static getBrowserName(): string {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    
    return 'Unknown';
  }

  /**
   * 인증 토큰 가져오기
   * 
   * 로컬 스토리지에서 인증 토큰을 가져옵니다.
   * 현재는 선택사항으로 구현되어 있습니다.
   * 
   * @returns 인증 토큰 또는 null
   */
  private static getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * 개발용 목 응답 데이터 생성
   * 
   * 백엔드 API가 준비되지 않았을 때 사용하는 목 데이터입니다.
   * 실제 운영 환경에서는 사용하지 마세요.
   * 
   * @returns Promise<MainViewResponse> 목 응답 데이터
   */
  static generateMockResponse(): Promise<MainViewResponse> {
    return new Promise((resolve) => {
      // 1.5초 후 준비 완료로 응답
      setTimeout(() => {
        resolve({
          status: 'ready',
          userAuth: true,
          sensorConnected: true,
          nextPage: '/chatbot',
          delay: 2000
        });
      }, 1500);
    });
  }
}

/**
 * 메인 화면 유틸리티 함수들
 * 
 * 메인 화면에서 사용하는 다양한 유틸리티 함수들을 제공합니다.
 * 에러 메시지 처리, 상태 검증, 시간 계산 등의 기능을 포함합니다.
 */
export class MainUtils {
  /**
   * 에러 메시지 현지화
   * 
   * API에서 받은 에러 코드를 사용자에게 친숙한 한국어 메시지로 변환합니다.
   * 
   * @param error 에러 코드
   * @returns 한국어로 된 에러 메시지
   */
  static getLocalizedErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      'sensor_connection_failed': '센서 연결에 실패했습니다. 다시 시도해주세요.',
      'auth_required': '로그인이 필요합니다.',
      'init_timeout': '초기 상태 점검이 지연되고 있습니다.'
    };

    return errorMessages[error] || '알 수 없는 오류가 발생했습니다.';
  }

  /**
   * 시스템 상태 체크
   * 
   * API 응답에서 시스템 상태를 버틸여 다음 단계로 진행 가능한지 확인합니다.
   * 
   * @param response API 응답 데이터
   * @returns 진행 가능 여부와 경고 메시지 리스트
   */
  static checkSystemStatus(response: MainViewResponse): {
    canProceed: boolean;
    warnings: string[];
  } {
    const warnings: string[] = [];
    
    if (!response.userAuth) {
      warnings.push('사용자 인증이 필요합니다.');
    }
    
    if (!response.sensorConnected) {
      warnings.push('센서 연결을 확인해주세요.');
    }
    
    const canProceed = response.status === 'ready' && warnings.length === 0;
    
    return { canProceed, warnings };
  }

  /**
   * 페이지 전환 지연 시간 계산
   * 
   * API에서 받은 지연 시간을 안전한 범위(1-5초) 내로 제한합니다.
   * 
   * @param delay API에서 받은 지연 시간 (밀리초)
   * @returns 안전한 범위로 제한된 지연 시간
   */
  static calculateTransitionDelay(delay: number): number {
    return Math.max(1000, Math.min(5000, delay)); // 1-5초 사이로 제한
  }
}