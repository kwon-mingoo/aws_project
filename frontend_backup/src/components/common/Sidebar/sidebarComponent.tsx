/**
 * ═══════════════════════════════════════════════════════════════
 * 🎨 SidebarComponent - 고급 사이드바 컴포넌트 (Tailwind 버전)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 더 풍부한 UI/UX를 제공하는 향상된 사이드바 컴포넌트입니다.
 * Tailwind CSS를 사용하여 모던한 디자인과 다양한 상태를 지원합니다.
 * 
 * 주요 특징:
 * - 그라데이션 브랜딩 및 모던 디자인
 * - 비활성화된 메뉴 항목 지원 ("Soon" 라벨)
 * - 뱃지/알림 카운터 지원
 * - 메인 메뉴와 하단 메뉴 구분
 * - 사용자 정보 표시 영역
 * - 호버 효과 및 부드러운 전환 애니메이션
 * 
 * 기본 메뉴 구성:
 * - 메인: Dashboard, Chatbot, History, Analytics(비활성), Users(비활성)
 * - 하단: Settings, Help, Logout
 * - 사용자: 아바타 및 이메일 정보
 */

import React from 'react';
// Lucide React 아이콘들 - 명확한 이름으로 임포트
import {
  Home,                    // 대시보드 아이콘
  MessageCircle,           // 챗봇 아이콘
  History as HistoryIcon,  // 히스토리 아이콘 (History는 브라우저 History와 충돌 방지)
  BarChart3,               // 분석 아이콘
  Users as UsersIcon,      // 사용자 관리 아이콘
  Settings as SettingsIcon, // 설정 아이콘
  HelpCircle as HelpCircleIcon, // 도움말 아이콘
  LogOut as LogOutIcon,    // 로그아웃 아이콘
} from 'lucide-react';

/**
 * 📋 메뉴 아이템 타입 정의
 * 각 메뉴 항목이 가질 수 있는 속성들을 정의
 */
type MenuItem = {
  id: string;              // 고유 식별자
  label: string;           // 표시 텍스트
  icon: React.ReactNode;   // 아이콘 컴포넌트
  path?: string;           // 라우팅 경로 (선택적)
  disabled?: boolean;      // 비활성화 여부 (향후 구현 예정 기능)
  badge?: number;          // 뱃지 카운터 (알림 등)
};

/**
 * 📱 메인 메뉴 아이템 구성
 * 애플리케이션의 주요 기능들에 대한 메뉴
 * 일부 메뉴는 향후 구현 예정으로 비활성화 상태
 */
const menuItems: MenuItem[] = [
  { 
    id: 'dashboard', 
    label: 'Dashboard', 
    icon: <Home size={20} />, 
    path: '/dashboard' 
  },
  { 
    id: 'chatbot', 
    label: 'Chatbot', 
    icon: <MessageCircle size={20} />, 
    path: '/chatbot' 
  },
  { 
    id: 'history', 
    label: 'History', 
    icon: <HistoryIcon size={20} />, 
    path: '/history' 
  },
  { 
    id: 'analytics', 
    label: 'Analytics', 
    icon: <BarChart3 size={20} />, 
    path: '/analytics', 
    disabled: true  // 향후 구현 예정
  },
  { 
    id: 'users', 
    label: 'Users', 
    icon: <UsersIcon size={20} />, 
    path: '/users', 
    disabled: true  // 향후 구현 예정
  },
];

/**
 * ⚙️ 하단 메뉴 아이템 구성
 * 설정, 도움말, 로그아웃 등 보조 기능들
 */
const bottomMenuItems: MenuItem[] = [
  { 
    id: 'settings', 
    label: 'Settings', 
    icon: <SettingsIcon size={20} />, 
    path: '/settings' 
  },
  { 
    id: 'help', 
    label: 'Help', 
    icon: <HelpCircleIcon size={20} />, 
    path: '/help' 
  },
  { 
    id: 'logout', 
    label: 'Logout', 
    icon: <LogOutIcon size={20} />, 
    path: '/logout' 
  },
];

/**
 * 🔧 사이드바 컴포넌트 Props 인터페이스
 */
export interface SidebarProps {
  activeMenu?: string;                 // 현재 활성화된 메뉴 ID
  onMenuClick?: (id: string) => void;  // 메뉴 클릭 시 호출되는 콜백
  className?: string;                  // 추가 CSS 클래스
}

