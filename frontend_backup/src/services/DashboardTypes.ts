// Dashboard.ts - 타입 정의 및 API 로직
import React from 'react';
import { Bell, User, LayoutDashboard, MessageCircle, History, Settings, LogOut } from 'lucide-react';

// 기본 타입 정의
export interface NotificationData {
  count: number;
  notifications: Array<{
    id: string;
    message: string;
    timestamp: string;
    read: boolean;
  }>;
}

export interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

// 센서 데이터 타입 정의
export interface SensorData {
  success: boolean;
  sensorType: 'temperature' | 'humidity' | 'gas';
  unit: string;
  labels: string[];
  values: number[];
  current: {
    value: number;
    status: 'GOOD' | 'WARNING' | 'DANGER';
  };
  prediction: {
    value: number;
  };
  timestamp: string;
}

export interface SensorDataError {
  success: false;
  error: string;
}

export type SensorType = 'temperature' | 'humidity' | 'gas';

export interface SensorOption {
  value: SensorType;
  label: string;
  displayName: string;
}

// API 관련 클래스
export class DashboardAPI {
  private static baseURL = '/api/dashboard';

  // 센서 데이터 가져오기
  static async getSensorData(
    sensorType: SensorType, 
    rangeHour: number = 10
  ): Promise<SensorData | SensorDataError> {
    try {
      const response = await fetch(
        `${this.baseURL}/sensor-data?sensorType=${sensorType}&rangeHour=${rangeHour}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('센서 데이터 API 호출 실패, 더미 데이터 반환:', error);
      // API 실패 시 더미 데이터 반환
      return DashboardUtils.generateMockSensorData(sensorType);
    }
  }

  // 알림 데이터 가져오기
  static async getNotifications(): Promise<NotificationData> {
    try {
      // 실제 API 호출로 교체
      // const response = await fetch(`${this.baseURL}/notifications`);
      // return await response.json();

      // 더미 데이터
      return {
        count: 3,
        notifications: [
          {
            id: '1',
            message: '온도 센서에서 임계값을 초과했습니다.',
            timestamp: '2025-08-07 19:30',
            read: false
          },
          {
            id: '2',
            message: '습도 센서 데이터가 업데이트되었습니다.',
            timestamp: '2025-08-07 19:25',
            read: false
          },
          {
            id: '3',
            message: '시스템 점검이 완료되었습니다.',
            timestamp: '2025-08-07 19:20',
            read: true
          }
        ]
      };
    } catch (error) {
      console.error('알림 데이터 가져오기 실패:', error);
      return { count: 0, notifications: [] };
    }
  }
}

// 유틸리티 함수들
export class DashboardUtils {
  // 현재 시간 포맷팅
  static getCurrentDateTime(): string {
    const now = new Date();
    return `${now.getFullYear()}년 ${String(now.getMonth() + 1).padStart(2, '0')}월 ${String(now.getDate()).padStart(2, '0')}일 ${String(now.getHours()).padStart(2, '0')}시 ${String(now.getMinutes()).padStart(2, '0')}분`;
  }

  // 센서 상태에 따른 스타일 클래스 반환
  static getStatusClass(status: string): string {
    switch (status) {
      case 'GOOD':
        return 'statusGood';
      case 'WARNING':
        return 'statusWarning';
      case 'DANGER':
        return 'statusDanger';
      default:
        return 'statusGood';
    }
  }

  // 센서 타입에 따른 그래프 색상 반환
  static getChartColor(sensorType: SensorType): string {
    switch (sensorType) {
      case 'temperature':
        return '#ef4444'; // 빨간색
      case 'humidity':
        return '#3b82f6'; // 파란색
      case 'gas':
        return '#8b5cf6'; // 보라색
      default:
        return '#6b7280';
    }
  }

  // 더미 센서 데이터 생성 (개발용)
  static generateMockSensorData(sensorType: SensorType): SensorData {
    const labels = ['-10H', '-9H', '-8H', '-7H', '-6H', '-5H', '-4H', '-3H', '-2H', '-1H', 'NOW'];
    let values: number[];
    let unit: string;
    let currentValue: number;
    let predictionValue: number;

    switch (sensorType) {
      case 'temperature':
        values = [20.2, 21.5, 22.1, 21.8, 22.4, 23.1, 22.9, 23.5, 24.2, 24.8, 25.5];
        unit = '°C';
        currentValue = 25.5;
        predictionValue = 25.6;
        break;
      case 'humidity':
        values = [58.3, 59.1, 60.2, 59.8, 60.5, 61.2, 60.8, 61.5, 60.9, 60.3, 60.1];
        unit = '%';
        currentValue = 60.1;
        predictionValue = 60.0;
        break;
      case 'gas':
        values = [670, 672, 675, 673, 678, 680, 677, 682, 679, 676, 675];
        unit = 'ppm';
        currentValue = 675;
        predictionValue = 670;
        break;
      default:
        values = [];
        unit = '';
        currentValue = 0;
        predictionValue = 0;
    }

    return {
      success: true,
      sensorType,
      unit,
      labels,
      values,
      current: {
        value: currentValue,
        status: 'GOOD'
      },
      prediction: {
        value: predictionValue
      },
      timestamp: new Date().toISOString()
    };
  }
}

// 센서 옵션 상수
export const SENSOR_OPTIONS: SensorOption[] = [
  { value: 'temperature', label: 'TEMPERATURE', displayName: '온도' },
  { value: 'humidity', label: 'HUMIDITY', displayName: '습도' },
  { value: 'gas', label: 'GAS CONCENTRATION', displayName: '가스 농도' }
];

// 메뉴 아이템 상수
export const MENU_ITEMS: MenuItem[] = [
  { icon: React.createElement(LayoutDashboard, { size: 20 }), label: 'Dashboard', path: '/dashboard' },
  { icon: React.createElement(MessageCircle, { size: 20 }), label: 'Chatbot', path: '/chatbot' },
  { icon: React.createElement(History, { size: 20 }), label: 'History', path: '/history' },
  { icon: React.createElement(Settings, { size: 20 }), label: 'Settings', path: '/settings' },
  { icon: React.createElement(LogOut, { size: 20 }), label: 'Logout', path: '/logout' }
];