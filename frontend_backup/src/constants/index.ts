/**
 * ═══════════════════════════════════════════════════════════════
 * 📋 Constants - 애플리케이션 전역 상수 정의
 * ═══════════════════════════════════════════════════════════════
 * 
 * 애플리케이션에서 사용되는 모든 상수값들을 중앙 집중식으로 관리합니다.
 * 타입 안전성과 코드 일관성을 위해 'as const' 어설션을 사용합니다.
 * 
 * 주요 상수 그룹:
 * - CHATBOT_CONSTANTS: 챗봇 기능 관련 설정값
 * - UI_CONSTANTS: UI/UX 관련 설정값 (향후 확장용)
 * - ERROR_MESSAGES: 에러 메시지 텍스트 모음
 * 
 * 사용하는 컴포넌트:
 * - ChatbotScreen, UseChatbot 훅
 * - 메시지 검증 유틸리티 함수
 * - API 서비스 모듈
 * 
 * 설정 변경 시 주의사항:
 * - MAX_MESSAGE_LENGTH 변경 시 백엔드 API 제한도 함께 확인
 * - TIMEOUT 값 변경 시 사용자 경험 고려
 * - 에러 메시지 변경 시 다국어 지원 계획 고려
 */

/**
 * 🤖 챗봇 기능 관련 상수
 * 챗봇의 동작과 제한사항을 정의하는 핵심 설정값들
 */
export const CHATBOT_CONSTANTS = {
  MAX_HISTORY: 50,           // 최대 대화 이력 보관 개수 (메모리 및 성능 고려)
  MAX_MESSAGE_LENGTH: 300,   // 메시지 최대 길이 (✅ 백엔드 API 제한과 일치 필수)
  MIN_MESSAGE_LENGTH: 1,     // 메시지 최소 길이 (빈 메시지 방지)
  TYPING_DELAY_MS: 250,      // 기본 타이핑 시뮬레이션 지연 시간 (자연스러운 UX)
  REQUEST_TIMEOUT_MS: 30000, // API 요청 타임아웃 (30초 - 긴 응답 생성 시간 고려)
} as const;

/**
 * 🎨 UI/UX 관련 상수
 * 향후 UI 설정값들을 추가할 수 있는 확장 가능한 구조
 * 현재는 비어있지만 테마, 애니메이션 설정 등을 추가할 예정
 */
export const UI_CONSTANTS = {} as const;

/**
 * ❌ 에러 메시지 상수 모음
 * 사용자에게 표시되는 모든 에러 메시지를 중앙 관리
 * 다국어 지원 시 이 구조를 기반으로 확장 가능
 */
export const ERROR_MESSAGES = {
  /**
   * 🤖 챗봇 관련 에러 메시지
   * 사용자 입력 검증 및 API 통신 에러에 대한 친화적인 안내
   */
  CHATBOT: {
    EMPTY_MESSAGE: '메시지를 입력해주세요.',     // 빈 메시지 입력 시
    TOO_LONG: `메시지는 ${CHATBOT_CONSTANTS.MAX_MESSAGE_LENGTH}자 이내로 입력해주세요.`, // 길이 초과 시
    PROCESSING_ERROR: '답변 생성 중 오류가 발생했습니다.',      // AI 응답 생성 실패
    CONNECTION_ERROR: '챗봇 서버에 연결할 수 없습니다.',       // 네트워크 연결 실패
    VALIDATION_ERROR: '입력값이 올바르지 않습니다.',          // 일반적인 검증 실패
  },
  // 📝 향후 추가 가능한 에러 메시지 그룹:
  // AUTH: { ... },      // 인증 관련 에러
  // DASHBOARD: { ... },  // 대시보드 관련 에러
  // HISTORY: { ... },    // 히스토리 관련 에러
} as const;

/**
 * 📦 기본 내보내기
 * 다른 모듈에서 편리하게 사용할 수 있도록 주요 상수들을 묶어서 제공
 * 
 * 사용 예시:
 * ```typescript
 * import constants, { CHATBOT_CONSTANTS } from './constants';
 * 
 * // 직접 사용
 * if (message.length > CHATBOT_CONSTANTS.MAX_MESSAGE_LENGTH) { ... }
 * 
 * // 객체로 사용
 * const { CHATBOT_CONSTANTS } = constants;
 * ```
 */
export default {
  CHATBOT_CONSTANTS,  // 챗봇 관련 모든 상수
  ERROR_MESSAGES,     // 에러 메시지 모음
  // UI_CONSTANTS는 현재 비어있어서 제외
};
