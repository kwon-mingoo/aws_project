/**
 * ═══════════════════════════════════════════════════════════════
 * 🌐 API Service - 백엔드 서버와의 모든 HTTP 통신을 담당하는 중앙 서비스
 * ═══════════════════════════════════════════════════════════════
 * 
 * 주요 기능:
 * - 통합된 HTTP 클라이언트 제공
 * - 요청/응답 로깅 및 에러 핸들링
 * - 타임아웃 관리 및 AbortController를 통한 요청 취소
 * - 챗봇 API 전용 메서드 제공
 * - 헬스체크 및 연결 상태 모니터링
 * 
 * API 서버 구조:
 * - 베이스 URL: ENV_CONFIG.API_BASE_URL (환경설정에서 로드)
 * - 주요 엔드포인트:
 *   • /chatbot/ask: 챗봇 질의응답
 *   • /chatbot/health: 챗봇 서비스 상태 확인
 *   • /healthz: 서버 전체 상태 확인
 *   • /s3/*: S3 데이터 관련 API
 *   • /quicksight/*: AWS QuickSight 관련 API
 */

// src/services/apiService.ts - 백엔드 API 통신 서비스
import getApiUrl, { ENV_CONFIG } from '../config/env';

/**
 * 🔄 표준 API 응답 타입 정의
 * 모든 API 엔드포인트에서 공통으로 사용되는 응답 형식
 */
export interface ApiResponse<T = any> {
  success: boolean;      // 요청 성공 여부
  data?: T;             // 응답 데이터 (제네릭 타입)
  error?: string;       // 에러 메시지
  message?: string;     // 추가 메시지
}

/**
 * 🤖 챗봇 API 전용 타입 정의
 * /chatbot/* 엔드포인트에서 사용되는 요청/응답 형식
 */

/** 챗봇 질의 요청 데이터 */
export interface ChatbotApiRequest {
  query: string;          // 사용자 질문
  session_id?: string;    // 선택적 세션 ID (대화 연속성을 위함)
}

/** 
 * 챗봇 응답 데이터
 * 백엔드 Python 챗봇 모듈에서 처리된 결과를 포함
 */
export interface ChatbotApiResponse {
  answer: string;         // 챗봇의 답변
  route: 'sensor' | 'general' | 'sensor_cache' | 'sensor_detail' | 'error'; // 질문 라우팅 경로
  session_id: string;     // 세션 식별자
  turn_id: number;        // 대화 턴 번호
  processing_time: number; // 처리 시간 (ms)
  mode: string;           // 챗봇 모드
  docs_found?: number;    // 검색된 문서 수 (RAG 사용시)
  top_score?: number;     // 최고 유사도 점수 (RAG 사용시)
  error?: string;         // 에러 메시지 (있을 경우)
  traceback?: string;     // 상세 에러 추적 정보
}

/** 
 * 챗봇 서비스 헬스체크 응답
 * Python 챗봇 모듈의 가용성을 확인
 */
export interface ChatbotHealthResponse {
  status: 'healthy' | 'error';        // 전체 상태
  python_available: boolean;          // Python 환경 가용성
  chatbot_module_available: boolean;  // 챗봇 모듈 로드 상태
  error?: string;                     // 에러 메시지 (상태가 error일 때)
}

/**
 * ⚙️ HTTP 클라이언트 설정
 * 디버그 모드에서는 더 긴 타임아웃 허용 (개발 환경에서 디버깅을 위함)
 */
const DEFAULT_TIMEOUT = ENV_CONFIG.DEBUG ? 30000 : 10000;

/**
 * 🏗️ ApiService 클래스
 * 모든 HTTP 요청을 처리하는 중앙 서비스 클래스
 * 싱글톤 패턴으로 구현되어 애플리케이션 전체에서 하나의 인스턴스만 사용
 */
class ApiService {
  private baseUrl: string;    // API 서버 베이스 URL
  private timeout: number;    // 요청 타임아웃 (밀리초)

  constructor() {
    this.baseUrl = ENV_CONFIG.API_BASE_URL;
    this.timeout = DEFAULT_TIMEOUT;
  }

