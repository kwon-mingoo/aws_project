// HistoryTypes.ts - 히스토리 타입 정의

export interface HistoryEvent {
  eventId: string;
  timestamp: string;
  sensorType: 'Temperature' | 'Humidity' | 'CO Concentration';
  value: number;
  status: 'GOOD' | 'NORMAL' | 'WARNING';
}

export interface HistoryRequest {
  date?: string; // YYYY-MM-DD
  sensorType?: 'Temperature' | 'Humidity' | 'CO Concentration';
  status?: 'GOOD' | 'NORMAL' | 'WARNING';
  page?: number;
}

export interface HistoryResponse {
  success: true;
  totalPages: number;
  currentPage: number;
  data: HistoryEvent[];
}

export interface HistoryError {
  success: false;
  error: string;
}

export interface HistoryFilters {
  date: string | null;
  sensorType: string | null;
  status: string | null;
}

export interface HistoryState {
  events: HistoryEvent[];
  isLoading: boolean;
  error: string | null;
  filters: HistoryFilters;
  currentPage: number;
  totalPages: number;
  showFilters: boolean;
  showDatePicker: boolean;
  selectedDate: Date | null;
}

export interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

// 원시 센서 데이터 형태
export interface RawSensorData {
  timestamp: string;
  temp: number;
  hum: number;
  gas: number;
}

export interface RawDataResponse {
  [filename: string]: RawSensorData[];
}

// 히스토리 API 클래스
export class HistoryAPI {
  private static readonly BASE_URL = '/api/s3/date';

  // 기본 히스토리 데이터 가져오기
  static async getHistoryData(params: HistoryRequest = {}): Promise<HistoryResponse | HistoryError> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.date) queryParams.append('date', params.date);
      if (params.sensorType) queryParams.append('sensorType', params.sensorType);
      if (params.status) queryParams.append('status', params.status);
      if (params.page) queryParams.append('page', params.page.toString());

      const url = params.date 
        ? `${this.BASE_URL}/${params.date.replace(/-/g, '')}?${queryParams.toString()}`
        : `${this.BASE_URL}?${queryParams.toString()}`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('히스토리 API 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '데이터를 조회할 수 없습니다.'
      };
    }
  }

  // 특정 날짜의 원시 데이터 가져오기
  static async getRawData(date: string): Promise<RawDataResponse | HistoryError> {
    try {
      const formattedDate = date.replace(/-/g, ''); // YYYYMMDD 형식으로 변환
      const response = await fetch(`${this.BASE_URL}/${formattedDate}`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('원시 데이터 API 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '원시 데이터를 조회할 수 없습니다.'
      };
    }
  }

  // 인증 토큰 가져오기
  private static getAuthToken(): string {
    return localStorage.getItem('auth_token') || 'demo_token';
  }

  // 개발용 목 데이터 생성
  static generateMockHistoryData(filters: HistoryFilters, page: number = 1): Promise<HistoryResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const baseEvents: HistoryEvent[] = [
          {
            eventId: '00001',
            timestamp: '2025-08-04T10:03:22Z',
            sensorType: 'Temperature',
            value: 25.5,
            status: 'GOOD'
          },
          {
            eventId: '00002',
            timestamp: '2025-08-04T10:03:22Z',
            sensorType: 'Humidity',
            value: 60.1,
            status: 'NORMAL'
          },
          {
            eventId: '00003',
            timestamp: '2025-08-04T10:03:22Z',
            sensorType: 'CO Concentration',
            value: 675,
            status: 'WARNING'
          },
          {
            eventId: '00004',
            timestamp: '2025-08-04T10:03:22Z',
            sensorType: 'Temperature',
            value: 25.5,
            status: 'GOOD'
          },
          {
            eventId: '00005',
            timestamp: '2025-08-04T10:03:22Z',
            sensorType: 'Humidity',
            value: 60.1,
            status: 'NORMAL'
          },
          {
            eventId: '00006',
            timestamp: '2025-08-04T10:03:22Z',
            sensorType: 'CO Concentration',
            value: 671,
            status: 'GOOD'
          }
        ];

        // 필터 적용
        let filteredEvents = baseEvents;

        if (filters.sensorType) {
          filteredEvents = filteredEvents.filter(event => 
            event.sensorType === filters.sensorType
          );
        }

        if (filters.status) {
          filteredEvents = filteredEvents.filter(event => 
            event.status === filters.status
          );
        }

        // 페이지네이션 적용 (페이지당 9개)
        const pageSize = 9;
        const totalPages = Math.ceil(filteredEvents.length / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

        resolve({
          success: true,
          totalPages,
          currentPage: page,
          data: paginatedEvents
        });
      }, 500 + Math.random() * 500); // 0.5-1초 지연
    });
  }
}

