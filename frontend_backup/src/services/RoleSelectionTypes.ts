/**
 * RoleSelectionTypes.ts - 역할 선택 관련 타입 정의 및 API
 * 
 * 사용자가 관리자 또는 일반 사용자 역할을 선택할 때 사용하는
 * 타입 정의와 API 통신 로직을 제공합니다.
 */
import { ENV_CONFIG } from '../config/env';

/**
 * 백엔드로 전송하는 역할 선택 요청 타입
 */
export interface RoleSelectRequest {
  /** 선택한 역할 (admin: 관리자, user: 사용자) */
  role: 'admin' | 'user';
  /** 디바이스 고유 ID */
  deviceId: string;
}

/**
 * 백엔드에서 반환하는 역할 선택 성공 응답 타입
 */
export interface RoleSelectResponse {
  /** 응답 성공 여부 (항상 true) */
  success: true;
  /** 다음으로 이동할 페이지 경로 */
  redirect: string;
  /** 사용자에게 표시할 메시지 */
  message: string;
}

/**
 * 백엔드에서 반환하는 역할 선택 오류 응답 타입
 */
export interface RoleSelectError {
  /** 응답 성공 여부 (항상 false) */
  success: false;
  /** 사용자에게 표시할 오류 메시지 */
  message: string;
}

/**
 * 서버 오류 응답 타입
 */
export interface ServerError {
  /** 서버 오류 메시지 */
  error: string;
}

/**
 * 역할 타입 정의
 */
export type RoleType = 'admin' | 'user';

/**
 * 역할 옵션 인터페이스 (역할 선택 화면에 표시되는 정보)
 */
export interface RoleOption {
  /** 역할 타입 */
  role: RoleType;
  /** 역할 제목 */
  title: string;
  /** 역할 부제목 */
  subtitle: string;
  /** 역할 대표 이미지 경로 */
  avatar: string;
  /** 역할 선택 후 이동할 경로 */
  redirect: string;
}

/**
 * 역할 선택 화면의 로컬 상태 관리 타입
 */
export interface RoleSelectState {
  /** 현재 선택된 역할 */
  selectedRole: RoleType | null;
  /** 로딩 상태 (역할 선택 처리 중) */
  isLoading: boolean;
  /** 오류 메시지 */
  error: string | null;
  /** 화면 전환 상태 */
  isTransitioning: boolean;
}

/**
 * 역할 선택 API 클래스
 * 
 * 사용자가 역할을 선택했을 때 백엔드와 통신하여
 * 역할 정보를 전송하고 인증하는 API 로직을 제공합니다.
 */
export class RoleSelectAPI {
  /** 역할 선택 API 엔드포인트 */
  private static readonly API_ENDPOINT = `${ENV_CONFIG.API_BASE_URL}/api/role/select`;
  /** 중복 요청 방지를 위한 지연 시간 (밀리초) */
  private static readonly REQUEST_DELAY = 500;

