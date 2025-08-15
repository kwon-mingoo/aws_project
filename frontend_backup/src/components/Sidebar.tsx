// Sidebar.tsx
import React from 'react';
import {
  LayoutDashboard,
  MessageCircle,
  History,
  Settings,
  LogOut
} from 'lucide-react';
import { SidebarItemProps, MenuItem } from '../types/types';
import styles from '../pages/Dashboard/DashboardScreen.module.css';


// 사이드바 아이템 컴포넌트
const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
  >
    <span className={styles.sidebarItemIcon}>{icon}</span>
    <span>{label}</span>
  </button>
);

interface SidebarProps {
  activeMenu: string;
  onMenuClick: (label: string, path: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeMenu, onMenuClick }) => {
  const menuItems: MenuItem[] = [
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/Dashboard' },
    { icon: <MessageCircle size={20} />, label: 'Chatbot', path: '/chatbot' },
    { icon: <History size={20} />, label: 'History', path: '/history' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
    { icon: <LogOut size={20} />, label: 'Logout', path: '/logout' }
  ];

  return (
    <div className={styles.sidebar}>
      {/* 로고 영역 */}
      <div className={styles.logoSection}>
        <div className={styles.logoContainer}>
          <div className={styles.logoImage}>
            <img src="/images/logo1.png" alt="Logo" />
          </div>
        </div>
        <div className={styles.logoSubtext}>IoT Cloud System</div>
      </div>

      {/* 메뉴 항목들 */}
      <nav className={styles.navigation}>
        {menuItems.map((item) => (
          <SidebarItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            isActive={activeMenu === item.label}
            onClick={() => onMenuClick(item.label, item.path)}
          />
        ))}
      </nav>

      {/* 하단 정보 */}
      <div className={styles.sidebarFooter}>
        <div className={styles.footerText}>2025 GBSA AWS</div>
      </div>
    </div>
  );
};

export default Sidebar;