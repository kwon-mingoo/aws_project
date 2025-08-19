/**
 * ═══════════════════════════════════════════════════════════════
 * 📋 HistoryFilter - 히스토리 데이터 필터링 컴포넌트
 * ═══════════════════════════════════════════════════════════════
 * 
 * 히스토리 화면에서 데이터를 필터링하기 위한 종합적인 필터 UI 컴포넌트입니다.
 * 다양한 조건으로 센서 데이터를 필터링하고 검색할 수 있는 기능을 제공합니다.
 * 
 * 주요 기능:
 * - 날짜 필터: Calendar 컴포넌트를 통한 날짜 선택
 * - 센서 타입 필터: Temperature, Humidity, CO Concentration
 * - 상태 필터: GOOD, NORMAL, WARNING
 * - 필터 토글: 필터 영역 표시/숨기기
 * - 필터 초기화: 모든 필터 조건 리셋
 * - 드롭다운 상호배타적 동작: 하나만 열림
 * - 외부 클릭 감지: 드롭다운 자동 닫기
 * 
 * UI/UX 특징:
 * - 아코디언 스타일 레이아웃
 * - 현재 선택된 필터 값 표시
 * - 드롭다운 활성 상태 시각적 피드백
 * - useRef를 이용한 외부 클릭 감지 최적화
 * - 각 드롭다운별 개별 ref 관리
 */

import React, { useRef, useEffect } from 'react';
// Lucide React 아이콘 임포트
import { Filter, RotateCcw, ChevronRight, ChevronDown } from 'lucide-react';
// 서비스 및 유틸리티 임포트
import { HistoryUtils } from '../../services/HistoryTypes';
// 하위 컴포넌트 임포트
import Calendar from './Calendar';
// 타입 정의 임포트
import { HistoryFilterProps } from '../../services/HistoryTypes';
// CSS 모듈 스타일 임포트
import styles from './HistoryFilter.module.css';

/**
 * 📋 HistoryFilter 메인 컴포넌트
 * 
 * 히스토리 데이터 필터링을 위한 종합적인 UI를 제공합니다.
 * 다중 드롭다운 관리, 외부 클릭 감지, 필터 상태 관리 등을 담당합니다.
 * 
 * @param historyState - 히스토리 전체 상태 (필터, 데이터, UI 상태 등)
 * @param activeDropdown - 현재 열려있는 드롭다운 ID
 * @param setActiveDropdown - 드롭다운 열기/닫기 상태 설정 함수
 * @param updateFilter - 개별 필터 값 업데이트 함수
 * @param resetFilters - 모든 필터 초기화 함수
 * @param handleDateSelect - 날짜 선택 처리 함수
 * @param applyFilters - 필터 적용 및 데이터 조회 함수
 * @param toggleFilters - 필터 영역 표시/숨기기 토글 함수
 */

const HistoryFilter: React.FC<HistoryFilterProps> = ({
  historyState,
  activeDropdown,
  setActiveDropdown,
  updateFilter,
  resetFilters,
  handleDateSelect,
  applyFilters,
  toggleFilters
}) => {
  /**
   * 🔗 드롭다운 DOM 참조 관리
   * 외부 클릭 감지를 위해 각 드롭다운의 DOM 요소를 참조합니다.
   * 키-값 쌍으로 여러 드롭다운을 효율적으로 관리
   */
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  /**
   * 🔍 외부 클릭 감지 이팩트
   * 드롭다운 외부를 클릭하면 열려있는 드롭다운을 자동으로 닫습니다.
   * 성능 최적화를 위해 의존성 배열에 activeDropdown와 setActiveDropdown 포함
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // 열려있는 드롭다운이 있고, 해당 드롭다운 영역 외부를 클릭했을 때
      if (activeDropdown && dropdownRefs.current[activeDropdown] &&
        !dropdownRefs.current[activeDropdown]?.contains(event.target as Node)) {
        setActiveDropdown(null);  // 드롭다운 닫기
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown, setActiveDropdown]);

  /**
   * 🌡️ 센서 타입 필터 옵션
   * 시스템에서 지원하는 센서 종류들
   */
  const sensorTypeOptions = ['Temperature', 'Humidity', 'CO Concentration'];

  /**
   * 🚨 상태 필터 옵션
   * 센서 데이터의 상태 분류
   */
  const statusOptions = ['GOOD', 'NORMAL', 'WARNING'];

  return (
    <section className={styles.filterSection}>
      <div className={styles.filterHeader}>
        <button
          className={styles.filterToggle}
          onClick={toggleFilters}
        >

          <Filter size={16} />
          <span>Filter By</span>
          <ChevronRight
            size={16}
            className={`${styles.filterIcon} ${historyState.showFilters ? styles.open : ''}`}
          />
        </button>

        <button
          className={styles.resetButton}  // 선택: 빨간 테두리 스타일 쓰고 싶으면
          onClick={() => {
            resetFilters();         // ✅ 필터 값/데이터 초기화
            setActiveDropdown(null); // ✅ 열려있던 드롭다운 닫기(옵션)
          }}
        >
          <RotateCcw size={14} />
          Reset Filter
        </button>

      </div>

      {historyState.showFilters && (
        <div className={styles.filterContent}>
          {/* 타임스탬프 필터 */}
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Timestamp</label>
            <div
              ref={el => dropdownRefs.current['timestamp'] = el}
              className={styles.datePickerContainer}
            >
              <button
                className={`${styles.filterDropdown} ${activeDropdown === 'timestamp' ? styles.active : ''}`}
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
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Order Sensor Type</label>
            <div ref={el => dropdownRefs.current['sensorType'] = el}>
              <button
                className={`${styles.filterDropdown} ${activeDropdown === 'sensorType' ? styles.active : ''}`}
                onClick={() => setActiveDropdown(
                  activeDropdown === 'sensorType' ? null : 'sensorType'
                )}
              >
                <span>{historyState.filters.sensorType || 'All types'}</span>
                <ChevronDown size={16} />
              </button>

              {activeDropdown === 'sensorType' && (
                <div className={styles.filterDropdownMenu}>
                  <button
                    className={styles.filterDropdownItem}
                    onClick={() => updateFilter('sensorType', null)}
                  >
                    All types
                  </button>
                  {sensorTypeOptions.map(type => (
                    <button
                      key={type}
                      className={styles.filterDropdownItem}
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
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Order Status</label>
            <div ref={el => dropdownRefs.current['status'] = el}>
              <button
                className={`${styles.filterDropdown} ${activeDropdown === 'status' ? styles.active : ''}`}
                onClick={() => setActiveDropdown(
                  activeDropdown === 'status' ? null : 'status'
                )}
              >
                <span>{historyState.filters.status || 'All status'}</span>
                <ChevronDown size={16} />
              </button>

              {activeDropdown === 'status' && (
                <div className={styles.filterDropdownMenu}>
                  <button
                    className={styles.filterDropdownItem}
                    onClick={() => updateFilter('status', null)}
                  >
                    All status
                  </button>
                  {statusOptions.map(status => (
                    <button
                      key={status}
                      className={styles.filterDropdownItem}
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
  );
};

export default HistoryFilter;