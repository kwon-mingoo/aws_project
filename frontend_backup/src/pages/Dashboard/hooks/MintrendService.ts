// services/MintrendTypes.ts - Mintrend API 관련 타입 정의
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

export interface MintrendApiResponse {
  success: boolean;
  data?: MintrendResponse;
  error?: string;
}

export class MintrendService {
  private static readonly API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  private static readonly MINTREND_ENDPOINT = '/s3/file/last/mintrend';

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
    'x-api-key': apiKey,   // ✅ 이것만!
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


// // 수정할 코드
// const apiKey = process.env.REACT_APP_ADMIN_API_KEY;

// if (!apiKey) {
//   console.error('❌ REACT_APP_ADMIN_API_KEY 환경변수가 설정되지 않았습니다!');
//   throw new Error('API 키가 설정되지 않았습니다. .env 파일을 확인하세요.');
// }

  // 다른 메서드들은 그대로 유지...
  static getTemperatureStatus(temperature: number): string {
    if (temperature < 15) return 'COLD';
    if (temperature < 20) return 'COOL';
    if (temperature < 28) return 'GOOD';
    if (temperature < 35) return 'WARM';
    return 'HOT';
  }

  static getHumidityStatus(humidity: number): string {
    if (humidity < 30) return 'DRY';
    if (humidity < 40) return 'LOW';
    if (humidity < 70) return 'GOOD';
    if (humidity < 80) return 'HIGH';
    return 'WET';
  }

  static getGasStatus(gas: number): string {
    if (gas < 400) return 'EXCELLENT';
    if (gas < 800) return 'GOOD';
    if (gas < 1500) return 'MODERATE';
    if (gas < 3000) return 'POOR';
    return 'DANGEROUS';
  }

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