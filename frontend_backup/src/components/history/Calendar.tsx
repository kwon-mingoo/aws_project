/**
 * ═══════════════════════════════════════════════════════════════
 * 📅 Calendar - 날짜 선택 달력 컴포넌트
 * ═══════════════════════════════════════════════════════════════
 * 
 * 히스토리 필터에서 날짜를 선택하기 위한 전용 달력 컴포넌트입니다.
 * 표준 달력 UI를 제공하며 월 단위 네비게이션과 날짜 선택 기능을 포함합니다.
 * 
 * 주요 기능:
 * - 월별 달력 표시 (42일 그리드 레이아웃)
 * - 이전/다음 달 네비게이션
 * - 날짜 선택 및 하이라이트
 * - 현재 날짜 표시
 * - 다른 달의 날짜는 흐리게 표시
 * - "Check Now" 버튼으로 즉시 필터 적용
 * - 외부 클릭으로 달력 닫기 (오버레이)
 * 
 * 달력 구조:
 * - 헤더: 월/년 표시 및 네비게이션 버튼
 * - 요일 헤더: S M T W T F S
 * - 날짜 그리드: 6주 × 7일 = 42개 셀
 * - 액션 버튼: Check Now
 * - 배경 오버레이: 외부 클릭 감지
 */

import React, { useState } from 'react';
// Lucide React 아이콘 임포트
import { ChevronLeft, ChevronRight } from 'lucide-react';
// 타입 정의 임포트
import { CalendarProps, DayCell } from '../../services/HistoryTypes';
// CSS 모듈 스타일 임포트
import styles from './Calendar.module.css';

/**
 * 📅 Calendar 메인 컴포넌트
 * 
 * 월별 달력을 렌더링하고 날짜 선택 기능을 제공합니다.
 * 사용자가 선택한 날짜는 하이라이트되며, 현재 날짜도 별도 표시됩니다.
 * 
 * @param selectedDate - 현재 선택된 날짜 (없으면 오늘 날짜 기준)
 * @param onDateSelect - 날짜 선택 시 호출되는 콜백 함수
 * @param onClose - 달력 닫기 콜백 함수
 * @param onCheckNow - "Check Now" 버튼 클릭 시 호출되는 콜백
 */
