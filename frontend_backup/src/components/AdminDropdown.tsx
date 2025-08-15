// AdminDropdown.tsx
import React from 'react';
import { AdminDropdownProps } from '../types/types';
import styles from '../pages/Dashboard/DashboardScreen.module.css';

const AdminDropdown: React.FC<AdminDropdownProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleProfileClick = () => {
    console.log('프로필 설정 클릭');
    onClose();
  };

  const handleAccountClick = () => {
    console.log('계정 관리 클릭');
    onClose();
  };

  const handleLogoutClick = () => {
    console.log('로그아웃 클릭');
    // 실제 로그아웃 로직 구현
    onClose();
  };

  return (
    <>
      <div className={styles.adminDropdown}>
        <div className={styles.adminDropdownContent}>
          <button 
            className={styles.adminDropdownItem}
            onClick={handleProfileClick}
          >
            프로필 설정
          </button>
          <button 
            className={styles.adminDropdownItem}
            onClick={handleAccountClick}
          >
            계정 관리
          </button>
          <div className={styles.adminDropdownDivider} />
          <button 
            className={`${styles.adminDropdownItem} ${styles.adminDropdownLogout}`}
            onClick={handleLogoutClick}
          >
            로그아웃
          </button>
        </div>
      </div>
      <button 
        onClick={onClose}
        className={styles.dropdownOverlay}
        aria-label="관리자 메뉴 닫기"
      />
    </>
  );
};

export default AdminDropdown;