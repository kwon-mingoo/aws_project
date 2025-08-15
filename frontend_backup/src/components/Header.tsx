// Header.tsx
import React from 'react';
import { Bell, User } from 'lucide-react';
import { NotificationData } from '../types/types';
import NotificationDropdown from './NotificationDropdown';
import AdminDropdown from './AdminDropdown';
import styles from '../pages/Dashboard/DashboardScreen.module.css';

interface HeaderProps {
  activeMenu: string;
  notificationData: NotificationData;
  isNotificationOpen: boolean;
  isAdminMenuOpen: boolean;
  onNotificationToggle: () => void;
  onAdminMenuToggle: () => void;
  onNotificationClose: () => void;
  onAdminMenuClose: () => void;
}

const Header: React.FC<HeaderProps> = ({
  activeMenu,
  notificationData,
  isNotificationOpen,
  isAdminMenuOpen,
  onNotificationToggle,
  onAdminMenuToggle,
  onNotificationClose,
  onAdminMenuClose
}) => {
  const getCurrentDateTime = () => {
    const now = new Date();
    return `${now.getFullYear()}년 ${String(now.getMonth() + 1).padStart(2, '0')}월 ${String(now.getDate()).padStart(2, '0')}일 ${String(now.getHours()).padStart(2, '0')}시 ${String(now.getMinutes()).padStart(2, '0')}분`;
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div>
          <h1 className={styles.headerTitle}>{activeMenu}</h1>
          <p className={styles.headerSubtitle}>{getCurrentDateTime()}</p>
        </div>
        
        <div className={styles.headerActions}>
          {/* 알림 아이콘 */}
          <div className={styles.notificationContainer}>
            <button
              onClick={onNotificationToggle}
              className={styles.notificationButton}
            >
              <Bell size={24} />
              {notificationData.count > 0 && (
                <span className={styles.notificationBadge}>
                  {notificationData.count > 99 ? '99+' : notificationData.count}
                </span>
              )}
            </button>
            
            <NotificationDropdown
              isOpen={isNotificationOpen}
              onClose={onNotificationClose}
              notifications={notificationData.notifications}
            />
          </div>

          {/* 관리자 프로필 */}
          <div className={styles.adminContainer}>
            <button
              onClick={onAdminMenuToggle}
              className={styles.adminButton}
            >
              <div className={styles.adminAvatar}>
                <User size={18} className={styles.adminAvatarIcon} />
              </div>
              <span className={styles.adminLabel}>Admin</span>
            </button>
            
            <AdminDropdown
              isOpen={isAdminMenuOpen}
              onClose={onAdminMenuClose}
            />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;