const Calendar: React.FC<CalendarProps> = ({ 
  selectedDate, 
  onDateSelect, 
  onClose, 
  onCheckNow 
}) => {
  /**
   * 🗓️ 현재 표시중인 월 상태
   * 선택된 날짜가 있으면 해당 월을, 없으면 현재 월을 초기값으로 설정
   */
  const [currentMonth, setCurrentMonth] = useState(
    selectedDate || new Date()
  );

  /**
   * 📋 월 이름 배열 (영어)
   * 달력 헤더에 월/년 표시를 위한 상수 배열
   */
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  /**
   * 📋 요일 이름 배열 (축약형)
   * 달력 헤더의 요일 표시를 위한 상수 배열
   * 일요일(S)부터 토요일(S)까지
   */
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  /**
   * 📅 달력 그리드에 표시할 날짜 배열 생성 함수
   * 
   * 42개의 셀로 구성된 달력 그리드(6주 × 7일)를 채우기 위해
   * 이전 달, 현재 달, 다음 달의 날짜들을 조합하여 배열을 생성합니다.
   * 
   * 생성 로직:
   * 1. 이전 달 마지막 날들 (현재 달 첫 주 채우기)
   * 2. 현재 달의 모든 날들
   * 3. 다음 달 첫 날들 (현재 달 마지막 주 채우기)
   * 
   * @param date - 기준이 되는 날짜 (해당 월의 달력 생성)
   * @returns DayCell 배열 (총 42개 요소)
   */
  const getDaysInMonth = (date: Date): DayCell[] => {
    const year = date.getFullYear();        // 연도
    const month = date.getMonth();          // 월 (0-11)
    const firstDay = new Date(year, month, 1);      // 해당 월의 첫 날
    const lastDay = new Date(year, month + 1, 0);   // 해당 월의 마지막 날
    const daysInMonth = lastDay.getDate();           // 해당 월의 총 일수
    const startingDayOfWeek = firstDay.getDay();    // 첫 날의 요일 (0=일요일)

    const days: DayCell[] = [];

    // 🔙 이전 달의 마지막 날들 - 첫 주의 빈 칸 채우기
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDate - i),
        isCurrentMonth: false,  // 현재 월이 아니므로 흐리게 표시됨
      });
    }

    // 📅 현재 달의 모든 날들
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true    // 현재 월이므로 정상 표시
      });
    }

    // 🔜 다음 달의 첫 날들 - 마지막 주의 빈 칸 채우기 (총 42개까지)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false   // 현재 월이 아니므로 흐리게 표시됨
      });
    }

    return days;
  };

  /**
   * 🔄 월 네비게이션 함수
   * 이전/다음 달로 이동하는 기능을 제공합니다.
   * 
   * @param direction - 'prev' (이전 달) 또는 'next' (다음 달)
   */
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  /**
   * ✅ 선택된 날짜 확인 함수
   * 주어진 날짜가 현재 선택된 날짜와 같은지 확인합니다.
   * 연도, 월, 일이 모두 일치해야 true를 반환합니다.
   * 
   * @param date - 확인할 날짜
   * @returns 선택된 날짜 여부
   */
  const isSelected = (date: Date) => {
    return selectedDate &&
      date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate();
  };

  /**
   * 📍 오늘 날짜 확인 함수
   * 주어진 날짜가 오늘 날짜와 같은지 확인합니다.
   * 오늘 날짜는 달력에서 특별한 스타일로 강조 표시됩니다.
   * 
   * @param date - 확인할 날짜
   * @returns 오늘 날짜 여부
   */
  const isToday = (date: Date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  };

  // 📅 현재 월에 대한 날짜 배열 생성
  const days = getDaysInMonth(currentMonth);

  /**
   * 🎬 달력 UI 렌더링
   * 헤더, 그리드, 액션 버튼, 오버레이로 구성된 완전한 달력 UI를 제공
   */
  return (
    <>
      {/* 📱 메인 달력 컨테이너 */}
      <div className={styles.datePicker}>
        
        {/* 🏷️ 달력 헤더 - 월/년 표시 및 네비게이션 */}
        <div className={styles.calendarHeader}>
          {/* ⬅️ 이전 달 버튼 */}
          <button
            className={styles.calendarNavButton}
            onClick={() => navigateMonth('prev')}
          >
            <ChevronLeft size={16} />
          </button>

          {/* 📅 현재 월/년 표시 */}
          <div className={styles.calendarMonthYear}>
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>

          {/* ➡️ 다음 달 버튼 */}
          <button
            className={styles.calendarNavButton}
            onClick={() => navigateMonth('next')}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* 🗓️ 달력 그리드 영역 */}
        <div className={styles.calendarGrid}>
          
          {/* 📋 요일 헤더 (S M T W T F S) */}
          {dayNames.map(day => (
            <div key={day} className={styles.calendarDayHeader}>
              {day}
            </div>
          ))}

          {/* 📅 날짜 셀들 (42개 - 6주 × 7일) */}
          {days.map((dayInfo, index) => (
            <button
              key={index}
              // 🎨 동적 클래스 적용: 다른 월/선택됨/오늘 상태에 따른 스타일
              className={`${styles.calendarDay} ${
                !dayInfo.isCurrentMonth ? styles.otherMonth : ''   // 다른 월은 흐리게
              } ${
                isSelected(dayInfo.date) ? styles.selected : ''   // 선택된 날짜 강조
              } ${
                isToday(dayInfo.date) ? styles.today : ''         // 오늘 날짜 강조
              }`}
              onClick={() => onDateSelect(dayInfo.date)}         // 날짜 선택 이벤트
            >
              {dayInfo.date.getDate()}  {/* 날짜 숫자만 표시 */}
            </button>
          ))}
        </div>

        {/* 🔄 액션 버튼 영역 */}
        <div className={styles.calendarActions}>
          <button
            className={styles.checkNowButton}
            onClick={onCheckNow}  // 즉시 필터 적용
          >
            Check Now
          </button>
        </div>
      </div>

      {/* 🖱️ 배경 오버레이 - 외부 클릭으로 달력 닫기 */}
      <div
        className={styles.dropdownOverlay}
        onClick={onClose}
      />
    </>
  );
};

export default Calendar;