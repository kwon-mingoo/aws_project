/**
 * ═══════════════════════════════════════════════════════════════
 * 📊 DashboardTypes - 대시보드 관련 타입 정의 및 API 서비스
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { 
  BarChart3, 
  MessageSquare, 
  History, 
  LogOut 
} from 'lucide-react';

// ============================================
// 🎯 기본 타입 정의
// ============================================

export type SensorType = 'temperature' | 'humidity' | 'gas';

export type SensorStatus = 'GOOD' | 'WARNING' | 'DANGER';

// ============================================
// 📊 센서 데이터 인터페이스
// ============================================

export interface SensorData {
  success: boolean;
  sensorType: SensorType;
  current: {
    value: number;
    status: SensorStatus;
  };
  prediction: {
    value: number;
  };
  unit: string;
  labels: string[];
  values: number[];
  timestamp: string;
}

// ============================================
// 🔔 알림 데이터 인터페이스
// ============================================

export interface NotificationItem {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface NotificationData {
  count: number;
  notifications: NotificationItem[];
}

// ============================================
// 🧭 사이드바 인터페이스
// ============================================

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

// ============================================
// 📋 설정 및 옵션
// ============================================

export const SENSOR_OPTIONS = [
  { value: 'temperature', label: '온도 (Temperature)' },
  { value: 'humidity', label: '습도 (Humidity)' },
  { value: 'gas', label: '가스 농도 (Gas)' },
];

export const MENU_ITEMS: MenuItem[] = [
  {
    icon: React.createElement(BarChart3, { size: 20 }),
    label: 'Dashboard',
    path: '/dashboard',
  },
  {
    icon: React.createElement(MessageSquare, { size: 20 }),
    label: 'Chatbot',
    path: '/chatbot',
  },
  {
    icon: React.createElement(History, { size: 20 }),
    label: 'History',
    path: '/history',
  },
  {
    icon: React.createElement(LogOut, { size: 20 }),
    label: 'Logout',
    path: '/logout',
  },
];

// ============================================
// 🛠️ 유틸리티 클래스
// ============================================

export class DashboardUtils {
  /**
   * 현재 날짜와 시간을 포맷팅하여 반환
   */
  static getCurrentDateTime(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  /**
   * 센서 타입에 따른 차트 색상 반환
   */
  static getChartColor(sensorType: SensorType): string {
    const colors = {
      temperature: '#ef4444', // 빨간색
      humidity: '#3b82f6',    // 파란색
      gas: '#f59e0b',         // 주황색
    };
    return colors[sensorType];
  }

  /**
   * 센서 상태에 따른 CSS 클래스 반환
   */
  static getStatusClass(status: SensorStatus): string {
    const statusClasses = {
      GOOD: 'status-good',
      WARNING: 'status-warning', 
      DANGER: 'status-danger',
    };
    return statusClasses[status];
  }

  /**
   * 숫자를 천 단위 콤마로 포맷팅
   */
  static formatNumber(value: number): string {
    return value.toLocaleString();
  }

  /**
   * 상대적 시간 계산 (예: "5분 전")
   */
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
    return `${diffDays}일 전`;
  }
}

// ============================================
// 🌐 API 서비스 클래스
// ============================================

export class DashboardAPI {
  private static readonly BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

  /**
   * 센서 데이터 가져오기
   */
  static async getSensorData(sensorType: SensorType): Promise<SensorData> {
    try {
      const response = await fetch(`${this.BASE_URL}/sensors/${sensorType}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`센서 데이터 가져오기 실패 (${sensorType}):`, error);
      
      // 🔧 개발용 더미 데이터 반환
      return this.generateMockSensorData(sensorType);
    }
  }

  /**
   * 알림 데이터 가져오기
   */
  static async getNotifications(): Promise<NotificationData> {
    try {
      const response = await fetch(`${this.BASE_URL}/notifications`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('알림 데이터 가져오기 실패:', error);
      
      // 🔧 개발용 더미 데이터 반환
      return {
        count: 0,
        notifications: [],
      };
    }
  }

  /**
   * 🔧 개발용 더미 센서 데이터 생성
   */
  private static generateMockSensorData(sensorType: SensorType): SensorData {
    const now = new Date();
    const labels: string[] = [];
    const values: number[] = [];

    // 지난 10시간 데이터 생성
    for (let i = 10; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const timeLabel = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
      labels.push(timeLabel);
    }

    // 센서 타입별 더미 데이터
    const mockData = {
      temperature: {
        baseValue: 25,
        variation: 2,
        unit: '°C',
        currentValue: 25.1 + (Math.random() - 0.5) * 2,
        predictionValue: 25.3 + (Math.random() - 0.5) * 1,
      },
      humidity: {
        baseValue: 67,
        variation: 5,
        unit: '%',
        currentValue: 66.75 + (Math.random() - 0.5) * 5,
        predictionValue: 67.2 + (Math.random() - 0.5) * 2,
      },
      gas: {
        baseValue: 740,
        variation: 40,
        unit: 'ppm',
        currentValue: 742.67 + (Math.random() - 0.5) * 50,
        predictionValue: 745 + (Math.random() - 0.5) * 30,
      },
    };

    const config = mockData[sensorType];
    
    // 히스토리 값들 생성
    for (let i = 0; i < labels.length; i++) {
      values.push(config.baseValue + (Math.random() - 0.5) * config.variation);
    }

    return {
      success: true,
      sensorType,
      current: {
        value: config.currentValue,
        status: this.getSensorStatus(sensorType, config.currentValue),
      },
      prediction: {
        value: config.predictionValue,
      },
      unit: config.unit,
      labels,
      values,
      timestamp: now.toISOString(),
    };
  }

  /**
   * 🔧 개발용 센서 상태 결정
   */
  private static getSensorStatus(sensorType: SensorType, value: number): SensorStatus {
    const thresholds = {
      temperature: { warning: 30, danger: 35 },
      humidity: { warning: 80, danger: 90 },
      gas: { warning: 800, danger: 1000 },
    };

    const threshold = thresholds[sensorType];
    if (value >= threshold.danger) return 'DANGER';
    if (value >= threshold.warning) return 'WARNING';
    return 'GOOD';
  }
}