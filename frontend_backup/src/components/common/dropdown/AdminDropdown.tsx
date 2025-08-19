/**
 * ═══════════════════════════════════════════════════════════════
 * 👤 AdminDropdown - 관리자 전용 메뉴 드롭다운 컴포넌트
 * ═══════════════════════════════════════════════════════════════
 * 
 * 헤더 우상단의 관리자 버튼을 클릭했을 때 나타나는 드롭다운 메뉴입니다.
 * BaseDropdown을 기반으로 하여 관리자 전용 기능들을 제공합니다.
 * 
 * 주요 기능:
 * - 프로필 설정: 개인 정보 수정
 * - 계정 관리: 관리자 계정 설정
 * - 로그아웃: 시스템에서 로그아웃 (위험 동작으로 빨간색 스타일)
 * 
 * UI/UX 특징:
 * - BaseDropdown의 공통 스타일 상속
 * - 구분선으로 일반 메뉴와 위험 동작 분리
 * - 로그아웃은 itemDanger 스타일로 강조
 * - 각 메뉴 클릭 시 자동으로 드롭다운 닫기
 */

import React from 'react';
import BaseDropdown from './BaseDropdown';  // 공통 드롭다운 베이스 컴포넌트
import styles from './Dropdown.module.css'; // 드롭다운 공통 스타일

/**
 * 🔧 AdminDropdown 컴포넌트 Props 인터페이스
 * 모든 콜백 함수는 선택적(optional)으로 정의되어 유연성 제공
 */
type Props = {
  isOpen: boolean;           // 드롭다운 열림/닫힘 상태
  onClose: () => void;       // 드롭다운 닫기 함수 (필수)
  onProfile?: () => void;    // 프로필 설정 클릭 시 호출 (선택적)
  onAccount?: () => void;    // 계정 관리 클릭 시 호출 (선택적)
  onLogout?: () => void;     // 로그아웃 클릭 시 호출 (선택적)
};

/**
 * 👤 AdminDropdown 메인 컴포넌트
 * 
 * 관리자 전용 메뉴 드롭다운을 렌더링합니다.
 * BaseDropdown을 활용하여 일관된 UI/UX를 제공하며,
 * 관리자가 자주 사용하는 기능들에 빠르게 접근할 수 있도록 합니다.
 * 
 * 메뉴 구성:
 * 1. 일반 메뉴: 프로필 설정, 계정 관리
 * 2. 구분선
 * 3. 위험 동작: 로그아웃 (빨간색 스타일)
 * 
 * @param isOpen - 드롭다운 표시 여부
 * @param onClose - 드롭다운 닫기 함수
 * @param onProfile - 프로필 설정 메뉴 클릭 핸들러
 * @param onAccount - 계정 관리 메뉴 클릭 핸들러
 * @param onLogout - 로그아웃 메뉴 클릭 핸들러
 */
const AdminDropdown: React.FC<Props> = ({
  isOpen,
  onClose,
  onProfile,
  onAccount,
  onLogout,
}) => {
  return (
    <BaseDropdown isOpen={isOpen} onClose={onClose} title="관리자 메뉴">
      <div className={styles.list}>
        
        {/* 📝 프로필 설정 메뉴 - 개인 정보 수정 */}
        <button 
          className={styles.item} 
          onClick={() => { 
            onProfile?.();  // 프로필 설정 콜백 호출 (있다면)
            onClose();      // 드롭다운 자동 닫기
          }}
        >
          프로필 설정
        </button>
        
        {/* ⚙️ 계정 관리 메뉴 - 관리자 계정 설정 */}
        <button 
          className={styles.item} 
          onClick={() => { 
            onAccount?.();  // 계정 관리 콜백 호출 (있다면)
            onClose();      // 드롭다운 자동 닫기
          }}
        >
          계정 관리
        </button>

        {/* ➖ 구분선 - 일반 메뉴와 위험 동작 분리 */}
        <div className={styles.divider} />

        {/* 🚪 로그아웃 메뉴 - 위험 동작으로 빨간색 스타일 적용 */}
        <button
          className={`${styles.item} ${styles.itemDanger}`}  // 위험 동작 스타일 조합
          onClick={() => { 
            onLogout?.();   // 로그아웃 콜백 호출 (있다면)
            onClose();      // 드롭다운 자동 닫기
          }}
        >
          로그아웃
        </button>
      </div>
    </BaseDropdown>
  );
};

export default AdminDropdown;
