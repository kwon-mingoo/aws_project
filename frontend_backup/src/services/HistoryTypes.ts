// HistoryTypes.ts
// ============================================
// 🎯 기본 타입 정의
// ============================================
import React from 'react';

export interface HistoryFilters {
  date: string | null;
  sensorType: string | null;
  status: string | null;
}

export interface HistoryState {
  isLoading: boolean;
  error: string | null;
  showFilters: boolean;
  showDatePicker: boolean;
  selectedDate: Date | null;
  filters: HistoryFilters;
  events: any[];
  totalPages: number;
  currentPage: number;
}

export interface HistoryEvent {
  id: string;
  timestamp: string;
  sensorType: string;
  value: number;
  status: string;
  location?: string;
}

// ============================================
// 📅 Calendar 관련 타입들
// ============================================

// ✅ 달력 DayCell 타입: date 필수
export interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
}

// ✅ 달력 Props: onCheckNow는 옵션(HistoryFilter에서 넘김)
export interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
  onCheckNow?: () => void;
}

// ✅ 히스토리 화면 상태 (없으면 최소 정의)
export interface HistoryItem {
  // 필요한 필드만 우선 정의 (사용 중인 것만)
  // id?: string;
  // timestamp?: string;
  // ...
  [key: string]: any;
}

export interface HistoryState {
  isLoading: boolean;
  error: string | null;
  showFilters: boolean;
  showDatePicker: boolean;
  selectedDate: Date | null;
  filters: HistoryFilters;
  events: any[];
  totalPages: number;
  currentPage: number;

  // ✅ 이 4줄만 추가
  items?: any[];
  page?: number;
  pageSize?: number;
  total?: number;
}

// ✅ 테이블 Props: 에러에 나온 두 필드 명시
export interface HistoryTableProps {
  historyState: HistoryState;
  changePage: (nextPage: number) => void;
}


// ============================================
// 🖥️ Screen 관련 타입들
// ============================================

export interface HistoryScreenProps {
  onNavigateBack?: () => void;
  onNavigateToChatbot: () => void;
  onNavigateToHistory: () => void;
  onNavigateToRole?: () => void;
  onNavigateToDashboard: () => void;
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
}

export interface NotificationData {
  count: number;
  notifications: any[];
}

// ✅ 이 부분이 없으면 추가
export interface HistoryFilterProps {
  historyState: HistoryState;
  activeDropdown: string | null;
  setActiveDropdown: (dropdown: string | null) => void;
  updateFilter: (key: keyof HistoryFilters, value: string | null) => void;
  resetFilters: () => void;
  handleDateSelect: (date: Date) => void;
  applyFilters: () => void;
  toggleFilters: () => void;
}

// ============================================
// 🌐 API 클래스
// ============================================

export class HistoryAPI {
  private static readonly BASE_URL = process.env.REACT_APP_API_BASE_URL;

