// src/services/ChatbotAPI.ts

import { ChatbotAPIType } from './ChatbotTypes';

// API 기본 설정
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
const API_TIMEOUT = 60000; // 60초 타임아웃

// 백엔드 API 응답 타입
interface ChatbotResponseDto {
  answer: string;
  route: 'sensor' | 'general' | 'sensor_cache' | 'sensor_detail' | 'error';
  session_id: string;
  turn_id: number;
  processing_time: number;
  mode: string;
  docs_found?: number;
  top_score?: number;
  error?: string;
  traceback?: string;
}

interface ChatbotHealthDto {
  status: 'healthy' | 'error';
  python_available: boolean;
  chatbot_module_available: boolean;
  error?: string;
}

// 요청 타입
interface ChatbotQueryDto {
  query: string;
  session_id?: string;
}

class ChatbotAPIImpl implements ChatbotAPIType {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /**
   * 챗봇에 메시지 전송
   */
  async sendMessage(text: string, sessionId?: string | null): Promise<ChatbotResponseDto> {
    const requestBody: ChatbotQueryDto = {
      query: text,
      ...(sessionId && { session_id: sessionId }),
    };

    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/chatbot/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || 
          `API request failed with status ${response.status}: ${response.statusText}`
        );
      }

      const data: ChatbotResponseDto = await response.json();
      
      // 에러 응답 처리
      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    } catch (error) {
      console.error('ChatbotAPI.sendMessage error:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Failed to send message to chatbot');
    }
  }

  /**
   * 챗봇 건강 상태 확인
   */
  async checkHealth(): Promise<ChatbotHealthDto> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/chatbot/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const data: ChatbotHealthDto = await response.json();
      return data;
    } catch (error) {
      console.error('ChatbotAPI.checkHealth error:', error);
      
      return {
        status: 'error',
        python_available: false,
        chatbot_module_available: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  /**
   * 개발용 목 응답 (하위 호환성)
   */
  async generateMockResponse(text: string) {
    // 실제 API 호출로 대체
    const response = await this.sendMessage(text);
    
    return {
      success: true as const,
      reply: response.answer,
      status: this.mapRouteToStatus(response.route),
      sensorData: this.extractSensorData(response.answer),
      timestamp: new Date().toISOString(),
      route: response.route,
      processingTime: response.processing_time,
    };
  }

  /**
   * 타임아웃을 지원하는 fetch 래퍼
   */
  private async fetchWithTimeout(
    url: string, 
    options: RequestInit, 
    timeout: number = API_TIMEOUT
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 라우트를 상태로 매핑
   */
  private mapRouteToStatus(route: string): 'Good' | 'Normal' | 'Warning' {
    switch (route) {
      case 'sensor':
      case 'sensor_cache':
        return 'Good';
      case 'general':
      case 'sensor_detail':
        return 'Normal';
      case 'error':
        return 'Warning';
      default:
        return 'Normal';
    }
  }

  /**
   * 응답에서 센서 데이터 추출
   */
  private extractSensorData(response: string) {
    // 응답 텍스트에서 센서 데이터 패턴을 찾아 추출
    const tempMatch = response.match(/온도[:\s]*([0-9.]+)[°℃]/);
    const humMatch = response.match(/습도[:\s]*([0-9.]+)[%]/);
    const gasMatch = response.match(/CO2[:\s]*([0-9.]+)[ppm]|가스[:\s]*([0-9.]+)[ppm]/);

    if (tempMatch || humMatch || gasMatch) {
      return {
        temperature: tempMatch ? parseFloat(tempMatch[1]) : 25.5,
        humidity: humMatch ? parseFloat(humMatch[1]) : 60.0,
        gasConcentration: gasMatch ? parseFloat(gasMatch[1] || gasMatch[2]) : 675,
      };
    }

    return undefined;
  }
}

// 싱글톤 인스턴스 생성
export const ChatbotAPI = new ChatbotAPIImpl();

// 기본 내보내기 (하위 호환성)
export default ChatbotAPI;