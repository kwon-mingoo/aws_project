// Mintrend API 관련 타입 정의 및 서비스

export interface MintrendData {
  timestamp: string;
  mintemp: number;
  minhum: number;
  mingas: number;
}

export interface MintrendResponse {
  filename: string;
  data: MintrendData;
}

export interface MintrendError {
  message: string;
  code?: number;
}

/**
 * Mintrend API 서비스
 * S3에서 최신 mintrend 데이터를 조회하는 기능 제공
 */
export class MintrendService {
  private static readonly API_ENDPOINT = '/s3/file/last/mintrend';

  /**
   * 최신 mintrend 데이터 조회
   * @returns Promise<MintrendResponse> 최신 mintrend 데이터
   * @throws Error API 호출 실패 시
   */
  static async getLatestMintrendData(): Promise<MintrendResponse> {
    try {
      console.log('🔄 최신 mintrend 데이터 요청 중...');
      
      const response = await fetch(this.API_ENDPOINT, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `API 호출 실패: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const data = await response.json();
      
      console.log('✅ Mintrend 데이터 조회 성공:', data);
      
      // 데이터 유효성 검증
      if (!data.filename || !data.data) {
        throw new Error('Invalid API response format');
      }

      return data as MintrendResponse;
    } catch (error) {
      console.error('❌ Mintrend 데이터 조회 실패:', error);
      
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Unknown error occurred while fetching mintrend data');
    }
  }

  /**
   * mintrend 데이터를 포맷팅하여 표시용 문자열로 변환
   * @param data MintrendData 객체
   * @returns 포맷팅된 문자열
   */
  static formatMintrendData(data: MintrendData): string {
    const timestamp = new Date(data.timestamp).toLocaleString('ko-KR');
    return `
시간: ${timestamp}
최소 온도: ${data.mintemp}°C
최소 습도: ${data.minhum}%
최소 가스: ${data.mingas}
    `.trim();
  }

  /**
   * 온도 값에 따른 상태 반환
   * @param temp 온도 값
   * @returns 온도 상태 문자열
   */
  static getTemperatureStatus(temp: number): string {
    if (temp < 18) return '낮음';
    if (temp < 25) return '적정';
    if (temp < 30) return '높음';
    return '매우 높음';
  }

  /**
   * 습도 값에 따른 상태 반환
   * @param humidity 습도 값
   * @returns 습도 상태 문자열
   */
  static getHumidityStatus(humidity: number): string {
    if (humidity < 40) return '건조';
    if (humidity < 60) return '적정';
    if (humidity < 80) return '높음';
    return '매우 높음';
  }
}