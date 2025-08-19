// TransitionTypes.ts - 중간 로딩 화면 타입 정의
import { ENV_CONFIG } from '../config/env';

export interface TransitionRequest {
  event: 'transition_request';
  targetRole: 'admin' | 'user';
  timestamp: string;
}

export interface TransitionResponse {
  status: 'transition_ready';
  nextPage: string;
  delay: number;
}

export interface TransitionError {
  error: 'unauthorized_role' | 'token_expired' | 'resource_load_failed' | 'transition_timeout';
  message: string;
}

export interface TransitionState {
  isTransitioning: boolean;      
  isLoading: boolean;
  isReady: boolean;
  progress: number;
  arrowOpacity: number;     
  error: string | null;
  showRetryButton: boolean;
  targetRole: 'admin' | 'user';
  nextPage: string; 
}

// 중간 로딩 API 클래스
export class TransitionAPI {
  private static readonly API_ENDPOINT = `${ENV_CONFIG.API_BASE_URL}/api/transition/initialize`;
  private static readonly TIMEOUT_DURATION = 5000; // 5초

  static async initializeTransition(targetRole: 'admin' | 'user'): Promise<TransitionResponse | TransitionError> {
    try {
      const request: TransitionRequest = {
        event: 'transition_request',
        targetRole,
        timestamp: new Date().toISOString()
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT_DURATION);

      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('unauthorized_role');
        }
        if (response.status === 403) {
          throw new Error('token_expired');
        }
        throw new Error('resource_load_failed');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            error: 'transition_timeout',
            message: '전환 중 문제가 발생했습니다. 다시 시도해주세요.'
          };
        }
        
        const errorType = error.message as TransitionError['error'];
        return {
          error: errorType,
          message: this.getErrorMessage(errorType)
        };
      }

      return {
        error: 'resource_load_failed',
        message: '리소스 로딩에 실패했습니다.'
      };
    }
  }

  // 인증 토큰 가져오기
  private static getAuthToken(): string {
    return localStorage.getItem('auth_token') || 'demo_token';
  }

  // 에러 메시지 매핑
  private static getErrorMessage(errorType: TransitionError['error']): string {
    const errorMessages: Record<TransitionError['error'], string> = {
      'unauthorized_role': '접근 권한이 없습니다. 다시 로그인하세요.',
      'token_expired': '인증이 만료되었습니다. 다시 로그인해주세요.',
      'resource_load_failed': '권한 기반 리소스 로딩에 실패했습니다.',
      'transition_timeout': '전환 중 문제가 발생했습니다. 다시 시도해주세요.'
    };

    return errorMessages[errorType];
  }

  // 개발용 목 데이터 생성
  static generateMockResponse(targetRole: 'admin' | 'user'): Promise<TransitionResponse> {
    return new Promise((resolve) => {
      // 1.5초 후 준비 완료로 응답
      setTimeout(() => {
        resolve({
          status: 'transition_ready',
          nextPage: targetRole === 'admin' ? '/admin/dashboard' : '/user/dashboard',
          delay: 2000
        });
      }, 1500);
    });
  }
}
export type AnimationStage = 'start' | 'middle' | 'intense' | 'complete';

// 중간 로딩 유틸리티 함수들
export class TransitionUtils {
  // 진행률을 화살표 투명도로 변환
  static getArrowOpacity(progress: number): number {
    return Math.min(1, Math.max(0.3, progress / 100));
  }

  // 진행률을 화살표 크기로 변환
  static getArrowScale(progress: number): number {
    return Math.min(1.1, Math.max(0.9, 0.9 + (progress / 100) * 0.2));
  }

static getAnimationStage(progress: number): AnimationStage {
  if (progress < 30) return 'start';
  if (progress < 60) return 'middle';
  if (progress < 95) return 'intense';   // ← end → intense
  return 'complete';
}

  // 에러 메시지 현지화
  static getLocalizedErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      'unauthorized_role': '접근 권한이 없습니다. 다시 로그인하세요.',
      'token_expired': '인증이 만료되었습니다. 다시 로그인해주세요.',
      'resource_load_failed': '권한 기반 리소스 로딩에 실패했습니다.',
      'transition_timeout': '전환 중 문제가 발생했습니다. 다시 시도해주세요.'
    };

    return errorMessages[error] || '알 수 없는 오류가 발생했습니다.';
  }

  static calculateArrowOpacity(progress: number): number {
    return this.getArrowOpacity(progress);
  }

  // 세션 플래그 관리
  static setTransitionFlag(): void {
    sessionStorage.setItem('transition_flag', 'true');
  }

  static getTransitionFlag(): boolean {
    return sessionStorage.getItem('transition_flag') === 'true';
  }

  static clearTransitionFlag(): void {
    sessionStorage.removeItem('transition_flag');
  }

  static checkTransitionFlag(): boolean {
    return this.getTransitionFlag();
  }
}

