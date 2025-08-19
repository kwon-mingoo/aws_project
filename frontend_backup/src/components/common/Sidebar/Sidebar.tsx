/**
 * ═══════════════════════════════════════════════════════════════
 * 📱 Sidebar - 공통 사이드바 컴포넌트 (CSS 모듈 버전)
 * ═══════════════════════════════════════════════════════════════
 * 
 * 애플리케이션의 메인 네비게이션을 담당하는 사이드바 컴포넌트입니다.
 * CSS 모듈을 사용하여 스타일이 적용되며, 기본적인 메뉴 구조를 제공합니다.
 * 
 * 주요 기능:
 * - 메뉴 아이템 렌더링 및 상태 관리
 * - 활성 메뉴 하이라이트
 * - 접근성 지원 (ARIA 라벨, 키보드 네비게이션)
 * - 커스터마이징 가능한 메뉴 구성
 * 
 * 기본 메뉴:
 * - Dashboard: 메인 대시보드
 * - Chatbot: AI 질의응답
 * - History: 데이터 이력
 * - Settings: 설정 (향후 구현)
 * - Logout: 로그아웃
 */

import React from 'react';
// Lucide React 아이콘 임포트
import { LayoutDashboard, MessageCircle, History, Settings, LogOut } from 'lucide-react';
// 타입 정의 임포트
import { SidebarProps, SidebarItemProps, MenuItem } from './SidebarTypes';
// CSS 모듈 스타일 임포트
import styles from './Sidebar.module.css';

/**
 * 📋 기본 메뉴 아이템 구성
 * Props로 메뉴가 전달되지 않을 때 사용되는 기본 메뉴 설정
 * React.createElement를 사용하여 아이콘 컴포넌트를 생성
 */
const DEFAULT_MENU_ITEMS: MenuItem[] = [
  { 
    icon: React.createElement(LayoutDashboard, { size: 20 }), 
    label: 'Dashboard', 
    path: '/dashboard' 
  },
  { 
    icon: React.createElement(MessageCircle, { size: 20 }), 
    label: 'Chatbot', 
    path: '/chatbot' 
  },
  { 
    icon: React.createElement(History, { size: 20 }), 
    label: 'History', 
    path: '/history' 
  },
  { 
    icon: React.createElement(Settings, { size: 20 }), 
    label: 'Settings', 
    path: '/settings' 
  },
  { 
    icon: React.createElement(LogOut, { size: 20 }), 
    label: 'Logout', 
    path: '/logout' 
  }
];

/**
 * 🔘 개별 사이드바 메뉴 아이템 컴포넌트
 * 각 메뉴 버튼을 렌더링하고 클릭 이벤트를 처리합니다.
 * 
 * @param icon - 메뉴 아이콘 (React 컴포넌트)
 * @param label - 메뉴 라벨 텍스트
 * @param isActive - 현재 활성화된 메뉴인지 여부
 * @param onClick - 클릭 이벤트 핸들러
 */
const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
    aria-current={isActive ? 'page' : undefined} // 접근성: 현재 페이지 표시
  >
    <span>{icon}</span>    {/* 아이콘 영역 */}
    <span>{label}</span>   {/* 라벨 텍스트 영역 */}
  </button>
);

/**
 * 📱 메인 사이드바 컴포넌트
 * 
 * 애플리케이션의 주요 네비게이션을 제공하는 사이드바입니다.
 * 메뉴 클릭 시 상위 컴포넌트로 이벤트를 전달하여 라우팅을 처리합니다.
 * 
 * @param activeMenu - 현재 활성화된 메뉴명
 * @param onMenuClick - 메뉴 클릭 시 호출되는 콜백 함수
 * @param menuItems - 커스텀 메뉴 아이템 배열 (선택적, 기본값 사용 가능)
 */
const Sidebar: React.FC<SidebarProps> = ({ 
  activeMenu, 
  onMenuClick, 
  menuItems = DEFAULT_MENU_ITEMS 
}) => {
  return (
    <nav className={styles.sidebar} role="navigation" aria-label="메인 네비게이션">
      {/* 🏷️ 사이드바 헤더 - 애플리케이션 타이틀 */}
      <div className={styles.sidebarHeader}>
        <h2 className={styles.sidebarTitle}>AWS IOT</h2>
      </div>

      {/* 📋 사이드바 메뉴 영역 - 메뉴 아이템들을 렌더링 */}
      <div className={styles.sidebarMenu}>
        {menuItems.map((item) => (
          <SidebarItem
            key={item.label}                           // 고유 키 (라벨 기준)
            icon={item.icon}                           // 메뉴 아이콘
            label={item.label}                         // 메뉴 라벨
            isActive={activeMenu === item.label}       // 활성 상태 확인
            onClick={() => onMenuClick(item.label, item.path)} // 클릭 이벤트 전달
          />
        ))}
      </div>
    </nav>
  );
};

export default Sidebar;