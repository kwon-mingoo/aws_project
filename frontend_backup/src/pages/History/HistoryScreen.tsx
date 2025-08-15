// HistoryScreen.tsx - 히스토리 화면 컴포넌트
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell,
  User,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  MessageCircle,
  LayoutDashboard,
  History as HistoryIcon,
  Settings,
  LogOut
} from 'lucide-react';
import {
  HistoryState,
  HistoryEvent,
  HistoryFilters,
  HistoryAPI,
  HistoryUtils
} from '../../services/HistoryTypes';
import {
  NotificationData, 
  SidebarItemProps,
  DashboardAPI,
} from '../../services/DashboardTypes';
import styles from './HistoryScreen.module.css';

interface HistoryScreenProps {
  onNavigateBack: () => void;
  onNavigateToChatbot: () => void;
  onNavigateToHistory: () => void;
  onNavigateToRole?: () => void;
}


// 사이드바 아이템 컴포넌트
const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`${styles.sidebarItem} ${isActive ? styles.sidebarItemActive : ''}`}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);


type DayCell = { date: Date; isCurrentMonth: boolean };

// 달력 컴포넌트
const Calendar: React.FC<{
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
  onCheckNow: () => void;
}> = ({ selectedDate, onDateSelect, onClose, onCheckNow }) => {

  const [currentMonth, setCurrentMonth] = useState(
    selectedDate || new Date()
  );

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const getDaysInMonth = (date: Date): DayCell[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: DayCell[] = [];

    // 이전 달의 마지막 날들
    const prevMonthLastDate = new Date(year, month, 0).getDate(); // 이전 달 마지막 날짜
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDate - i),
        isCurrentMonth: false,
      });
    }

    // 현재 달의 날들
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true
      });
    }

    // 다음 달의 첫 날들 (총 42개까지 채우기)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false
      });
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const isSelected = (date: Date) => {
    return selectedDate &&
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate();
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  };

  const days = getDaysInMonth(currentMonth);

  return (
    <>
      <div className={styles.historyDatePicker}>
        <div className={styles.historyCalendarHeader}>
          <button
            className={styles.historyCalendarNavButton}
            onClick={() => navigateMonth('prev')}
          >
            <ChevronLeft size={16} />
          </button>

          <div className={styles.historyCalendarMonthYear}>
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>

          <button
            className={styles.historyCalendarNavButton}
            onClick={() => navigateMonth('next')}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className={styles.historyCalendarGrid}>
          {dayNames.map(day => (
            <div key={day} className={styles.historyCalendarDayHeader}>
              {day}
            </div>
          ))}

          {days.map((dayInfo, index) => (
            <button
              key={index}
              className={`${styles.historyCalendarDay} ${!dayInfo.isCurrentMonth ? styles.otherMonth : ''
                } ${isSelected(dayInfo.date) ? styles.selected : ''
                } ${isToday(dayInfo.date) ? styles.today : ''
                }`}
              onClick={() => onDateSelect(dayInfo.date)}
            >
              {dayInfo.date.getDate()}
            </button>
          ))}
        </div>

        <div className={styles.historyCalendarActions}>
          <button
            className={styles.historyCheckNowButton}
            onClick={onCheckNow}
          >
            Check Now
          </button>
        </div>
      </div>

      <div
        className={styles.historyDropdownOverlay}
        onClick={onClose}
      />
    </>
  );
};

// 알림 드롭다운 (재사용)
const NotificationDropdown: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationData['notifications'];
}> = ({ isOpen, onClose, notifications }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.dropdown}>
        <div className={styles.dropdownHeader}>
          <h3 className={styles.dropdownTitle}>알림</h3>
        </div>
        <div className={styles.notificationList}>
          {notifications.length === 0 ? (
            <div className={styles.emptyNotification}>새로운 알림이 없습니다</div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`${styles.notificationItem} ${!notification.read ? styles.notificationItemUnread : ''}`}
              >
                <p className={styles.notificationMessage}>{notification.message}</p>
                <p className={styles.notificationTimestamp}>{notification.timestamp}</p>
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

// 관리자 드롭다운 (재사용)
const AdminDropdown: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.adminDropdown}>
        <div className={styles.adminDropdownContent}>
          <button className={styles.adminDropdownItem}>프로필 설정</button>
          <button className={styles.adminDropdownItem}>계정 관리</button>
          <div className={styles.adminDropdownDivider} />
          <button className={`${styles.adminDropdownItem} ${styles.adminDropdownLogout}`}>로그아웃</button>
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

