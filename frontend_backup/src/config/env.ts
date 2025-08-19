/**
 * ═══════════════════════════════════════════════════════════════
 * ⚙️ Environment Configuration - 환경설정 관리 모듈
 * ═══════════════════════════════════════════════════════════════
 * 
 * 주요 기능:
 * - React 환경변수 읽기 및 타입 안전성 보장
 * - API 서버 URL 설정 및 관리
 * - 개발/프로덕션 환경 구분
 * - URL 경로 결합 유틸리티 제공
 * 
 * 환경변수 설정:
 * - REACT_APP_API_BASE_URL: 백엔드 API 서버 주소
 * - REACT_APP_DEBUG: 디버그 모드 활성화 여부
 * 
 * 사용 예시:
 * ```typescript
 * import getApiUrl, { ENV_CONFIG } from './config/env';
 * 
 * const apiUrl = getApiUrl('/chatbot/ask');
 * console.log(ENV_CONFIG.DEBUG);
 * ```
 */

// src/config/env.ts

/**
 * 🛠️ 환경설정 타입 정의
 * TypeScript 타입 안전성을 위한 인터페이스
 */
export interface EnvConfig {
  API_BASE_URL: string;    // 백엔드 API 서버 베이스 URL
  DEBUG: boolean;          // 디버그 모드 활성화 여부
}

/**
 * 📖 환경변수 읽기 유틸리티 함수
 * React의 REACT_APP_ 접두사가 붙은 환경변수를 안전하게 읽습니다.
 * 
 * @param key - 환경변수 키 (REACT_APP_ 접두사 제외)
 * @param fallback - 기본값 (환경변수가 없을 때 사용)
 * @returns 환경변수 값 또는 기본값
 */
const read = (key: string, fallback = '') =>
  (process.env[`REACT_APP_${key}` as keyof NodeJS.ProcessEnv] as string) ?? fallback;

/**
 * 🌍 전역 환경설정 객체
 * 애플리케이션 전체에서 사용되는 환경설정 값들
 */
export const ENV_CONFIG: EnvConfig = {
  API_BASE_URL: read('API_BASE_URL', 'http://localhost:3001'),   // 기본: 로컬 개발 서버
  DEBUG: read('DEBUG', 'true').toLowerCase() === 'true',         // 기본: 디버그 모드 활성화
};

/**
 * 🔗 URL 경로 결합 유틸리티 함수
 * 베이스 URL과 엔드포인트를 안전하게 결합합니다.
 * 
 * 처리 규칙:
 * - endpoint가 절대 URL(http/https)이면 그대로 반환
 * - 상대 경로면 base URL과 결합
 * - 중복된 슬래시(/) 제거 및 정규화
 * 
 * @param base - 베이스 URL
 * @param path - 결합할 경로
 * @returns 완전한 URL
 */
const joinUrl = (base: string, path: string) => {
  // 절대 URL인지 확인 (http:// 또는 https://)
  if (/^https?:\/\//i.test(path)) return path;
  
  // 베이스 URL에서 끝의 슬래시 제거
  const s1 = base.replace(/\/+$/, '');
  // 경로에서 시작의 슬래시 제거
  const s2 = path.replace(/^\/+/, '');
  
  return `${s1}/${s2}`;
};

/**
 * 🎯 API URL 생성 함수
 * 
 * API 서비스에서 사용되는 메인 함수입니다.
 * 환경설정의 API_BASE_URL과 주어진 엔드포인트를 결합하여
 * 완전한 API URL을 생성합니다.
 * 
 * 사용 예시:
 * - getApiUrl('/chatbot/ask') → 'http://localhost:3001/chatbot/ask'
 * - getApiUrl('https://api.example.com/data') → 'https://api.example.com/data'
 * 
 * @param endpoint - API 엔드포인트 경로
 * @returns 완전한 API URL
 */
export default function getApiUrl(endpoint: string): string {
  return joinUrl(ENV_CONFIG.API_BASE_URL, endpoint);
}
