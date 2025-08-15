// LoadingTypes.ts - 로딩 관련 타입 정의

export interface LoadingState {
  isLoading: boolean;
  isReady: boolean;
  progress: number;
  message: string;
  error: string | null;
  showRetryButton: boolean;
}

export interface LoadingResponse {
  success: boolean;
  isReady: boolean;
  redirect: string;
  delay: number;
  status: 'ready' | 'initializing' | 'error';
  message: string;
  sensorConnected: boolean;
  timestamp: number;
}

export interface LoadingError {
  success: false;
  message: string;   // ← 이 필드가 필요합니다
  error?: string;    // (있으면 보조 메시지로 사용)
}

export class LoadingAPI {
  private static baseURL = '/api/main';

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
      console.error('Main API 호출 실패, 더미 데이터 반환:', error);
      
      // API 실패 시 더미 응답 반환
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

  static async generateMockResponse(): Promise<LoadingResponse | LoadingError> {
    // 개발용 목 응답
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

export class LoadingUtils {
  static formatLoadingMessage(progress: number): string {
    if (progress < 20) return 'Initializing system...';
    if (progress < 40) return 'Checking sensor connections...';
    if (progress < 60) return 'Loading configuration...';
    if (progress < 80) return 'Preparing dashboard...';
    return 'Almost ready...';
  }

  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static getArrowLength(progress: number): number {
    return Math.min(progress, 100);
  }

  static getAnimationStage(progress: number): number {
    if (progress < 25) return 1;
    if (progress < 50) return 2;
    if (progress < 75) return 3;
    return 4;
  }
}