const HistoryScreen: React.FC<HistoryScreenProps> = ({ onNavigateBack, onNavigateToChatbot, onNavigateToHistory, onNavigateToRole }) => {
  const [activeMenu, setActiveMenu] = useState('Dashboard');

  // 메뉴 클릭 핸들러
  const handleMenuClick = (label: string, path: string) => {
    setActiveMenu(label);
    
    switch (label) {
    case 'Chatbot':
      onNavigateToChatbot();
      break;
    case 'History':
      onNavigateToHistory();
      break;
    case 'Dashboard':
      // 대시보드면 현재 화면 유지
      break;
    case 'Logout':
      onNavigateToRole?.();  // 역할 선택 화면으로
      break;
    default:
      break;
    }
  };
  const [historyState, setHistoryState] = useState<HistoryState>({
    events: [],
    isLoading: false,
    error: null,
    filters: {
      date: null,
      sensorType: null,
      status: null
    },
    currentPage: 1,
    totalPages: 1,
    showFilters: true,
    showDatePicker: false,
    selectedDate: null
  });

  const [notificationData, setNotificationData] = useState<NotificationData>({
    count: 0,
    notifications: []
  });

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // 데이터 로드
  const loadHistoryData = useCallback(async (page: number = 1) => {
    setHistoryState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // 개발용 목 데이터 사용
      const response = await HistoryAPI.generateMockHistoryData(historyState.filters, page);

      if (response.success) {
        setHistoryState(prev => ({
          ...prev,
          events: response.data,
          currentPage: response.currentPage,
          totalPages: response.totalPages,
          isLoading: false
        }));
      }
    } catch (error) {
      setHistoryState(prev => ({
        ...prev,
        isLoading: false,
        error: '데이터를 불러오는데 실패했습니다.'
      }));
    }
  }, [historyState.filters]);

  // 필터 적용
  const applyFilters = useCallback(() => {
    setHistoryState(prev => ({ ...prev, currentPage: 1 }));
    loadHistoryData(1);
  }, [loadHistoryData]);

  // 필터 초기화
  const resetFilters = useCallback(() => {
    setHistoryState(prev => ({
      ...prev,
      filters: { date: null, sensorType: null, status: null },
      selectedDate: null,
      currentPage: 1,
      showDatePicker: false
    }));
    setActiveDropdown(null);
  }, []);

  // 필터 변경
  const updateFilter = useCallback((key: keyof HistoryFilters, value: string | null) => {
    setHistoryState(prev => ({
      ...prev,
      filters: { ...prev.filters, [key]: value }
    }));
    setActiveDropdown(null);
  }, []);

  // 날짜 선택
  const handleDateSelect = useCallback((date: Date) => {
    const dateString = HistoryUtils.formatDateToString(date);
    setHistoryState(prev => ({
      ...prev,
      selectedDate: date,
      filters: { ...prev.filters, date: dateString }
    }));
  }, []);

  // 페이지 변경
  const changePage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= historyState.totalPages) {
      setHistoryState(prev => ({ ...prev, currentPage: newPage }));
      loadHistoryData(newPage);
    }
  }, [historyState.totalPages, loadHistoryData]);

  // 알림 데이터 가져오기
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await DashboardAPI.getNotifications();
      setNotificationData(data);
    } catch (error) {
      console.error('알림 데이터 가져오기 실패:', error);
    }
  }, []);

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    loadHistoryData();
    fetchNotifications();
  }, []);

  // 필터 변경 시 데이터 다시 로드
  useEffect(() => {
    if (historyState.filters.date || historyState.filters.sensorType || historyState.filters.status) {
      applyFilters();
    }
  }, [historyState.filters, applyFilters]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown && dropdownRefs.current[activeDropdown] &&
        !dropdownRefs.current[activeDropdown]?.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  const sensorTypeOptions = ['Temperature', 'Humidity', 'CO Concentration'];
  const statusOptions = ['GOOD', 'NORMAL', 'WARNING'];

  return (
    <div className={styles.container}>
      {/* 사이드바 */}
      <div className={styles.sidebar}>
        <div className={styles.logoSection}>
          <div className={styles.logoContainer}>
            <div className={styles.logoMain}>AWS²</div>
            <div className={styles.logoAccent}>GIoT</div>
          </div>
          <div className={styles.logoSubtext}>IoT Cloud System</div>
        </div>

        <nav className={styles.navigation}>
          <button className={styles.sidebarItem} onClick={onNavigateBack}>
            <span><LayoutDashboard size={20} /></span>
            <span>Dashboard</span>
          </button>
          <button className={styles.sidebarItem} onClick={onNavigateToChatbot}>
            <span><MessageCircle size={20} /></span>
            <span>Chatbot</span>
          </button>
          <button className={`${styles.sidebarItem} ${styles.sidebarItemActive}`}>
            <span><HistoryIcon size={20} /></span>
            <span>History</span>
          </button>
          <button className={styles.sidebarItem}>
            <span><Settings size={20} /></span>
            <span>Settings</span>
          </button>
          <button className={styles.sidebarItem}>
            <span><LogOut size={20} /></span>
            <span>Logout</span>
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.footerText}>2025 GBSA AWS</div>
        </div>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className={styles.mainContent}>
        {/* 상단 헤더 */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.headerTitle}>History</h1>
              <p className={styles.headerSubtitle}>{new Date().toLocaleString('ko-KR')}</p>
            </div>

            <div className={styles.headerActions}>
              {/* 알림 아이콘 */}
              <div className={styles.notificationContainer}>
                <button
                  onClick={() => {
                    setIsNotificationOpen(!isNotificationOpen);
                    setIsAdminMenuOpen(false);
                  }}
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
                  onClose={() => setIsNotificationOpen(false)}
                  notifications={notificationData.notifications}
                />
              </div>

              {/* 관리자 프로필 */}
              <div className={styles.adminContainer}>
                <button
                  onClick={() => {
                    setIsAdminMenuOpen(!isAdminMenuOpen);
                    setIsNotificationOpen(false);
                  }}
                  className={styles.adminButton}
                >
                  <div className={styles.adminAvatar}>
                    <User size={18} style={{ color: 'white' }} />
                  </div>
                  <span className={styles.adminLabel}>Admin</span>
                </button>

                <AdminDropdown
                  isOpen={isAdminMenuOpen}
                  onClose={() => setIsAdminMenuOpen(false)}
                />
              </div>
            </div>
          </div>
        </header>

        {/* 히스토리 메인 */}
        <main className={styles.historyMain}>
          <div className={styles.historyContent}>
            {/* 필터 섹션 */}
            <section className={styles.historyFilterSection}>
              <div className={styles.historyFilterHeader}>
                <button
                  className={styles.historyFilterToggle}
                  onClick={() => setHistoryState(prev => ({
                    ...prev,
                    showFilters: !prev.showFilters
                  }))}
                >
                  <Filter size={16} />
                  <span>Filter By</span>
                  <ChevronRight
                    size={16}
                    className={`${styles.historyFilterIcon} ${historyState.showFilters ? styles.open : ''}`}
                  />
                </button>

                <button
                  className={styles.historyResetButton}
                  onClick={resetFilters}
                >
                  <RotateCcw size={14} />
                  Reset Filter
                </button>
              </div>

              {historyState.showFilters && (
                <div className={styles.historyFilterContent}>
                  {/* 타임스탬프 필터 */}
                  <div className={styles.historyFilterGroup}>
                    <label className={styles.historyFilterLabel}>Timestamp</label>
                    <div
                      ref={el => dropdownRefs.current['timestamp'] = el}
                      className={styles.historyDatePickerContainer}
                    >
                      <button
                        className={`${styles.historyFilterDropdown} ${activeDropdown === 'timestamp' ? styles.active : ''}`}
                        onClick={() => setActiveDropdown(
                          activeDropdown === 'timestamp' ? null : 'timestamp'
                        )}
                      >
                        <span>
                          {historyState.selectedDate
                            ? HistoryUtils.formatDateToString(historyState.selectedDate)
                            : 'Select date'
                          }
                        </span>
                        <ChevronDown size={16} />
                      </button>

                      {activeDropdown === 'timestamp' && (
                        <Calendar
                          selectedDate={historyState.selectedDate}
                          onDateSelect={handleDateSelect}
                          onClose={() => setActiveDropdown(null)}
                          onCheckNow={() => {
                            applyFilters();
                            setActiveDropdown(null);
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* 센서 타입 필터 */}
                  <div className={styles.historyFilterGroup}>
                    <label className={styles.historyFilterLabel}>Order Sensor Type</label>
                    <div ref={el => dropdownRefs.current['sensorType'] = el}>
                      <button
                        className={`${styles.historyFilterDropdown} ${activeDropdown === 'sensorType' ? styles.active : ''}`}
                        onClick={() => setActiveDropdown(
                          activeDropdown === 'sensorType' ? null : 'sensorType'
                        )}
                      >
                        <span>{historyState.filters.sensorType || 'All types'}</span>
                        <ChevronDown size={16} />
                      </button>

                      {activeDropdown === 'sensorType' && (
                        <div className={styles.historyFilterDropdownMenu}>
                          <button
                            className={styles.historyFilterDropdownItem}
                            onClick={() => updateFilter('sensorType', null)}
                          >
                            All types
                          </button>
                          {sensorTypeOptions.map(type => (
                            <button
                              key={type}
                              className={styles.historyFilterDropdownItem}
                              onClick={() => updateFilter('sensorType', type)}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 상태 필터 */}
                  <div className={styles.historyFilterGroup}>
                    <label className={styles.historyFilterLabel}>Order Status</label>
                    <div ref={el => dropdownRefs.current['status'] = el}>
                      <button
                        className={`${styles.historyFilterDropdown} ${activeDropdown === 'status' ? styles.active : ''}`}
                        onClick={() => setActiveDropdown(
                          activeDropdown === 'status' ? null : 'status'
                        )}
                      >
                        <span>{historyState.filters.status || 'All status'}</span>
                        <ChevronDown size={16} />
                      </button>

                      {activeDropdown === 'status' && (
                        <div className={styles.historyFilterDropdownMenu}>
                          <button
                            className={styles.historyFilterDropdownItem}
                            onClick={() => updateFilter('status', null)}
                          >
                            All status
                          </button>
                          {statusOptions.map(status => (
                            <button
                              key={status}
                              className={styles.historyFilterDropdownItem}
                              onClick={() => updateFilter('status', status)}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 에러 메시지 */}
            {historyState.error && (
              <div className={styles.historyError}>
                {historyState.error}
              </div>
            )}

            {/* 테이블 섹션 */}
            <section className={styles.historyTableSection}>
              {historyState.isLoading ? (
                <div className={styles.historyLoading}>
                  <div className={styles.historyLoadingSpinner}></div>
                  <span className={styles.historyLoadingText}>데이터를 불러오는 중...</span>
                </div>
              ) : historyState.events.length === 0 ? (
                <div className={styles.historyEmptyState}>
                  <div className={styles.historyEmptyStateIcon}>
                    <FileText size={24} />
                  </div>
                  <div className={styles.historyEmptyStateTitle}>조회된 데이터가 없습니다</div>
                  <div className={styles.historyEmptyStateDescription}>
                    필터 조건을 변경하거나 다른 날짜를 선택해 보세요.
                  </div>
                </div>
              ) : (
                <>
                  <table className={styles.historyTable}>
                    <thead className={styles.historyTableHeader}>
                      <tr>
                        <th className={styles.historyTableHeaderCell}>Event ID</th>
                        <th className={styles.historyTableHeaderCell}>Timestamp</th>
                        <th className={styles.historyTableHeaderCell}>Sensor Type</th>
                        <th className={styles.historyTableHeaderCell}>Value</th>
                        <th className={styles.historyTableHeaderCell}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyState.events.map((event) => (
                        <tr key={event.eventId} className={styles.historyTableRow}>
                          <td className={styles.historyTableCell}>
                            <span className={styles.historyEventId}>{event.eventId}</span>
                          </td>
                          <td className={styles.historyTableCell}>
                            <span className={styles.historyTimestamp}>
                              {HistoryUtils.formatTimestamp(event.timestamp)}
                            </span>
                          </td>
                          <td className={styles.historyTableCell}>
                            <span className={styles.historySensorType}>{event.sensorType}</span>
                          </td>
                          <td className={styles.historyTableCell}>
                            <span className={styles.historyValue}>
                              {event.value}{HistoryUtils.getSensorUnit(event.sensorType)}
                            </span>
                          </td>
                          <td className={styles.historyTableCell}>
                            <span className={`${styles.historyStatusBadge} ${HistoryUtils.getStatusClass(event.status)}`}>
                              {event.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* 페이지네이션 */}
                  {historyState.totalPages > 1 && (
                    <div className={styles.historyPagination}>
                      <button
                        className={styles.historyPaginationButton}
                        onClick={() => changePage(historyState.currentPage - 1)}
                        disabled={historyState.currentPage <= 1}
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <span className={styles.historyPaginationInfo}>
                        {historyState.currentPage} / {historyState.totalPages}
                      </span>

                      <button
                        className={styles.historyPaginationButton}
                        onClick={() => changePage(historyState.currentPage + 1)}
                        disabled={historyState.currentPage >= historyState.totalPages}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default HistoryScreen;