// MinTrendHistoryTypes.ts - 새로운 MinTrend 히스토리 타입 정의

export interface MinTrendData {
  timestamp: string;
  mintemp: number;
  minhum: number;
  mingas: number;
  mintemp_status: 'good' | 'normal' | 'warning';
  minhum_status: 'good' | 'normal' | 'warning';
  mingas_status: 'good' | 'normal' | 'warning';
}

export interface MinTrendFileData {
  filename: string;
  data: MinTrendData;
}

export interface MinTrendHistoryResponse {
  date: string;
  totalFiles: number;
  files: MinTrendFileData[];
}

export interface MinTrendHistoryError {
  message: string;
  error: string;
  statusCode: number;
}

export interface MinTrendFilters {
  date: string | null; // YYYY-MM-DD 형식
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export interface MinTrendHistoryState {
  data: MinTrendFileData[];
  isLoading: boolean;
  error: string | null;
  filters: MinTrendFilters;
  showFilters: boolean;
  showDatePicker: boolean;
  selectedDate: Date | null;
  hasMore: boolean;
  page: number;
}

// API 클래스
export class MinTrendHistoryAPI {
  private static readonly BASE_URL = process.env.REACT_APP_API_BASE_URL;

  static async getHistoryByDate(date: string): Promise<MinTrendHistoryResponse> {
    try {
      // YYYY-MM-DD를 YYYYMMDD로 변환
      const formattedDate = date.replace(/-/g, '');

      const apiKey =
  process.env.REACT_APP_ADMIN_API_KEY ||
  process.env.REACT_APP_API_KEY ||
  '';

const response = await fetch(`${this.BASE_URL}/s3/history/${formattedDate}`, {
  method: 'GET',
  headers: {
    'x-api-key': apiKey,      // ✅ 이것만!
  }
});


      if (!response.ok) {
        const errorData: MinTrendHistoryError = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('MinTrend History API Error:', error);
      throw error;
    }
  }

  // 개발용 목 데이터 생성
  static async generateMockData(date: string): Promise<MinTrendHistoryResponse> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockFiles: MinTrendFileData[] = [];
        const baseDate = new Date(date);

        // 9시부터 17시까지 1분마다 데이터 생성
        for (let hour = 9; hour <= 17; hour++) {
          for (let minute = 0; minute < 60; minute += 1) {
            const timestamp = new Date(baseDate);
            timestamp.setHours(hour, minute, 0, 0);

            const timestampStr = timestamp.toISOString().slice(0, 16) + ':00';
            const filenameTimestamp = timestamp.toISOString().slice(0, 16).replace(/[-T:]/g, '').slice(0, 12);

            mockFiles.push({
              filename: `${filenameTimestamp}_mintrend.json`,
              data: {
                timestamp: timestampStr,
                mintemp: Math.round((20 + Math.random() * 10) * 100) / 100,
                minhum: Math.round((50 + Math.random() * 20) * 100) / 100,
                mingas: Math.round((500 + Math.random() * 1000) * 100) / 100,
                mintemp_status: this.getRandomStatus(),
                minhum_status: this.getRandomStatus(),
                mingas_status: this.getRandomStatus(),
              }
            });
          }
        }

        // 최신순으로 정렬 (내림차순)
        mockFiles.sort((a, b) =>
          new Date(b.data.timestamp).getTime() - new Date(a.data.timestamp).getTime()
        );

        resolve({
          date: date.replace(/-/g, ''),
          totalFiles: mockFiles.length,
          files: mockFiles
        });
      }, 300 + Math.random() * 200);
    });
  }

  private static getRandomStatus(): 'good' | 'normal' | 'warning' {
    const rand = Math.random();
    if (rand < 0.7) return 'good';
    if (rand < 0.9) return 'normal';
    return 'warning';
  }
}

// 유틸리티 클래스
export class MinTrendHistoryUtils {
  // 날짜를 YYYY-MM-DD 형식으로 포맷
  static formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 타임스탬프를 로컬 시간으로 포맷
  static formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  // 시간만 포맷 (HH:MM)
  static formatTimeOnly(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  // 상태에 따른 CSS 클래스 반환
  static getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'good':
        return 'statusGood';
      case 'normal':
        return 'statusNormal';
      case 'warning':
        return 'statusWarning';
      default:
        return 'statusNormal';
    }
  }

  // 상태 표시 텍스트
  static getStatusText(status: string): string {
    switch (status.toLowerCase()) {
      case 'good':
        return 'GOOD';
      case 'normal':
        return 'NORMAL';
      case 'warning':
        return 'WARNING';
      default:
        return 'NORMAL';
    }
  }

  // 센서 이름
  static getSensorName(sensor: 'mintemp' | 'minhum' | 'mingas'): string {
    switch (sensor) {
      case 'mintemp':
        return 'Temperature';
      case 'minhum':
        return 'Humidity';
      case 'mingas':
        return 'CO Concentration';
      default:
        return '';
    }
  }

  // 센서 단위
  static getSensorUnit(sensor: 'mintemp' | 'minhum' | 'mingas'): string {
    switch (sensor) {
      case 'mintemp':
        return '°C';
      case 'minhum':
        return '%';
      case 'mingas':
        return 'ppm';
      default:
        return '';
    }
  }

  // 오늘 날짜 가져오기
  static getTodayString(): string {
    return this.formatDateToString(new Date());
  }

  // 날짜 유효성 검증
  static isValidDate(year: number, month: number, day: number): boolean {
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
  }

  // 월의 마지막 날짜 가져오기
  static getLastDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  // 년도 배열 생성 (현재 년도 기준 ±5년)
  static getYearOptions(): number[] {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      years.push(i);
    }
    return years;
  }

  // 월 배열 생성
  static getMonthOptions(): Array<{ value: number, label: string }> {
    return [
      { value: 1, label: '1월' },
      { value: 2, label: '2월' },
      { value: 3, label: '3월' },
      { value: 4, label: '4월' },
      { value: 5, label: '5월' },
      { value: 6, label: '6월' },
      { value: 7, label: '7월' },
      { value: 8, label: '8월' },
      { value: 9, label: '9월' },
      { value: 10, label: '10월' },
      { value: 11, label: '11월' },
      { value: 12, label: '12월' },
    ];
  }

  // 일 배열 생성
  static getDayOptions(year: number, month: number): number[] {
    const lastDay = this.getLastDayOfMonth(year, month);
    const days: number[] = [];
    for (let i = 1; i <= lastDay; i++) {
      days.push(i);
    }
    return days;
  }
}