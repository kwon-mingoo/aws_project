// RoleTypes.ts - 역할 선택 타입 정의

export interface RoleSelectRequest {
  role: 'admin' | 'user';
  deviceId: string;
}

export interface RoleSelectResponse {
  success: true;
  redirect: string;
  message: string;
}

export interface RoleSelectError {
  success: false;
  message: string;
}

export interface ServerError {
  error: string;
}

export type RoleType = 'admin' | 'user';

export interface RoleOption {
  role: RoleType;
  title: string;
  subtitle: string;
  avatar: string;
  redirect: string;
}

export interface RoleSelectState {
  selectedRole: RoleType | null;
  isLoading: boolean;
  error: string | null;
  isTransitioning: boolean;
}

// 역할 선택 API 클래스
export class RoleSelectAPI {
  private static readonly API_ENDPOINT = '/api/role/select';
  private static readonly REQUEST_DELAY = 500; // 중복 클릭 방지

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
      console.error('역할 선택 API 오류:', error);
      
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

  // 디바이스 ID 생성/가져오기
  private static getDeviceId(): string {
    let deviceId = localStorage.getItem('device_id');
    
    if (!deviceId) {
      deviceId = `iot-device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('device_id', deviceId);
    }
    
    return deviceId;
  }

  // 개발용 목 응답 생성
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