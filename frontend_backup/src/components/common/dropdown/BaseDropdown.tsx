/**
 * ═══════════════════════════════════════════════════════════════
 * 📦 BaseDropdown - 드롭다운 공통 기본 컴포넌트
 * ═══════════════════════════════════════════════════════════════
 * 
 * 모든 드롭다운 컴포넌트의 공통 기반이 되는 베이스 컴포넌트입니다.
 * 공통적인 레이아웃, 스타일링, 이벤트 처리를 담당하고
 * 실제 내용은 children prop을 통해 주입받습니다.
 * 
 * 주요 기능:
 * - 조건부 렌더링 (isOpen 상태에 따라)
 * - 외부 클릭으로 닫기 (Overlay)
 * - 모달 접근성 지원 (role, aria-modal)
 * - 선택적 제목 표시
 * - CSS 모듈을 통한 일관된 스타일링
 * 
 * 사용 예시:
 * ```tsx
 * <BaseDropdown isOpen={true} onClose={handleClose} title="메뉴">
 *   <div>드롭다운 내용...</div>
 * </BaseDropdown>
 * ```
 */

import React from 'react';
import styles from './Dropdown.module.css';

/**
 * 🔧 BaseDropdown 컴포넌트 Props 타입 정의
 */
export type BaseDropdownProps = {
  isOpen: boolean;              // 드롭다운 열림/닫힘 상태
  onClose: () => void;          // 드롭다운 닫기 콜백 함수
  children: React.ReactNode;    // 드롭다운 내부 콘텐츠 (자유롭게 커스터마이징 가능)
  title?: string;               // 선택적 드롭다운 제목
};

/**
 * 📦 BaseDropdown 메인 컴포넌트
 * 
 * 드롭다운의 공통 구조와 동작을 제공하는 베이스 컴포넌트입니다.
 * 모든 특화된 드롭다운 컴포넌트(알림, 관리자 메뉴 등)가 이를 기반으로 구현됩니다.
 * 
 * 렌더링 구조:
 * 1. 조건부 렌더링 - isOpen이 false면 아무것도 렌더링하지 않음
 * 2. 드롭다운 컨테이너 - 실제 드롭다운 내용을 담는 컨테이너
 * 3. 오버레이 - 외부 클릭으로 드롭다운을 닫기 위한 투명한 배경
 * 
 * @param isOpen - 드롭다운 표시 여부
 * @param onClose - 드롭다운 닫기 함수
 * @param children - 드롭다운 내부에 렌더링할 컨텐츠
 * @param title - 선택적 드롭다운 제목
 */
const BaseDropdown: React.FC<BaseDropdownProps> = ({ isOpen, onClose, children, title }) => {
  // 🚫 닫힌 상태일 때는 아무것도 렌더링하지 않음
  if (!isOpen) return null;

  return (
    <>
      {/* 📋 메인 드롭다운 컨테이너 */}
      <div className={styles.dropdown} role="dialog" aria-modal="true">
        
        {/* 🏷️ 선택적 제목 헤더 영역 */}
        {title && (
          <div className={styles.dropdownHeader}>
            <h3 className={styles.dropdownTitle}>{title}</h3>
          </div>
        )}
        
        {/* 📄 실제 드롭다운 내용 (children으로 주입) */}
        {children}
      </div>
      
      {/* 🔲 오버레이 - 외부 클릭으로 드롭다운 닫기 */}
      <button
        className={styles.overlay}
        aria-label="닫기"
        onClick={onClose}
      />
    </>
  );
};

export default BaseDropdown;
