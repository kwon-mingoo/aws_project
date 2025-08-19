/**
 * ═══════════════════════════════════════════════════════════════
 * 🏷️ DashboardHeader - 대시보드 상단 헤더 컴포넌트
 * ═══════════════════════════════════════════════════════════════
 * 
 * 대시보드 화면의 상단에 위치하는 헤더 컴포넌트입니다.
 * 현재 페이지 정보, 실시간 시계, 알림, 관리자 메뉴를 제공합니다.
 * 
 * 주요 기능:
 * - 현재 활성 메뉴명 표시
 * - 실시간 시간 표시
 * - 알림 드롭다운 (뱃지 카운터 포함)
 * - 관리자 프로필 드롭다운
 * - 드롭다운 상호배타적 동작 (하나만 열림)
 * 
 * 레이아웃:
 * 왼쪽: 페이지 제목 + 현재 시간
 * 오른쪽: 알림 버튼 + 관리자 메뉴 버튼
 */

import React from 'react';
// Lucide React 아이콘 임포트
import { Bell, User, ChevronDown } from 'lucide-react';

// 드롭다운 컴포넌트 임포트
import NotificationDropdown from '../dropdown/NotificationDropdown'; // 알림 드롭다운
import AdminDropdown from '../dropdown/AdminDropdown';               // 관리자 메뉴 드롭다운

// CSS 모듈 스타일 임포트
import styles from './Header.module.css';

/**
 * 🔧 대시보드 헤더 컴포넌트 Props 인터페이스
 * 상위 컴포넌트에서 전달받는 상태와 함수들을 정의
 */
interface DashboardHeaderProps {
  activeMenu: string;                     // 현재 활성화된 메뉴명 (페이지 제목으로 사용)
  currentTime: string;                    // 현재 시간 문자열 (실시간 업데이트)
  notificationData: {                     // 알림 관련 데이터
    count: number;                        // 읽지 않은 알림 개수
    notifications: any[];                 // 알림 목록 배열
  };
  isNotificationOpen: boolean;            // 알림 드롭다운 열림 상태
  isAdminMenuOpen: boolean;               // 관리자 메뉴 드롭다운 열림 상태
  setIsNotificationOpen: React.Dispatch<React.SetStateAction<boolean>>; // 알림 드롭다운 상태 설정
  setIsAdminMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;     // 관리자 메뉴 상태 설정
}

/**
 * 🏷️ 메인 대시보드 헤더 컴포넌트
 * 
 * 대시보드 화면의 상단 네비게이션 바를 렌더링합니다.
 * 페이지 정보와 사용자 인터랙션 요소들을 제공합니다.
 * 
 * @param activeMenu - 현재 활성화된 메뉴명
 * @param currentTime - 실시간 시간 문자열
 * @param notificationData - 알림 데이터 (개수 및 목록)
 * @param isNotificationOpen - 알림 드롭다운 열림 상태
 * @param isAdminMenuOpen - 관리자 메뉴 열림 상태
 * @param setIsNotificationOpen - 알림 드롭다운 상태 설정 함수
 * @param setIsAdminMenuOpen - 관리자 메뉴 상태 설정 함수
 */
const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeMenu,
  currentTime,
  notificationData,
  isNotificationOpen,
  isAdminMenuOpen,
  setIsNotificationOpen,
  setIsAdminMenuOpen,
}) => {
  return (
    <header className={styles.header}>
      
      {/* 📝 헤더 왼쪽 영역 - 페이지 정보 */}
      <div className={styles.headerLeft}>
        <h1 className={styles.pageTitle}>{activeMenu}</h1>      {/* 현재 페이지 제목 */}
        <p className={styles.pageSubtitle}>{currentTime}</p>    {/* 실시간 시간 표시 */}
      </div>

      {/* ⚙️ 헤더 오른쪽 영역 - 사용자 인터랙션 요소들 */}
      <div className={styles.headerRight}>
        
        {/* 🔔 알림 버튼 및 드롭다운 영역 */}
        <div className={styles.headerItem}>
          <button
            onClick={() => {
              setIsNotificationOpen(!isNotificationOpen); // 알림 드롭다운 토글
              setIsAdminMenuOpen(false);                   // 관리자 메뉴는 닫기 (상호배타적)
            }}
            className={styles.headerButton}
            aria-label="알림"
          >
            <Bell size={20} />  {/* 벨 아이콘 */}
            
            {/* 알림 개수 뱃지 - 알림이 있을 때만 표시 */}
            {notificationData.count > 0 && (
              <span className={styles.notificationBadge}>
                {notificationData.count > 99 ? '99+' : notificationData.count}  {/* 99+ 제한 */}
              </span>
            )}
          </button>

          {/* 알림 드롭다운 컴포넌트 */}
          <NotificationDropdown
            isOpen={isNotificationOpen}                          // 열림 상태 전달
            onClose={() => setIsNotificationOpen(false)}         // 닫기 이벤트 핸들러
            notifications={notificationData.notifications}       // 알림 목록 데이터 전달
          />
        </div>

        {/* 👤 관리자 메뉴 버튼 및 드롭다운 영역 */}
        <div className={styles.headerItem}>
          <button
            onClick={() => {
              setIsAdminMenuOpen(!isAdminMenuOpen);  // 관리자 메뉴 드롭다운 토글
              setIsNotificationOpen(false);          // 알림 드롭다운은 닫기 (상호배타적)
            }}
            className={styles.adminButton}
            aria-label="관리자 메뉴"
          >
            <User size={20} />          {/* 사용자 아이콘 */}
            <span>관리자</span>          {/* 관리자 라벨 */}
            <ChevronDown size={16} />   {/* 드롭다운 화살표 */}
          </button>

          {/* 관리자 드롭다운 컴포넌트 */}
          <AdminDropdown
            isOpen={isAdminMenuOpen}                      // 열림 상태 전달
            onClose={() => setIsAdminMenuOpen(false)}     // 닫기 이벤트 핸들러
          />
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
