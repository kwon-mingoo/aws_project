// NotificationDropdown.tsx
import React from 'react';
import { NotificationDropdownProps } from '../types/types';
import styles from '../pages/Dashboard/DashboardScreen.module.css';

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ 
  isOpen, 
  onClose, 
  notifications 
}) => {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.dropdown}>
        <div className={styles.dropdownHeader}>
          <h3 className={styles.dropdownTitle}>알림</h3>
        </div>
        <div className={styles.notificationList}>
          {notifications.length === 0 ? (
            <div className={styles.emptyNotification}>
              새로운 알림이 없습니다
            </div>
          ) : (
            notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`${styles.notificationItem} ${
                  !notification.read ? styles.notificationItemUnread : ''
                }`}
              >
                <p className={styles.notificationMessage}>
                  {notification.message}
                </p>
                <p className={styles.notificationTimestamp}>
                  {notification.timestamp}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
      <button 
        onClick={onClose}
        className={styles.dropdownOverlay}
        aria-label="알림 닫기"
      />
    </>
  );
};

export default NotificationDropdown;