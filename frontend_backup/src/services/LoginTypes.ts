// 타입 분리
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface CodeFormData {
  code: string;
}

// 실제 백엔드 연동 전까지 사용하는 목업 API
export async function loginApi(form: LoginFormData): Promise<void> {
  // 유효성 통과 후 지연 시뮬레이션
  await new Promise((r) => setTimeout(r, 1000));
  // 실패 시나리오가 필요하면 에러 throw
  // throw new Error("INVALID_CREDENTIALS");
}

export async function verifyCodeApi(form: CodeFormData): Promise<void> {
  try {
const response = await fetch(`/login/code/${form.code}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('NETWORK_ERROR');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error('INVALID_CODE');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('INVALID_CODE');
  }
}

export async function requestCodeApi(): Promise<void> {
  await new Promise((r) => setTimeout(r, 500));
}