/**
 * 🎨 메인 사이드바 컴포넌트 함수
 * 
 * Tailwind CSS를 사용한 모던하고 풍부한 사이드바 UI를 제공합니다.
 * 메뉴 상태 관리, 클릭 이벤트 처리, 다양한 UI 상태를 지원합니다.
 * 
 * @param activeMenu - 현재 활성화된 메뉴 ID
 * @param onMenuClick - 메뉴 클릭 시 호출되는 콜백 함수
 * @param className - 추가 CSS 클래스
 */
export default function Sidebar({
  activeMenu = '',
  onMenuClick,
  className = '',
}: SidebarProps) {
  
  /**
   * 🔘 메뉴 아이템 클릭 핸들러
   * 비활성화된 메뉴는 클릭을 무시하고, 활성화된 메뉴만 이벤트를 전달
   * 
   * @param item - 클릭된 메뉴 아이템 정보
   */
  const handleItemClick = (item: MenuItem) => {
    if (item.disabled) return; // 비활성화된 메뉴는 클릭 무시
    onMenuClick?.(item.id);    // 상위 컴포넌트로 메뉴 ID 전달
    // 라우팅을 쓰는 구조라면 여기서 navigate(item.path!) 호출 또는 NavLink 사용
  };

  /**
   * 🎯 개별 메뉴 아이템 렌더링 함수
   * 메뉴의 상태(활성/비활성/비활성화)에 따라 다른 스타일을 적용
   * 뱃지, 아이콘, 라벨 등을 동적으로 렌더링
   * 
   * @param item - 렌더링할 메뉴 아이템 정보
   * @returns 렌더링된 메뉴 버튼 JSX
   */
  const renderMenuItem = (item: MenuItem) => {
    const isActive = activeMenu === item.id;    // 현재 활성 메뉴인지 확인
    const isDisabled = !!item.disabled;         // 비활성화 상태 확인

    return (
      <button
        key={item.id}
        onClick={() => handleItemClick(item)}
        disabled={isDisabled}
        className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors ${
          isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-current={isActive ? 'page' : undefined} // 접근성: 현재 페이지 표시
      >
        {/* 🎨 아이콘 영역 - 활성 상태에 따른 색상 변경 */}
        <span className={`transition-colors duration-200 ${isActive ? 'text-white' : ''}`}>
          {item.icon}
        </span>

        {/* 📝 라벨 텍스트 */}
        <span className="font-medium text-sm">{item.label}</span>

        {/* 🔔 뱃지 카운터 - 알림이나 개수 표시 (99+ 제한) */}
        {item.badge && item.badge > 0 && (
          <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}

        {/* ⏳ 비활성화 상태 표시 - "Soon" 라벨 */}
        {isDisabled && <span className="ml-auto text-xs text-gray-500">Soon</span>}
      </button>
    );
  };

  /**
   * 🎬 메인 렌더링 - 사이드바 전체 레이아웃 구성
   * 헤더, 메인 메뉴, 하단 메뉴, 사용자 정보 영역으로 구성
   */
  return (
    <div className={`w-64 bg-gray-900 flex flex-col h-full shadow-xl ${className}`}>
      
      {/* 🏷️ 헤더 영역 - 브랜드 로고 및 앱 정보 */}
      <div className="px-6 py-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          {/* 그라데이션 로고 */}
          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AWS²</span>
          </div>
          {/* 앱 타이틀 및 설명 */}
          <div>
            <h1 className="text-white font-bold text-lg">AWS² IoT</h1>
            <p className="text-gray-400 text-xs">Air Quality Monitor</p>
          </div>
        </div>
      </div>

      {/* 📱 메인 메뉴 영역 - 주요 기능 네비게이션 */}
      <nav className="flex-1 py-4">
        <div className="space-y-1">
          {menuItems.map(renderMenuItem)} {/* 각 메뉴 아이템 렌더링 */}
        </div>
      </nav>

      {/* ⚙️ 하단 메뉴 영역 - 보조 기능 및 설정 */}
      <div className="border-t border-gray-700">
        <div className="py-4 space-y-1">
          {bottomMenuItems.map(renderMenuItem)} {/* 하단 메뉴 아이템 렌더링 */}
        </div>
      </div>

      {/* 👤 사용자 정보 영역 - 현재 로그인된 사용자 표시 */}
      <div className="px-6 py-4 border-t border-gray-700 bg-gray-800">
        <div className="flex items-center gap-3">
          {/* 사용자 아바타 (이니셜 표시) */}
          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">A</span>
          </div>
          {/* 사용자 정보 텍스트 */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">Admin User</p>
            <p className="text-gray-400 text-xs truncate">admin@example.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
