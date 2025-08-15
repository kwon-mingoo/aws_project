// ChatbotTypes.ts - 챗봇 타입 정의

export interface ChatMessage {
  id: string;
  message: string;
  sender: 'user' | 'bot';
  timestamp: string;
  sensorData?: SensorData;
  status?: 'Good' | 'Normal' | 'Warning';
}

export interface SensorData {
  temperature: number;
  humidity: number;
  gasConcentration: number;
}

export interface ChatbotRequest {
  message: string;
  userId: string;
  timestamp: string;
}

export interface ChatbotResponse {
  success: true;
  reply: string;
  status: 'Good' | 'Normal' | 'Warning';
  sensorData: SensorData;
  timestamp: string;
}

export interface ChatbotError {
  success: false;
  error: string;
}

export interface ChatbotState {
  messages: ChatMessage[];
  isLoading: boolean;
  isTyping: boolean;
  inputMessage: string;
  error: string | null;
  modelStatus: 'Active' | 'Inactive' | 'Loading';
}

// 성공/실패 유니온의 편의 타입
export type ChatbotAPIResponse = ChatbotResponse | ChatbotError;


// 챗봇 API 클래스
export class ChatbotAPI {
  private static readonly API_ENDPOINT = '/api/chatbot/message';
  private static readonly MAX_MESSAGE_LENGTH = 300;

  static async sendMessage(message: string): Promise<ChatbotResponse | ChatbotError> {
    try {
      // 메시지 길이 검증
      if (!message || message.trim().length === 0) {
        return {
          success: false,
          error: '입력 메시지를 찾을 수 없습니다.'
        };
      }

      if (message.length > this.MAX_MESSAGE_LENGTH) {
        return {
          success: false,
          error: `메시지는 최대 ${this.MAX_MESSAGE_LENGTH}자까지 입력 가능합니다.`
        };
      }

      const request: ChatbotRequest = {
        message: message.trim(),
        userId: this.getUserId(),
        timestamp: new Date().toISOString()
      };

      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        if (response.status === 400) {
          return {
            success: false,
            error: '입력 메시지를 찾을 수 없습니다.'
          };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('챗봇 API 오류:', error);
      return {
        success: false,
        error: '서버 오류로 답변을 생성할 수 없습니다.'
      };
    }
  }

  // 사용자 ID 가져오기
  private static getUserId(): string {
    return localStorage.getItem('user_id') || 'admin001';
  }

  // 인증 토큰 가져오기
  private static getAuthToken(): string {
    return localStorage.getItem('auth_token') || 'demo_token';
  }

  // 개발용 목 응답 생성
  static generateMockResponse(message: string): Promise<ChatbotAPIResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const responses = [
          {
            reply: "현재 강의실의 온도는 25.6도, 습도는 60%, 가스 농도는 양호한 상태입니다. 😊 강의실의 실시간 환경 상태에 예측 정보를 알려드리고, 오늘의 리뷰도 제공합니다. 무엇을 도와드릴까요?",
            status: 'Good' as const,
            sensorData: {
              temperature: 25.6,
              humidity: 60.0,
              gasConcentration: 671
            }
          },
          {
            reply: "당신은 공기질 분석 비서로서, IoT 센서 정보를 기반으로 한결 보 간단·친절하게 답하세요.",
            status: 'Normal' as const,
            sensorData: {
              temperature: 24.2,
              humidity: 58.5,
              gasConcentration: 685
            }
          },
          {
            reply: "안녕하세요! 저는 AWS² IoT 공기질 분석 비서입니다. 😊 강의실의 실시간 환경 상태에 예측 정보를 알려드리고, 오늘의 리뷰도 제공합니다. 무엇을 도와드릴까요?",
            status: 'Good' as const,
            sensorData: {
              temperature: 25.5,
              humidity: 60.1,
              gasConcentration: 675
            }
          }
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        resolve({
          success: true,
          reply: randomResponse.reply,
          status: randomResponse.status,
          sensorData: randomResponse.sensorData,
          timestamp: new Date().toISOString()
        });
      }, 1000 + Math.random() * 1000); // 1-2초 지연
    });
  }
}

// 챗봇 유틸리티 함수들
export class ChatbotUtils {
  // 메시지 ID 생성
  static generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 시간 포맷팅
  static formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes.toString().padStart(2, '0');
    
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  }

  // 상태에 따른 색상 반환
  static getStatusColor(status: string): string {
    switch (status) {
      case 'Good':
        return '#10b981'; // green
      case 'Normal':
        return '#f59e0b'; // yellow
      case 'Warning':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  }

  // 초기 환영 메시지 생성
  static createWelcomeMessage(): ChatMessage {
    return {
      id: this.generateMessageId(),
      message: "안녕하세요! 저는 AWS² IoT 공기질 분석 비서입니다. 😊\n강의실의 실시간 환경 상태에 예측 정보를 알려드리고, 오늘의 리뷰도 제공합니다.\n무엇을 도와드릴까요?",
      sender: 'bot',
      timestamp: new Date().toISOString(),
      status: 'Good',
      sensorData: {
        temperature: 25.5,
        humidity: 60.1,
        gasConcentration: 675
      }
    };
  }

  // 메시지 검증
  static validateMessage(message: string): { isValid: boolean; error?: string } {
    if (!message || message.trim().length === 0) {
      return { isValid: false, error: '메시지를 입력해주세요.' };
    }

    if (message.length > 300) {
      return { isValid: false, error: '메시지는 최대 300자까지 입력 가능합니다.' };
    }

    return { isValid: true };
  }

  // 메시지 히스토리 저장
  static saveMessageHistory(messages: ChatMessage[]): void {
    try {
      const historyKey = `chatbot_history_${new Date().toDateString()}`;
      localStorage.setItem(historyKey, JSON.stringify(messages));
    } catch (error) {
      console.warn('메시지 히스토리 저장 실패:', error);
    }
  }

  // 메시지 히스토리 로드
  static loadMessageHistory(): ChatMessage[] {
    try {
      const historyKey = `chatbot_history_${new Date().toDateString()}`;
      const saved = localStorage.getItem(historyKey);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('메시지 히스토리 로드 실패:', error);
      return [];
    }
  }

  // 타이핑 효과를 위한 지연 계산
  static calculateTypingDelay(message: string): number {
    // 메시지 길이에 따라 타이핑 시간 계산 (최소 500ms, 최대 2000ms)
    const baseDelay = 500;
    const charDelay = message.length * 20;
    return Math.min(baseDelay + charDelay, 2000);
  }
}