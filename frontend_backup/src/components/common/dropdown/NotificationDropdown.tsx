/**
 * ═══════════════════════════════════════════════════════════════
 * 🔔 NotificationDropdown - 알림 목록 드롭다운 컴포넌트
 * ═══════════════════════════════════════════════════════════════
 * 
 * 헤더 우상단의 알림 벨 아이콘을 클릭했을 때 나타나는 알림 목록 드롭다운입니다.
 * BaseDropdown을 기반으로 하여 알림 관련 기능들을 제공합니다.
 * 
 * 주요 기능:
 * - 실시간 알림 목록 표시
 * - 읽음/안읽음 상태 구분 표시
 * - 알림이 없을 때 빈 상태 메시지
 * - 각 알림의 메시지와 타임스탬프 표시
 * - 알림 클릭 시 자동 드롭다운 닫기
 * 
 * UI/UX 특징:
 * - BaseDropdown의 공통 스타일 상속
 * - 읽지 않은 알림은 itemUnread 스타일로 강조
 * - 빈 상태일 때 사용자 친화적 메시지
 * - 타임스탬프로 알림 시간 정보 제공
 * - 접근성 지원 (role="button")
 */

import React from 'react';
import BaseDropdown from './BaseDropdown';  // 공통 드롭다운 베이스 컴포넌트
import styles from './Dropdown.module.css'; // 드롭다운 공통 스타일

/**
 * 📄 개별 알림 아이템 타입 정의
 * 각 알림이 가져야 하는 데이터 구조를 명시
 */
export type Notification = {
  id: string;           // 고유 식별자 (중복 방지)
  message: string;      // 알림 메시지 내용
  timestamp: string;    // 알림 발생 시간
  read?: boolean;       // 읽음 여부 (선택적, 기본값: false)
};

/**
 * 🔧 NotificationDropdown 컴포넌트 Props 인터페이스
 */
type Props = {
  isOpen: boolean;                // 드롭다운 열림/닫힘 상태
  onClose: () => void;           // 드롭다운 닫기 함수 (필수)
  notifications: Notification[]; // 표시할 알림 목록 배열
};

/**
 * 🔔 NotificationDropdown 메인 컴포넌트
 * 
 * 알림 목록을 보여주는 드롭다운을 렌더링합니다.
 * BaseDropdown을 활용하여 일관된 UI/UX를 제공하며,
 * 알림 데이터의 상태에 따라 다른 UI를 동적으로 표시합니다.
 * 
 * 렌더링 로직:
 * 1. 알림이 없는 경우: 빈 상태 메시지 표시
 * 2. 알림이 있는 경우: 각 알림을 리스트 형태로 표시
 *    - 읽지 않은 알림: 강조 스타일 적용
 *    - 각 알림: 메시지 + 타임스탬프 구성
 * 
 * @param isOpen - 드롭다운 표시 여부
 * @param onClose - 드롭다운 닫기 함수
 * @param notifications - 표시할 알림 목록 배열
 */
const NotificationDropdown: React.FC<Props> = ({
  isOpen,
  onClose,
  notifications
}) => {
  return (
    <BaseDropdown isOpen={isOpen} onClose={onClose} title="알림">
      <div className={styles.list}>
        
        {/* 🔍 조건부 렌더링: 알림 존재 여부에 따른 UI 분기 */}
        {notifications.length === 0 ? (
          
          /* 📭 빈 상태 - 알림이 없을 때 표시되는 메시지 */
          <div className={styles.empty}>새로운 알림이 없습니다</div>
          
        ) : (
          
          /* 📋 알림 목록 - 각 알림을 개별 아이템으로 렌더링 */
          notifications.map(notification => (
            <div
              key={notification.id}  // 고유 키로 React 최적화
              
              // 📌 동적 클래스 적용: 읽지 않은 알림은 강조 스타일
              className={`${styles.item} ${!notification.read ? styles.itemUnread : ''}`}
              
              onClick={onClose}      // 알림 클릭 시 드롭다운 자동 닫기
              role="button"          // 접근성: 버튼 역할 명시
            >
              
              {/* 💬 알림 메시지 텍스트 */}
              <span className={styles.message}>{notification.message}</span>
              
              {/* ⏰ 알림 발생 시간 정보 */}
              <span className={styles.timestamp}>{notification.timestamp}</span>
            </div>
          ))
        )}
      </div>
    </BaseDropdown>
  );
};

export default NotificationDropdown;