// 히스토리 유틸리티 함수들
export class HistoryUtils {
  // 날짜 포맷팅
  static formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\./g, '-').replace(/ /g, '');
  }

  // 타임스탬프 포맷팅
  static formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\./g, '-').replace(/,/g, '');
  }

  // 상태에 따른 CSS 클래스 반환
  static getStatusClass(status: string): string {
    switch (status) {
      case 'GOOD':
        return 'statusGood';
      case 'NORMAL':
        return 'statusNormal';
      case 'WARNING':
        return 'statusWarning';
      default:
        return 'statusNormal';
    }
  }

  // 센서 타입에 따른 단위 반환
  static getSensorUnit(sensorType: string): string {
    switch (sensorType) {
      case 'Temperature':
        return '°C';
      case 'Humidity':
        return '%';
      case 'CO Concentration':
        return 'ppm';
      default:
        return '';
    }
  }

  // 원시 데이터를 히스토리 이벤트로 변환
  static convertRawDataToEvents(rawData: RawDataResponse): HistoryEvent[] {
    const events: HistoryEvent[] = [];
    let eventIdCounter = 1;

    Object.entries(rawData).forEach(([filename, dataArray]) => {
      dataArray.forEach((data) => {
        // Temperature 이벤트
        events.push({
          eventId: String(eventIdCounter++).padStart(5, '0'),
          timestamp: data.timestamp,
          sensorType: 'Temperature',
          value: data.temp,
          status: this.calculateStatus('Temperature', data.temp)
        });

        // Humidity 이벤트
        events.push({
          eventId: String(eventIdCounter++).padStart(5, '0'),
          timestamp: data.timestamp,
          sensorType: 'Humidity',
          value: data.hum,
          status: this.calculateStatus('Humidity', data.hum)
        });

        // Gas 이벤트
        events.push({
          eventId: String(eventIdCounter++).padStart(5, '0'),
          timestamp: data.timestamp,
          sensorType: 'CO Concentration',
          value: data.gas,
          status: this.calculateStatus('CO Concentration', data.gas)
        });
      });
    });

    // 타임스탬프 기준 내림차순 정렬
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // 센서 값에 따른 상태 계산
  private static calculateStatus(sensorType: string, value: number): 'GOOD' | 'NORMAL' | 'WARNING' {
    switch (sensorType) {
      case 'Temperature':
        if (value < 18 || value > 28) return 'WARNING';
        if (value < 20 || value > 26) return 'NORMAL';
        return 'GOOD';
      
      case 'Humidity':
        if (value < 30 || value > 80) return 'WARNING';
        if (value < 40 || value > 70) return 'NORMAL';
        return 'GOOD';
      
      case 'CO Concentration':
        if (value > 1000) return 'WARNING';
        if (value > 700) return 'NORMAL';
        return 'GOOD';
      
      default:
        return 'NORMAL';
    }
  }

  // Date 객체를 YYYY-MM-DD 문자열로 변환
  static formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD 문자열을 Date 객체로 변환
  static parseStringToDate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
}