  // 🔧 실제 API 호출 (기존 코드와 호환성 유지)
  static async fetchEvents(filters: HistoryFilters, page: number = 1): Promise<{
    events: HistoryEvent[];
    totalPages: number;
  }> {
    try {
      const targetDate = filters.date || HistoryUtils.formatDateToString(new Date());

      console.log('🔄 HistoryAPI.fetchEvents 호출:', { filters, page, targetDate });

      const formattedDate = targetDate.replace(/-/g, '');
      const apiKey =
  process.env.REACT_APP_ADMIN_API_KEY ||
  process.env.REACT_APP_API_KEY ||
  '';

const response = await fetch(`${this.BASE_URL}/s3/history/${formattedDate}`, {
  method: 'GET',
  headers: {
    'x-api-key': apiKey,        // ✅ 이것만!
  },
});

      if (response.status === 404) {
        return { events: [], totalPages: 1 };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      let events: HistoryEvent[] = [];

      if (data.files && Array.isArray(data.files)) {
        data.files.forEach((file: any, index: number) => {
          const fileData = file.data;
          if (fileData) {
            events.push({
              id: `${index}-temp`,
              timestamp: fileData.timestamp,
              sensorType: 'TEMP',
              value: fileData.mintemp,
              status: (fileData.mintemp_status || 'normal').toUpperCase()
            });

            events.push({
              id: `${index}-humi`,
              timestamp: fileData.timestamp,
              sensorType: 'HUMI',
              value: fileData.minhum,
              status: (fileData.minhum_status || 'normal').toUpperCase()
            });

            events.push({
              id: `${index}-gas`,
              timestamp: fileData.timestamp,
              sensorType: 'GAS',
              value: fileData.mingas,
              status: (fileData.mingas_status || 'normal').toUpperCase()
            });
          }
        });
      }

      // 필터 적용
// 필터 적용
if (filters.sensorType) {
  // 드롭다운 선택값을 실제 데이터 값으로 변환
  const sensorTypeMapping: Record<string, string> = {
    'Temperature': 'TEMP',
    'Humidity': 'HUMI',
    'Gas Concentration': 'GAS',
    'CO₂ Concentration': 'GAS'
  };
  
  const actualSensorType = sensorTypeMapping[filters.sensorType] || filters.sensorType;
  events = events.filter(event => event.sensorType === actualSensorType);
}

      if (filters.status) {
        events = events.filter(event => event.status.toUpperCase() === filters.status.toUpperCase());
      }

      // 정렬 (최신순)
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // ✅ 수정: 페이징 제거하고 모든 데이터 반환
      console.log('✅ HistoryAPI.fetchEvents 완료:', {
        totalEvents: events.length,
        returnedCount: events.length // 모든 데이터 반환
      });

      return {
        events: events, // 모든 이벤트 반환
        totalPages: 1   // 페이지는 1개만
      };

    } catch (error) {
      console.error('❌ HistoryAPI.fetchEvents 실패:', error);

      if (error instanceof TypeError || (error as any)?.code === 'ECONNREFUSED') {
        console.log('🔄 네트워크 오류 - 더미 데이터로 대체');
        return this.generateMockEvents(filters, page);
      }

      throw error;
    }
  }

  // 더미 데이터 생성
  private static generateMockEvents(filters: HistoryFilters, page: number): {
    events: HistoryEvent[];
    totalPages: number;
  } {
    const mockEvents: HistoryEvent[] = [];

    // 오늘부터 7일간 더미 데이터 생성
    for (let day = 0; day < 7; day++) {
      for (let hour = 9; hour <= 17; hour++) {
        for (let minute = 0; minute < 60; minute += 10) {
          const date = new Date();
          date.setDate(date.getDate() - day);
          date.setHours(hour, minute, 0, 0);

          const timestamp = date.toISOString();
          const index = day * 100 + hour * 10 + minute;

          mockEvents.push({
            id: `${index}-temp`,
            timestamp,
            sensorType: 'TEMP',
            value: 20 + Math.random() * 10,
            status: ['GOOD', 'NORMAL', 'WARNING'][Math.floor(Math.random() * 3)]
          });

          mockEvents.push({
            id: `${index}-humi`,
            timestamp,
            sensorType: 'HUMI',
            value: 50 + Math.random() * 20,
            status: ['GOOD', 'NORMAL', 'WARNING'][Math.floor(Math.random() * 3)]
          });

          mockEvents.push({
            id: `${index}-gas`,
            timestamp,
            sensorType: 'GAS',
            value: 500 + Math.random() * 1000,
            status: ['GOOD', 'NORMAL', 'WARNING'][Math.floor(Math.random() * 3)]
          });
        }
      }
    }

    // 정렬
    mockEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 페이징
    const itemsPerPage = 30;
    const totalPages = Math.ceil(mockEvents.length / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const paginatedEvents = mockEvents.slice(startIndex, startIndex + itemsPerPage);

    return {
      events: paginatedEvents,
      totalPages
    };
  }
}

// ============================================
// 🛠️ 유틸리티 클래스
// ============================================

export class HistoryUtils {
  // 날짜를 YYYY-MM-DD 형식으로 포맷
  static formatDateToString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Date 또는 string 모두 받는 formatDate 함수 추가
  static formatDate(date: Date | string): string {
    if (typeof date === 'string') {
      return date; // 이미 YYYY-MM-DD 형식이라고 가정
    }
    return this.formatDateToString(date);
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

  // 상태에 따른 CSS 클래스 반환 (누락된 함수 추가)
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
  static getSensorName(sensor: string): string {
    switch (sensor.toUpperCase()) {
      case 'TEMP':
        return 'Temperature';
      case 'HUMI':
        return 'Humidity';
      case 'GAS':
        return 'Gas Concentration';
      default:
        return sensor;
    }
  }

  // 센서 단위
  static getSensorUnit(sensor: string): string {
    switch (sensor.toUpperCase()) {
      case 'TEMP':
        return '°C';
      case 'HUMI':
        return '%';
      case 'GAS':
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

  // 상대적 시간 계산
  static getRelativeTime(timestamp: string): string {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}일 전`;

    const diffWeeks = Math.floor(diffDays / 7);
    return `${diffWeeks}주 전`;
  }
}