/**
 * ═══════════════════════════════════════════════════════════════
 * ⚡ LoadingAnimation - 진행률 기반 동적 로딩 애니메이션
 * ═══════════════════════════════════════════════════════════════
 * 
 * 🎯 주요 기능:
 * - 로딩 진행률에 따른 동적 화살표 애니메이션
 * - 진행 단계별 시각적 피드백 제공 (4단계 구분)
 * - 화살표 길이 동적 조정으로 진행 상황 직관적 표시
 * - LoadingUtils 유틸리티를 활용한 계산 로직 분리
 * 
 * 🎨 애니메이션 단계:
 * - Stage 1 (0-24%): 초기 시작 단계, 화살표 생성
 * - Stage 2 (25-49%): 진행 중 단계, 화살표 확장
 * - Stage 3 (50-74%): 가속 단계, 색상 변화
 * - Stage 4 (75-100%): 완료 단계, 최종 강조
 * 
 * 🔧 기술적 특징:
 * - React Functional Component with TypeScript
 * - props를 통한 진행률 실시간 반영
 * - CSS 클래스 동적 적용으로 단계별 스타일링
 * - 인라인 스타일과 CSS 클래스 조합 최적화
 * 
 * 📊 진행률 계산:
 * - 화살표 길이: 진행률 × 2.4 (최대 240px)
 * - 단계 구분: 25% 단위로 4단계 분할
 * - 부드러운 전환을 위한 CSS 트랜지션 활용
 * 
 * 🎭 시각적 표현:
 * - 화살표 길이로 진행률 표시
 * - 색상 변화로 진행 단계 구분
 * - 화살표 머리 부분으로 방향성 강조
 * - 매끄러운 애니메이션으로 자연스러운 흐름
 * 
 * 🚀 성능 최적화:
 * - 계산 로직의 유틸리티 함수 분리
 * - 불필요한 리렌더링 최소화
 * - CSS GPU 가속 활용 가능한 속성 사용
 * - 조건부 클래스 적용으로 효율적 스타일링
 */
import React from 'react';
import { LoadingUtils } from '../../services/LoadingTypes';
import styles from './LoadingScreen.module.css';

// ========== 타입 정의 ==========

/**
 * 🎭 로딩 애니메이션 컴포넌트 Props 인터페이스
 * 
 * 부모 컴포넌트(LoadingScreen)에서 전달받는 진행률 정보를 정의합니다.
 * 단순하지만 핵심적인 진행률 데이터로 전체 애니메이션을 제어합니다.
 */
interface LoadingAnimationProps {
  progress: number;    // 로딩 진행률 (0-100 범위의 숫자)
}

// ========== 메인 컴포넌트 ==========

/**
 * ⚡ 로딩 진행률 기반 동적 애니메이션 컴포넌트
 * 
 * 사용자에게 시스템 로딩 상태를 시각적으로 전달하는 핵심 UI 요소입니다.
 * 진행률에 따라 화살표 길이와 스타일이 동적으로 변화하여
 * 로딩 과정의 각 단계를 직관적으로 보여줍니다.
 * 
 * 🎯 핵심 기능:
 * - 진행률 → 화살표 길이 실시간 변환
 * - 단계별 시각적 구분 (색상, 효과)
 * - 부드러운 전환 애니메이션
 * - 사용자 경험 최적화
 * 
 * 🔄 데이터 플로우:
 * 1. props.progress 수신 (0-100)
 * 2. LoadingUtils로 길이/단계 계산
 * 3. CSS 클래스 및 스타일 결정
 * 4. DOM 업데이트 및 애니메이션 실행
 * 
 * 🎨 시각적 구성:
 * - 컨테이너: 중앙 정렬 및 위치 고정
 * - 화살표 몸체: 진행률에 비례하는 너비
 * - 화살표 머리: 방향성과 완료감 표현
 * - 단계별 색상: 진행 상황 직관적 구분
 * 
 * @param progress - 현재 로딩 진행률 (0-100)
 * @returns 동적 로딩 애니메이션 JSX 엘리먼트
 */
const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ progress }) => {
  
  // ========== 계산 로직 ==========
  
  /**
   * 📏 화살표 길이 계산
   * LoadingUtils.getArrowLength()를 통해 진행률을 픽셀 단위 길이로 변환합니다.
   * 0%일 때 0px, 100%일 때 최대 길이가 되도록 선형 계산됩니다.
   */
  const arrowLength = LoadingUtils.getArrowLength(progress);
  
  /**
   * 🎭 애니메이션 단계 판별
   * LoadingUtils.getAnimationStage()를 통해 현재 진행률이 어느 단계에
   * 해당하는지 확인합니다. 각 단계마다 다른 시각적 효과를 적용합니다.
   */
  const stage = LoadingUtils.getAnimationStage(progress);
  
  /**
   * 🎨 진행 단계별 화살표 스타일 클래스 결정 함수
   * 
   * 진행률을 4단계로 나누어 각각 다른 CSS 클래스를 적용합니다.
   * 단계별로 색상, 그림자, 애니메이션 효과가 달라져서
   * 사용자가 진행 상황을 직관적으로 파악할 수 있습니다.
   * 
   * 📊 단계별 구분:
   * - 0-24%: arrowStage1 (시작 단계 - 연한 색상)
   * - 25-49%: arrowStage2 (진행 단계 - 중간 색상)
   * - 50-74%: arrowStage3 (가속 단계 - 진한 색상)
   * - 75-100%: arrowStage4 (완료 단계 - 강조 색상)
   * 
   * @returns 현재 진행률에 해당하는 CSS 클래스명
   */
  const getArrowClass = () => {
    if (progress < 25) return styles.arrowStage1;      // 🟡 초기 단계
    if (progress < 50) return styles.arrowStage2;      // 🟠 진행 단계  
    if (progress < 75) return styles.arrowStage3;      // 🔴 가속 단계
    return styles.arrowStage4;                         // 🟢 완료 단계
  };

  // ========== JSX 렌더링 ==========

  return (
    <div className={styles.arrowContainer}>
      {/* 🏹 동적 화살표 - 진행률에 따라 길이와 스타일이 변화 */}
      <div 
        className={`${styles.arrow} ${getArrowClass()}`}
        style={{
          width: `${arrowLength * 2.4}px`,    // 진행률 × 2.4 (최대 240px)
        }}
      >
        {/* ▶️ 화살표 머리 부분 - 방향성과 완료감을 시각적으로 표현 */}
        <div className={styles.arrowHead} />
      </div>
    </div>
  );
};

export default LoadingAnimation;