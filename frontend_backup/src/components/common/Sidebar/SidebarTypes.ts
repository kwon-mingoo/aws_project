/**
 * ═══════════════════════════════════════════════════════════════
 * 🧩 SidebarTypes - 사이드바 관련 타입 정의 모음
 * ═══════════════════════════════════════════════════════════════
 * 
 * 사이드바 컴포넌트에서 사용되는 모든 타입들을 중앙 집중식으로 관리합니다.
 * 타입 안정성과 개발자 경험을 위해 모든 Props와 데이터 구조를 명확히 정의합니다.
 * 
 * 주요 타입:
 * - SidebarItemProps: 개별 메뉴 아이템 컴포넌트 Props
 * - MenuItem: 메뉴 아이템 데이터 구조
 * - SidebarProps: 메인 사이드바 컴포넌트 Props
 * - NotificationData: 알림 데이터 구조
 */

import React from 'react';

/**
 * 🔘 개별 사이드바 메뉴 아이템 컴포넌트의 Props
 * 각 메뉴 버튼이 받는 속성들을 정의
 */
export interface SidebarItemProps {
  icon: React.ReactNode;   // 메뉴 아이콘 (Lucide React 아이콘 등)
  label: string;           // 메뉴 라벨 텍스트
  isActive: boolean;       // 현재 활성화된 메뉴인지 여부
  onClick: () => void;     // 클릭 이벤트 핸들러
}

/**
 * 📋 메뉴 아이템 데이터 구조
 * 사이드바에 표시될 각 메뉴의 정보를 담는 객체
 */
export interface MenuItem {
  icon: React.ReactNode;   // 메뉴 아이콘 컴포넌트
  label: string;           // 메뉴 표시 텍스트
  path: string;            // 라우팅 경로 (예: '/dashboard', '/chatbot')
}

/**
 * 🎛️ 메인 사이드바 컴포넌트의 Props
 * 상위 컴포넌트에서 사이드바를 제어하기 위한 인터페이스
 */
export interface SidebarProps {
  activeMenu: string;                              // 현재 활성화된 메뉴명
  onMenuClick: (label: string, path: string) => void; // 메뉴 클릭 시 호출되는 콜백
  menuItems?: MenuItem[];                          // 커스텀 메뉴 아이템 배열 (선택적)
}

/**
 * 🔔 알림 데이터 구조
 * 사이드바나 헤더에서 표시할 알림 정보를 정의
 * 향후 실시간 알림 기능 확장 시 사용
 */
export interface NotificationData {
  count: number;           // 총 알림 개수
  notifications: Array<{   // 개별 알림 목록
    id: string;            // 고유 식별자
    message: string;       // 알림 메시지
    timestamp: string;     // 알림 발생 시간
    read: boolean;         // 읽음 여부
  }>;
}