  /**
   * 🕒 타임아웃이 적용된 fetch 래퍼 메서드
   * 
   * 특징:
   * - AbortController를 사용한 요청 취소 기능
   * - 자동 JSON 헤더 설정
   * - 타임아웃 시 명확한 에러 메시지 제공
   * 
   * @param url - 요청할 URL
   * @param options - fetch 옵션
   * @param timeoutMs - 타임아웃 시간 (기본값: 인스턴스 설정값)
   * @returns Promise<Response>
   */
  private async fetchWithTimeout(
    url: string, 
    options: RequestInit = {}, 
    timeoutMs: number = this.timeout
  ): Promise<Response> {
    // AbortController로 요청 취소 기능 구현
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      // AbortError는 타임아웃으로 변환
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  /**
   * 🔄 통합 API 요청 헬퍼 메서드
   * 
   * 모든 API 요청의 공통 로직을 처리:
   * - URL 생성 (환경설정 기반)
   * - 요청/응답 로깅 (디버그 모드)
   * - HTTP 상태 코드 검증
   * - JSON 파싱 및 에러 핸들링
   * - 표준화된 응답 형식 반환
   * 
   * @param endpoint - API 엔드포인트 (예: '/chatbot/ask')
   * @param options - fetch 옵션 (method, body 등)
   * @returns Promise<ApiResponse<T>> - 표준화된 응답
   */
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      // 환경설정에 따른 전체 URL 생성
      const url = getApiUrl(endpoint);
      
      // 디버그 모드: 요청 정보 로깅
      if (ENV_CONFIG.DEBUG) {
        console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`);
        if (options.body) {
          console.log('📤 Request Body:', options.body);
        }
      }

      // 타임아웃이 적용된 HTTP 요청 실행
      const response = await this.fetchWithTimeout(url, options);
      
      // HTTP 상태 코드 검증
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // JSON 응답 파싱
      const data = await response.json();
      
      // 디버그 모드: 응답 데이터 로깅
      if (ENV_CONFIG.DEBUG) {
        console.log('📥 API Response:', data);
      }

      // 성공 응답 반환
      return {
        success: true,
        data
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // 디버그 모드: 에러 로깅
      if (ENV_CONFIG.DEBUG) {
        console.error('❌ API Error:', errorMessage);
      }

      // 실패 응답 반환
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * 📥 GET 요청 메서드
   * 데이터 조회용 HTTP GET 요청을 실행
   * 
   * @param endpoint - API 엔드포인트
   * @returns Promise<ApiResponse<T>> - 응답 데이터
   */
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  /**
   * 📤 POST 요청 메서드  
   * 데이터 전송용 HTTP POST 요청을 실행
   * 자동으로 JSON 직렬화 처리
   * 
   * @param endpoint - API 엔드포인트
   * @param data - 전송할 데이터 객체
   * @returns Promise<ApiResponse<T>> - 응답 데이터
   */
  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 🤖 챗봇 질의응답 API 호출
   * 
   * API 엔드포인트: POST /chatbot/ask
   * 백엔드의 Python 챗봇 모듈과 연동하여 사용자 질문에 대한 답변을 얻습니다.
   * 
   * 처리 과정:
   * 1. 사용자 질문을 백엔드로 전송
   * 2. 백엔드에서 Python 챗봇 모듈 호출
   * 3. RAG(Retrieval-Augmented Generation) 또는 일반 질의 처리
   * 4. 처리된 답변과 메타데이터 반환
   * 
   * @param query - 사용자 질문 (공백 제거 후 전송)
   * @param sessionId - 선택적 세션 ID (대화 연속성을 위함)
   * @returns Promise<ApiResponse<ChatbotApiResponse>> - 챗봇 응답
   */
  async askChatbot(query: string, sessionId?: string): Promise<ApiResponse<ChatbotApiResponse>> {
    const requestData: ChatbotApiRequest = {
      query: query.trim(),
      session_id: sessionId
    };

    return this.post<ChatbotApiResponse>('/chatbot/ask', requestData);
  }

  /**
   * 🩺 챗봇 서비스 헬스체크
   * 
   * API 엔드포인트: GET /chatbot/health
   * Python 챗봇 모듈의 가용성과 상태를 확인합니다.
   * 
   * 확인 항목:
   * - Python 환경 가용성
   * - 챗봇 모듈 로딩 상태
   * - 전체 서비스 상태
   * 
   * @returns Promise<ApiResponse<ChatbotHealthResponse>> - 헬스체크 결과
   */
  async checkChatbotHealth(): Promise<ApiResponse<ChatbotHealthResponse>> {
    return this.get<ChatbotHealthResponse>('/chatbot/health');
  }

  /**
   * 🏥 서버 전체 헬스체크
   * 
   * API 엔드포인트: GET /healthz
   * 백엔드 서버의 전반적인 상태를 확인합니다.
   * 
   * @returns Promise<ApiResponse<{ ok: boolean }>> - 서버 상태
   */
  async checkHealth(): Promise<ApiResponse<{ ok: boolean }>> {
    return this.get<{ ok: boolean }>('/healthz');
  }

  /**
   * 🔗 API 서버 연결 테스트
   * 
   * 간단한 헬스체크를 통해 서버와의 연결 상태를 확인합니다.
   * UI에서 연결 상태 표시를 위해 사용됩니다.
   * 
   * @returns Promise<boolean> - 연결 성공 여부
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.checkHealth();
      return response.success && response.data?.ok === true;
    } catch {
      return false;
    }
  }
}

/**
 * 🎯 싱글톤 인스턴스 생성
 * 애플리케이션 전체에서 하나의 ApiService 인스턴스만 사용
 */
export const apiService = new ApiService();

/**
 * 🚀 챗봇 API 편의 함수 모음
 * 챗봇 관련 API를 쉽게 사용할 수 있도록 하는 래퍼 함수들
 * 
 * 사용 예시:
 * ```typescript
 * import { chatbotApi } from './services/apiService';
 * 
 * const response = await chatbotApi.ask('센서 온도는?');
 * const isHealthy = await chatbotApi.health();
 * ```
 */
export const chatbotApi = {
  ask: (query: string, sessionId?: string) => apiService.askChatbot(query, sessionId),
  health: () => apiService.checkChatbotHealth(),
  testConnection: () => apiService.testConnection()
};

export default apiService;