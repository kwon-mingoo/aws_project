/**
 * ═══════════════════════════════════════════════════════════════
 * 🛠️ Utility Functions - 공통 유틸리티 함수 모음
 * ═══════════════════════════════════════════════════════════════
 * 
 * 주요 기능:
 * - 챗봇 관련 유틸리티 함수 (메시지 검증, ID 생성, 타이핑 지연 등)
 * - 로컬 스토리지 관리 유틸리티
 * - 에러 메시지 상수 정의
 * - 세션 및 히스토리 관리
 * 
 * 사용하는 컴포넌트:
 * - ChatbotScreen, UseChatbot 훅에서 주로 사용
 * - 메시지 검증, 세션 관리, 데이터 저장 등에 활용
 * 
 * API 연동 관련:
 * - 세션 ID 관리 (대화 연속성 유지)
 * - 메시지 검증 (API 호출 전 유효성 검사)
 * - 타이핑 지연 계산 (UX 향상)
 */

// src/utils/index.ts
import { CHATBOT_CONSTANTS } from '../constants';

// 메시지 타입 (임시 타입, 실제로는 ChatMessage 사용)
type AnyMsg = any;

/**
 * 🔑 로컬 스토리지 키 상수
 * 데이터 저장 시 사용되는 키 값들을 중앙 관리
 */
const KEYS = {
  SESSION_ID: 'session_id',    // 챗봇 세션 ID
  HISTORY: 'history',          // 대화 이력
} as const;

/**
 * ❌ 에러 메시지 상수 정의
 * 사용자에게 표시되는 모든 에러 메시지를 중앙 관리
 */
export const ERROR_MESSAGES = {
  CHATBOT: {
    EMPTY_MESSAGE: '메시지를 입력해주세요.',
    TOO_LONG: '메시지는 300자 이내로 입력해주세요.',
    PROCESSING_ERROR: '답변 생성 중 오류가 발생했습니다.',
    CONNECTION_ERROR: '챗봇 서버에 연결할 수 없습니다.',
    VALIDATION_ERROR: '유효하지 않은 메시지입니다.',
  },
  // 향후 다른 기능의 에러 메시지 추가 가능
};


/**
 * 🤖 챗봇 관련 유틸리티 함수 모음
 * 메시지 처리, 세션 관리, 검증 등 챗봇 기능에 필요한 모든 유틸리티 제공
 */
