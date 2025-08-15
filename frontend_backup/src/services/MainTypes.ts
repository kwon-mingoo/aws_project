// MainTypes.ts - 메인 화면 타입 정의

export interface MainViewRequest {
  event: 'main_view_enter';
  timestamp: string;
  deviceInfo?: {
    type: 'web' | 'mobile';
    browser: string;
    resolution: string;
  };
}

export interface MainViewResponse {
  status: 'ready' | 'initializing' | 'error';
  userAuth: boolean;
  sensorConnected: boolean;
  nextPage: string;
  delay: number;
}

export interface MainViewError {
  error: 'sensor_connection_failed' | 'auth_required' | 'init_timeout';
  message: string;
}

export interface MainScreenState {
  isInitializing: boolean;
  isReady: boolean;
  userAuth: boolean;
  sensorConnected: boolean;
  error: string | null;
  showRetryButton: boolean;
  nextPage: string;
}

// 메인 화면 API 클래스
export class MainAPI {
  private static readonly API_ENDPOINT = '/api/main/initialize';
  private static readonly TIMEOUT_DURATION = 5000; // 5초

  static async initializeMainView(): Promise<MainViewResponse | MainViewError> {
    try {
      const deviceInfo = this.getDeviceInfo();
      const request: MainViewRequest = {
        event: 'main_view_enter',
        timestamp: new Date().toISOString(),
        deviceInfo
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_DURATION);

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

  // 디바이스 정보 수집
  private static getDeviceInfo() {
    return {
      type: 'web' as const,
      browser: this.getBrowserName(),
      resolution: `${window.screen.width}x${window.screen.height}`
    };
  }

  // 브라우저 이름 감지
  private static getBrowserName(): string {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    
    return 'Unknown';
  }

  // 인증 토큰 가져오기 (필요시)
  private static getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  // 개발용 목 데이터 생성
  static generateMockResponse(): Promise<MainViewResponse> {
    return new Promise((resolve) => {
      // 1.5초 후 준비 완료로 응답
      setTimeout(() => {
        resolve({
          status: 'ready',
          userAuth: true,
          sensorConnected: true,
          nextPage: '/Dashboard',
          delay: 2000
        });
      }, 1500);
    });
  }
}

// 메인 화면 유틸리티 함수들
export class MainUtils {
  // 에러 메시지 현지화
  static getLocalizedErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      'sensor_connection_failed': '센서 연결에 실패했습니다. 다시 시도해주세요.',
      'auth_required': '로그인이 필요합니다.',
      'init_timeout': '초기 상태 점검이 지연되고 있습니다.'
    };

    return errorMessages[error] || '알 수 없는 오류가 발생했습니다.';
  }

  // 시스템 상태 체크
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

  // 페이지 전환 지연 시간 계산
  static calculateTransitionDelay(delay: number): number {
    return Math.max(1000, Math.min(5000, delay)); // 1-5초 사이로 제한
  }
}