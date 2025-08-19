// services/MintrendTypes.ts - 타입과 서비스 통합
/**
 * 📡 Mintrend API 응답 타입
 */
export interface MintrendResponse {
  filename: string;
  data: {
    timestamp: string;
    mintemp: number;
    minhum: number;
    mingas: number;
    mintemp_status?: string;
    minhum_status?: string;
    mingas_status?: string;
  };
}

/**
 * 📄 API 응답 상태 타입
 */
export interface MintrendApiResponse {
  success: boolean;
  data?: MintrendResponse;
  error?: string;
}

/**
 * 📊 Mintrend 서비스 클래스
 */
export class MintrendService {
  private static readonly API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  private static readonly MINTREND_ENDPOINT = '/s3/file/last/mintrend';

  /**
   * 🌐 최신 Mintrend 데이터 가져오기
   */
  static async getLatestMintrendData(): Promise<MintrendResponse> {
    const fullUrl = `${this.API_BASE_URL}${this.MINTREND_ENDPOINT}`;
    
    try {
      console.log('🔄 Mintrend API 호출:', fullUrl);
      
      // API 키 가져오기
      const apiKey = process.env.REACT_APP_ADMIN_API_KEY;

      if (!apiKey) {
        console.error('❌ REACT_APP_ADMIN_API_KEY 환경변수가 설정되지 않았습니다!');
        throw new Error('API 키가 설정되지 않았습니다. .env 파일을 확인하세요.');
      }

      console.log('🔑 환경변수에서 API 키 로드 성공:', apiKey.substring(0, 8) + '...');
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
  'Content-Type': 'application/json',
  'x-api-key': apiKey,            // 하나만!
  // Authorization이 진짜 필요한 API라면 CORS 허용헤더에 추가하고 아래 주석 해제
  // 'Authorization': `Bearer ${apiKey}`,
},
      });

      console.log(`📡 응답 상태: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: MintrendResponse = await response.json();
      console.log('✅ Mintrend 데이터 수신 성공:', data);
      
      return data;
      
    } catch (error) {
      console.error('❌ Mintrend API 호출 실패:', error);
      throw error;
    }
  }

  /**
   * 🌡️ 온도 상태 판정
   */
  static getTemperatureStatus(temperature: number): string {
    if (temperature < 15) return 'COLD';
    if (temperature < 20) return 'COOL';
    if (temperature < 28) return 'GOOD';
    if (temperature < 35) return 'WARM';
    return 'HOT';
  }

  /**
   * 💧 습도 상태 판정
   */
  static getHumidityStatus(humidity: number): string {
    if (humidity < 30) return 'DRY';
    if (humidity < 40) return 'LOW';
    if (humidity < 70) return 'GOOD';
    if (humidity < 80) return 'HIGH';
    return 'WET';
  }

  /**
   * 💨 가스 상태 판정
   */
  static getGasStatus(gas: number): string {
    if (gas < 400) return 'EXCELLENT';
    if (gas < 800) return 'GOOD';
    if (gas < 1500) return 'MODERATE';
    if (gas < 3000) return 'POOR';
    return 'DANGEROUS';
  }

  /**
   * 📊 상태별 색상 클래스 반환
   */
  static getStatusColorClass(status: string): string {
    switch (status.toUpperCase()) {
      case 'EXCELLENT':
      case 'GOOD':
        return 'status-good';
      case 'MODERATE':
      case 'COOL':
      case 'WARM':
        return 'status-moderate';
      case 'POOR':
      case 'HIGH':
      case 'LOW':
        return 'status-poor';
      case 'DANGEROUS':
      case 'HOT':
      case 'COLD':
        return 'status-danger';
      default:
        return 'status-default';
    }
  }

  /**
   * 🔄 데이터 유효성 검증
   */
  static validateMintrendData(data: any): data is MintrendResponse {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.filename === 'string' &&
      data.data &&
      typeof data.data === 'object' &&
      typeof data.data.timestamp === 'string' &&
      typeof data.data.mintemp === 'number' &&
      typeof data.data.minhum === 'number' &&
      typeof data.data.mingas === 'number'
    );
  }
}