  /**
   * 역할 선택 API 호출
   * 
   * 사용자가 선택한 역할을 백엔드로 전송하여 인증하고
   * 다음 페이지 이동 정보를 수신합니다.
   * 
   * @param role 선택한 역할 ('admin' 또는 'user')
   * @returns Promise<RoleSelectResponse | RoleSelectError | ServerError> 역할 선택 결과
   */
  static async selectRole(role: RoleType): Promise<RoleSelectResponse | RoleSelectError | ServerError> {
    try {
      const deviceId = this.getDeviceId();
      const request: RoleSelectRequest = {
        role,
        deviceId
      };

      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        if (response.status === 500) {
          throw new Error('server_error');
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // 에러 타입별 처리
      if (error instanceof Error) {
        if (error.message === 'server_error') {
          return {
            error: '서버 오류로 역할 선택이 실패했습니다.'
          };
        }
      }
      
      return {
        success: false,
        message: '네트워크 오류로 역할 선택에 실패했습니다.'
      };
    }
  }

  /**
   * 디바이스 ID 생성 및 가져오기
   * 
   * 로컬 스토리지에서 디바이스 ID를 가져오거나,
   * 없을 경우 새로 생성하여 저장합니다.
   * 
   * @returns 디바이스 고유 ID
   */
  private static getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    
    if (!deviceId) {
      deviceId = `iot-device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('device_id', deviceId);
    }
    
    return deviceId;
  }

  /**
   * 개발용 목 응답 데이터 생성
   * 
   * 백엔드 API가 준비되지 않았을 때 사용하는 목 데이터입니다.
   * 실제 운영 환경에서는 사용하지 마세요.
   * 
   * @param role 선택한 역할
   * @returns Promise<RoleSelectResponse> 목 역할 선택 응답
   */
  static generateMockResponse(role: RoleType): Promise<RoleSelectResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const redirectPath = role === 'admin' ? '/admin/dashboard' : '/user/dashboard';
        const message = role === 'admin' ? '관리자 역할로 접속합니다.' : '사용자 역할로 접속합니다.';
        
        resolve({
          success: true,
          redirect: redirectPath,
          message
        });
      }, 1000 + Math.random() * 1000); // 1-2초 지연
    });
  }
}

// 역할 선택 유틸리티 함수들
export class RoleSelectUtils {
  // 중복 클릭 방지를 위한 디바운스
  private static lastClickTime = 0;
  private static readonly DEBOUNCE_DELAY = 1000; // 1초

  static canProceedWithSelection(): boolean {
    const now = Date.now();
    if (now - this.lastClickTime < this.DEBOUNCE_DELAY) {
      return false;
    }
    this.lastClickTime = now;
    return true;
  }

  // 역할 정보 가져오기
  static getRoleOptions(): RoleOption[] {
    return [
      {
        role: 'admin',
        title: 'Admin',
        subtitle: 'EX.professor',
        avatar: '/images/admin-avatar.jpg', // 실제 이미지 경로로 교체
        redirect: '/admin/dashboard'
      },
      {
        role: 'user',
        title: 'User',
        subtitle: 'EX. student',
        avatar: '/images/user-avatar.jpg', // 실제 이미지 경로로 교체
        redirect: '/user/dashboard'
      }
    ];
  }

  // 역할에 따른 메시지 생성
  static getRoleMessage(role: RoleType): string {
    switch (role) {
      case 'admin':
        return '관리자 권한으로 시스템에 접속합니다.';
      case 'user':
        return '사용자 권한으로 시스템에 접속합니다.';
      default:
        return '시스템에 접속합니다.';
    }
  }

  // 역할에 따른 색상 테마 반환
  static getRoleTheme(role: RoleType): string {
    switch (role) {
      case 'admin':
        return '#1f2937'; // 어두운 회색 (관리자)
      case 'user':
        return '#fb923c'; // 오렌지 (사용자)
      default:
        return '#6b7280';
    }
  }

  // 에러 메시지 현지화
  static getLocalizedErrorMessage(error: string): string {
    const errorMessages: Record<string, string> = {
      'invalid_role': '잘못된 역할 정보입니다.',
      'server_error': '서버 오류로 역할 선택이 실패했습니다.',
      'network_error': '네트워크 오류로 역할 선택에 실패했습니다.',
      'session_expired': '세션이 만료되었습니다. 다시 시도해주세요.'
    };

    return errorMessages[error] || '알 수 없는 오류가 발생했습니다.';
  }

  // 세션에 역할 저장
  static saveSelectedRole(role: RoleType): void {
    sessionStorage.setItem('selected_role', role);
    sessionStorage.setItem('role_selection_time', Date.now().toString());
  }

  // 저장된 역할 가져오기
  static getSavedRole(): RoleType | null {
    const savedRole = sessionStorage.getItem('selected_role');
    const selectionTime = sessionStorage.getItem('role_selection_time');
    
    // 24시간 후 세션 만료
    if (savedRole && selectionTime) {
      const elapsed = Date.now() - parseInt(selectionTime);
      if (elapsed < 24 * 60 * 60 * 1000) {
        return savedRole as RoleType;
      } else {
        // 만료된 세션 정리
        this.clearSavedRole();
      }
    }
    
    return null;
  }

  // 저장된 역할 정보 삭제
  static clearSavedRole(): void {
    sessionStorage.removeItem('selected_role');
    sessionStorage.removeItem('role_selection_time');
  }

  // 선택 유효성 검증
  static validateRoleSelection(role: string): role is RoleType {
    return role === 'admin' || role === 'user';
  }
}