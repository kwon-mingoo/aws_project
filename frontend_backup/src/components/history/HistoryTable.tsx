/**
 * ═══════════════════════════════════════════════════════════════
 * 📋 HistoryTable - 히스토리 데이터 테이블 컴포넌트
 * ═══════════════════════════════════════════════════════════════
 * 
 * 필터링된 히스토리 데이터를 테이블 형태로 표시하는 컴포넌트입니다.
 * 로딩 상태, 빈 데이터 상태, 정상 데이터 표시 상태를 모두 처리합니다.
 * 
 * 주요 기능:
 * - 로딩 상태 UI: 스피너와 로딩 메시지
 * - 빈 데이터 UI: 사용자 친화적 안내 메시지
 * - 데이터 테이블: 센서 이벤트 정보 표시
 * - 페이지네이션: 대량 데이터 효율적 표시
 * - 상태 배지: 상태별 색상 구분 표시
 * - 데이터 포매팅: 유틸리티 함수를 통한 일관된 표시
 * 
 * 테이블 구조:
 * - Event ID: 고유 이벤트 식별자
 * - Timestamp: 이벤트 발생 시간 (포매팅된 날짜/시간)
 * - Sensor Type: 센서 종류 (Temperature, Humidity, CO Concentration)
 * - Value: 측정값 + 단위 (℃, %, ppm 등)
 * - Status: 상태 배지 (GOOD/NORMAL/WARNING 색상 구분)
 * 
 * 성능 최적화:
 * - 조건부 렌더링으로 불필요한 렌더링 방지
 * - HistoryUtils를 통한 데이터 포매팅 캘이화
 * - CSS 모듈을 통한 스타일 분리
 */

import React from 'react';
// Lucide React 아이콘 임포트
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
// 서비스 및 유틸리티 임포트
import { HistoryUtils } from '../../services/HistoryTypes';
// 타입 정의 임포트
import { HistoryTableProps } from '../../services/HistoryTypes';
// CSS 모듈 스타일 임포트
import styles from './HistoryTable.module.css';

/**
 * 📋 HistoryTable 메인 컴포넌트
 * 
 * 히스토리 데이터의 다양한 상태를 처리하고 적절한 UI를 렌더링합니다.
 * 로딩, 빈 데이터, 정상 데이터 상태에 따라 다른 UI를 제공합니다.
 * 
 * @param historyState - 히스토리 전체 상태 (로딩, 데이터, 페이지 정보 등)
 * @param changePage - 페이지 변경 함수 (페이지네이션 버튼에서 사용)
 */
const HistoryTable: React.FC<HistoryTableProps> = ({
  historyState,
  changePage
}) => {
  /**
   * 🔄 로딩 상태 UI
   * 데이터를 불러오는 동안 스피너와 로딩 메시지를 표시합니다.
   * 사용자에게 대기 상태를 명확히 알리어 UX를 개선합니다.
   */
  if (historyState.isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>  {/* CSS 애니메이션 스피너 */}
        <span className={styles.loadingText}>데이터를 불러오는 중...</span>
      </div>
    );
  }

  /**
   * 📭 빈 데이터 상태 UI
   * 필터링 결과 데이터가 없을 때 사용자 친화적인 안내 메시지를 표시합니다.
   * 아이콘과 함께 직관적인 안내를 제공하여 사용자가 다음 액션을 취할 수 있도록 도와줍니다.
   */
  if (historyState.events.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateIcon}>
          <FileText size={24} />  {/* 문서 없음을 의미하는 아이콘 */}
        </div>
        <div className={styles.emptyStateTitle}>조회된 데이터가 없습니다</div>
        <div className={styles.emptyStateDescription}>
          필터 조건을 변경하거나 다른 날짜를 선택해 보세요.
        </div>
      </div>
    );
  }

  return (
    <>
      <table className={styles.table}>
        <thead className={styles.tableHeader}>
          <tr>
            <th className={styles.tableHeaderCell}>Event ID</th>
            <th className={styles.tableHeaderCell}>Timestamp</th>
            <th className={styles.tableHeaderCell}>Sensor Type</th>
            <th className={styles.tableHeaderCell}>Value</th>
            <th className={styles.tableHeaderCell}>Status</th>
          </tr>
        </thead>
        <tbody>
          {historyState.events.map((event: any) => (
            <tr key={event.eventId} className={styles.tableRow}>
              <td className={styles.tableCell}>
                <span className={styles.eventId}>{event.eventId}</span>
              </td>
              <td className={styles.tableCell}>
                <span className={styles.timestamp}>
                  {HistoryUtils.formatTimestamp(event.timestamp)}
                </span>
              </td>
              <td className={styles.tableCell}>
                <span className={styles.sensorType}>{event.sensorType}</span>
              </td>
              <td className={styles.tableCell}>
                <span className={styles.value}>
                  {event.value}{HistoryUtils.getSensorUnit(event.sensorType)}
                </span>
              </td>
              <td className={styles.tableCell}>
                <span className={`${styles.statusBadge} ${styles[HistoryUtils.getStatusClass(event.status)]}`}>
                  {event.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 페이지네이션 */}
      {historyState.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.paginationButton}
            onClick={() => changePage(historyState.currentPage - 1)}
            disabled={historyState.currentPage <= 1}
          >
            <ChevronLeft size={16} />
          </button>

          <span className={styles.paginationInfo}>
            {historyState.currentPage} / {historyState.totalPages}
          </span>

          <button
            className={styles.paginationButton}
            onClick={() => changePage(historyState.currentPage + 1)}
            disabled={historyState.currentPage >= historyState.totalPages}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </>
  );
};

export default HistoryTable;