export const chatbotUtils = {
  /**
   * 🆔 고유 ID 생성 함수들
   * 메시지 ID, 세션 ID 등에 사용되는 유니크한 식별자 생성
   */
  
  /** 
   * 랜덤 고유 ID 생성
   * Math.random과 현재 시간을 조합하여 충돌 가능성을 최소화
   */
  makeId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  },
  
  /** 메시지 ID 생성 (makeId의 별칭) */
  generateMessageId(): string {
    return this.makeId();
  },

  /**
   * 📝 메시지 검증 및 정규화 함수들
   * API 호출 전 사용자 입력을 검증하고 안전하게 처리
   */
  
  /** 빈 메시지인지 확인 */
  isEmptyMessage(msg: string): boolean {
    return !msg || msg.trim().length === 0;
  },
  
  /** 메시지 길이 제한 (자동 잘라내기) */
  clampMessage(msg: string): string {
    const m = msg ?? '';
    const max = CHATBOT_CONSTANTS.MAX_MESSAGE_LENGTH;
    return m.length <= max ? m : m.slice(0, max);
  },
  
  /** 
   * 메시지 유효성 검증
   * API 호출 전 필수 검증 단계
   * 
   * @param msg - 검증할 메시지
   * @returns 검증 결과 객체 (isValid: boolean, error?: string)
   */
  validateMessage(msg: string): { isValid: boolean; error?: string } {
    const text = (msg ?? '').trim();
    
    // 최소 길이 검증
    if (text.length < CHATBOT_CONSTANTS.MIN_MESSAGE_LENGTH) {
      return { isValid: false, error: '메시지를 입력해주세요.' };
    }
    
    // 최대 길이 검증
    if (text.length > CHATBOT_CONSTANTS.MAX_MESSAGE_LENGTH) {
      return {
        isValid: false,
        error: `메시지는 ${CHATBOT_CONSTANTS.MAX_MESSAGE_LENGTH}자 이내로 입력해주세요.`,
      };
    }
    
    return { isValid: true };
  },

  /**
   * ⏱️ 타이핑 지연 계산 함수들
   * 자연스러운 챗봇 응답을 위한 타이핑 시뮬레이션
   */
  
  /** 
   * 텍스트 길이에 따른 타이핑 지연 시간 계산
   * 긴 텍스트일수록 더 오래 타이핑하는 것처럼 시뮬레이션
   */
  typingDelayFor(text: string): number {
    const base = CHATBOT_CONSTANTS.TYPING_DELAY_MS; // 기본 250ms
    const extra = Math.min(1500, (text?.length ?? 0) * 20); // 문자당 20ms, 최대 1.5초
    return base + extra;
  },
  
  /** calculateTypingDelay의 별칭 */
  calculateTypingDelay(text: string): number {
    return this.typingDelayFor(text);
  },

  /**
   * 💾 세션 및 히스토리 관리 함수들
   * 대화 연속성과 데이터 영속성을 위한 기능들
   */
  
  /** 
   * 세션 ID 관리
   * 기존 세션이 있으면 재사용, 없으면 새로 생성
   * API 호출 시 session_id 파라미터로 사용됨
   */
  getSessionId(): string {
    const saved = storageUtils.get<string>(KEYS.SESSION_ID, '');
    if (saved) return saved;
    
    // 새 세션 ID 생성 및 저장
    const sid = this.makeId();
    storageUtils.set(KEYS.SESSION_ID, sid);
    return sid;
  },
  
  /** 대화 이력 로컬 저장 */
  saveHistory(messages: AnyMsg[]): void {
    storageUtils.set(KEYS.HISTORY, messages ?? []);
  },
  
  /** 저장된 대화 이력 로드 */
  loadHistory(): AnyMsg[] {
    return storageUtils.get<AnyMsg[]>(KEYS.HISTORY, []);
  },
};

/** 스토리지 키 접두사 (향후 네임스페이스 구분용) */
const STORAGE_PREFIX = 'chatbot:';

/**
 * 💾 로컬 스토리지 관리 유틸리티
 * 브라우저 localStorage를 안전하게 사용하기 위한 래퍼 함수들
 * 
 * 주요 기능:
 * - JSON 자동 직렬화/역직렬화
 * - 에러 핸들링 (localStorage 접근 실패 시 기본값 반환)
 * - 타입 안전성 보장 (제네릭 타입 지원)
 */
export const storageUtils = {
  /**
   * 데이터 로드 (JSON 파싱 포함)
   * localStorage에서 데이터를 읽고 JSON.parse를 통해 객체로 변환
   * 
   * @param key - 스토리지 키
   * @param fallback - 기본값 (읽기 실패 시 반환)
   * @returns 저장된 값 또는 기본값
   */
  load: <T>(key: string, fallback: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      // JSON.parse 실패 또는 localStorage 접근 실패 시 기본값 반환
      return fallback;
    }
  },
  
  /**
   * 데이터 저장 (JSON 직렬화 포함)
   * 객체를 JSON.stringify로 문자열화하여 localStorage에 저장
   * 
   * @param key - 스토리지 키
   * @param value - 저장할 값
   */
  save: <T>(key: string, value: T): void => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  
  /**
   * 데이터 삭제
   * 
   * @param key - 삭제할 스토리지 키
   */
  remove: (key: string): void => {
    localStorage.removeItem(key);
  },

  /**
   * 호환성을 위한 별칭 메서드들
   * ChatbotTypes.ts 등 다른 모듈에서 사용하는 메서드명과 일치
   */
  get:  <T>(key: string, fallback: T): T => storageUtils.load<T>(key, fallback),
  set:  <T>(key: string, value: T): void => storageUtils.save<T>(key, value),
};

/**
 * 📦 기본 내보내기
 * 다른 모듈에서 편리하게 사용할 수 있도록 모든 유틸리티를 묶어서 제공
 */
export default {
  chatbotUtils,
  storageUtils,
};
