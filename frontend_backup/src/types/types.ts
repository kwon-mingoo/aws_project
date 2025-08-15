// src/components/types.ts (또는 현재 파일 기준 ../types.ts)
export interface AdminDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}
// frontend/src/types/types.ts
export interface NotificationData {
  id: string;              // 알림 ID
  title: string;           // 알림 제목
  message: string;         // 알림 내용
  timestamp: string;       // 알림 발생 시각 (ISO 형식)
  read: boolean;           // 읽음 여부
  type?: 'info' | 'warning' | 'error'; // 알림 종류 (선택)
}

// 공지(알림) 타입
export interface NotificationItem {
  id: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface NotificationData {
  count: number;
  notifications: NotificationItem[];
}

// Sidebar에서 쓸 타입
export interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

// frontend/src/components/types.ts  ← 새 파일
import React from 'react';

export interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path: string;
}

export interface AdminDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: { id: string; message: string; timestamp: string; read: boolean }[];
}

