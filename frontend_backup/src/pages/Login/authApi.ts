// 타입
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface CodeFormData {
  code: string;
}

// 실제 API 대신 목 함수(원하면 fetch로 바꾸세요)
export async function loginApi(data: LoginFormData): Promise<void> {
  // TODO: fetch('/api/login', { ... })
  await new Promise(r => setTimeout(r, 600)); // 지연
  if (data.email !== 'esteban_schiller@gmail.com' || !data.password) {
    throw new Error('invalid_credentials');
  }
}

export async function verifyCodeApi(data: CodeFormData): Promise<void> {
  await new Promise(r => setTimeout(r, 600));
  if (data.code !== '000000') {
    throw new Error('invalid_code');
  }
}

export async function requestCodeApi(): Promise<void> {
  await new Promise(r => setTimeout(r, 600));
}
