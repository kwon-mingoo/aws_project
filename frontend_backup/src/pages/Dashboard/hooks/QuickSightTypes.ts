// services/QuickSightTypes.ts - QuickSight 관련 타입 정의

/**
 * 📊 QuickSight 대시보드 응답 타입
 */
export interface QuickSightDashboardResponse {
  dashboard: {
    dashboardId: string;
    name: string;
    description?: string;
    arn: string;
    createdTime: string;
    version: {
      versionNumber: number;
      status: string;
    };
  };
  dashboardId: string;
  type: string;
  requestId: string;
  embedUrl?: string;
  embedExpirationTime?: string;
}

/**
 * 📈 QuickSight 센서 타입
 */
export type QuickSightSensorType = 'TEMPERATURE' | 'HUMIDITY' | 'CO_CONCENTRATION';

/**
 * 🎯 QuickSight 서비스 클래스
 */
export class QuickSightService {
  private static readonly API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

  /**
   * 🌐 센서 타입별 대시보드 조회 (임베드 URL 포함)
   */
  static async getDashboardByType(sensorType: QuickSightSensorType): Promise<QuickSightDashboardResponse> {
    try {
      console.log(`🔄 QuickSight 대시보드 조회 시작: ${sensorType}`);

      const response = await fetch(
  `${this.API_BASE_URL}/quicksight/dashboards/${sensorType}?includeEmbedUrl=true`,
  {
    method: 'GET',
    headers: {
  'x-api-key': process.env.REACT_APP_ADMIN_API_KEY as string, // ✅ Mintrend와 동일
},
  }
);


      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: QuickSightDashboardResponse = await response.json();

      // ✅ 반드시 /embed/가 포함된 임베드 URL만 통과
      if (!data.embedUrl || !/\/embed\//.test(data.embedUrl)) {
        throw new Error(
          '임베드 URL이 아닙니다. 백엔드에서 GenerateEmbedUrl로 /embed/ 경로의 URL을 반환하도록 수정해 주세요.'
        );
      }

      console.log(`✅ QuickSight 대시보드 조회 성공:`, data);
      return data;

    } catch (error) {
      console.error(`❌ QuickSight 대시보드 조회 실패 (${sensorType}):`, error);
      throw new Error(
        error instanceof Error
          ? `QuickSight 대시보드 로드 실패: ${error.message}`
          : 'QuickSight 대시보드를 가져오는 중 알 수 없는 오류가 발생했습니다.'
      );
    }
  }

  /**
   * 📊 QuickSight 설정 정보 조회
   */
  static async getConfig() {
    try {
      const response = await fetch(`${this.API_BASE_URL}/quicksight/config`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ QuickSight 설정 정보 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 🎨 센서 타입별 색상 반환
   */
  static getSensorTypeColor(type: QuickSightSensorType): string {
    switch (type) {
      case 'TEMPERATURE':
        return '#ef4444';
      case 'HUMIDITY':
        return '#3b82f6';
      case 'CO_CONCENTRATION':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  }

  /**
   * 📋 센서 타입별 표시명 반환
   */
  static getSensorTypeLabel(type: QuickSightSensorType): string {
    switch (type) {
      case 'TEMPERATURE':
        return '🌡️ 온도 모니터링';
      case 'HUMIDITY':
        return '💧 습도 모니터링';
      case 'CO_CONCENTRATION':
        return '💨 가스 농도 모니터링';
      default:
        return '📊 센서 모니터링';
    }
  }
}

/**
 * 📊 QuickSight 센서 옵션
 */
export const QUICKSIGHT_SENSOR_OPTIONS = [
  { value: 'TEMPERATURE', label: '🌡️ Temperature' },
  { value: 'HUMIDITY', label: '💧 Humidity' },
  { value: 'CO_CONCENTRATION', label: '💨 Gas Concentration' },
] as const;