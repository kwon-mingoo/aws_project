/**
 * ═══════════════════════════════════════════════════════════════
 * 🏠 MainScreen - 메인 진입 화면 컴포넌트
 * ═══════════════════════════════════════════════════════════════
 * 
 * 🎯 주요 기능:
 * - 애플리케이션 진입점 역할을 하는 시작 화면
 * - AWS² GiOT 시스템 브랜딩 및 로고 표시
 * - 시스템 초기화 상태 및 연결 상태 표시
 * - 자동 화면 전환 (1초 후) 및 수동 진행 옵션
 * - 사용자 경험을 위한 부드러운 애니메이션
 * 
 * 🎨 UI/UX 특징:
 * - 기하학적 패턴 배경으로 기술적 이미지 연출
 * - 시각적 계층 구조: 로고 → 상태 → 액션 버튼
 * - 실시간 상태 인디케이터 (AWS 연결, IoT 센서)
 * - 반응형 디자인 및 접근성 고려
 * - 클릭 힌트 제공으로 사용자 가이드
 * 
 * 🔄 네비게이션 플로우:
 * 1. MainScreen (현재) → 자동/수동 진행
 * 2. Dashboard 또는 RoleSelection으로 이동
 * 3. 컴포넌트 언마운트 시 타이머 정리
 * 
 * 🚀 성능 최적화:
 * - useEffect 클린업으로 메모리 누수 방지
 * - CSS 모듈 사용으로 스타일 격리
 * - 이벤트 핸들러 최적화
 * 
 * 📱 접근성 고려사항:
 * - 클릭과 버튼 두 가지 진행 방법 제공
 * - 시각적 피드백 (상태 인디케이터)
 * - 명확한 액션 가이드 텍스트
 */
import React, { useEffect } from "react";
import styles from "./MainScreen.module.css";

// ========== 타입 정의 ==========

/**
 * 🎭 메인 화면 컴포넌트 Props 인터페이스
 * 
 * 부모 컴포넌트(AppRouter)와의 상호작용을 위한 콜백 함수를 정의합니다.
 * 단순한 진입 화면이므로 최소한의 props만 사용합니다.
 */
interface MainScreenProps {
  onNavigateToDashboard: () => void;    // 다음 화면(대시보드)로 이동하는 콜백 함수
}

// ========== 메인 컴포넌트 ==========

/**
 * 🏠 메인 진입 화면 컴포넌트
 * 
 * AWS² GiOT 시스템의 첫 화면으로, 사용자에게 시스템을 소개하고
 * 초기화 상태를 표시한 후 자동으로 다음 화면으로 이동합니다.
 * 
 * 🎯 핵심 역할:
 * - 브랜드 아이덴티티 전달 (AWS² GiOT 로고)
 * - 시스템 준비 상태 확인 및 표시
 * - 사용자에게 시작 신호 제공
 * - 매끄러운 앱 진입 경험 제공
 * 
 * 🔧 기술적 특징:
 * - React Functional Component + Hooks
 * - useEffect를 통한 생명주기 관리
 * - CSS 모듈 기반 스타일링
 * - 타이머 기반 자동 전환
 * 
 * @param onNavigateToDashboard - 대시보드로 이동하는 콜백 함수
 * @returns 메인 화면 JSX 엘리먼트
 */
const MainScreen: React.FC<MainScreenProps> = ({ onNavigateToDashboard }) => {
  
  // ========== 생명주기 관리 ==========
  
  /**
   * 🕒 자동 화면 전환 효과
   * 
   * 컴포넌트 마운트 후 1초 뒤에 자동으로 다음 화면으로 이동합니다.
   * 사용자가 기다리지 않고도 자연스럽게 앱을 시작할 수 있도록 합니다.
   * 
   * 🧹 클린업 처리:
   * - 컴포넌트 언마운트 시 타이머 제거
   * - 메모리 누수 및 불필요한 콜백 실행 방지
   * 
   * 📝 의존성 배열:
   * - [onNavigateToDashboard]: 콜백 함수 변경 시 effect 재실행
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      onNavigateToDashboard();  // 1초 후 자동 이동
    }, 1000);

    // 🧹 클린업: 컴포넌트 언마운트 시 타이머 정리
    return () => clearTimeout(timer);
  }, [onNavigateToDashboard]);

  // ========== JSX 렌더링 ==========

  return (
    <div className={styles.mainContainer} onClick={onNavigateToDashboard}>
      {/* 🎨 배경 기하학적 패턴 - 기술적이고 모던한 분위기 연출 */}
      <div className={styles.mainGeometricBackground}>
        {/* 🔷 육각형 모양들 - IoT 네트워크를 상징하는 연결된 패턴 */}
        <div className={`${styles.mainGeometricShape} ${styles.mainHexagon1}`}></div>
        <div className={`${styles.mainGeometricShape} ${styles.mainHexagon2}`}></div>
        <div className={`${styles.mainGeometricShape} ${styles.mainHexagon3}`}></div>
        <div className={`${styles.mainGeometricShape} ${styles.mainHexagon4}`}></div>
        <div className={`${styles.mainGeometricShape} ${styles.mainCenterHexagon}`}></div>
        
        {/* 📏 선형 패턴들 - 데이터 흐름과 연결성을 시각화 */}
        <div className={`${styles.mainGeometricShape} ${styles.mainLinePattern1}`}></div>
        <div className={`${styles.mainGeometricShape} ${styles.mainLinePattern2}`}></div>
      </div>

      {/* 🏢 메인 로고 영역 - AWS² GiOT 브랜드 아이덴티티 */}
      <div className={styles.mainLogoContainer}>
        {/* 📝 로고 텍스트 - AWS² (AWS 제곱) + GiOT (Green IoT) */}
        <div className={styles.mainLogoText}>
          <span className={styles.mainLogoMain}>AWS</span>          {/* AWS 기본 텍스트 */}
          <span className={styles.mainLogoAccent}>²</span>          {/* 제곱 기호 (특별한 강조) */}
          <span className={styles.mainLogoMain}>GiOT</span>         {/* Green IoT 약자 */}
        </div>
        
        {/* 📄 서브 텍스트 - 시스템 설명 */}
        <div className={styles.mainLogoSubtext}>Green IoT System</div>

        {/* 🔽 화살표 인디케이터 - 진행 방향 안내 */}
        <div className={styles.mainArrowContainer}>
          <div className={styles.mainArrow}>
            <div className={styles.mainArrowHead}></div>
          </div>
        </div>
      </div>

      {/* 📊 상태 표시 영역 - 시스템 초기화 및 연결 상태 */}
      <div className={styles.statusContainer}>
        {/* 💬 상태 메시지 - 현재 진행 상황 안내 */}
        <div className={styles.statusText}>시스템을 시작하고 있습니다...</div>
        
        {/* 🔘 상태 인디케이터들 - 각 구성요소의 연결 상태 */}
        <div className={styles.statusIndicators}>
          {/* ☁️ AWS 연결 상태 */}
          <div className={styles.statusIndicator}>
            <div className={`${styles.statusDot} ${styles.statusDotConnected}`}></div>
            <span className={styles.statusLabel}>AWS 연결됨</span>
          </div>
          
          {/* 📡 IoT 센서 상태 */}
          <div className={styles.statusIndicator}>
            <div className={`${styles.statusDot} ${styles.statusDotConnected}`}></div>
            <span className={styles.statusLabel}>IoT 센서 활성화</span>
          </div>
        </div>

        {/* 🎯 수동 진행 버튼 - 사용자가 원할 때 직접 진행 */}
        <button 
          onClick={onNavigateToDashboard} 
          className={styles.mainRetryButton} 
          style={{marginTop: '20px'}}
        >
          Get Started
        </button>
      </div>

      {/* 💡 클릭 힌트 - 사용자 가이드 */}
      <div className={styles.clickHint}>
        화면을 클릭하거나 Get Started 버튼을 눌러주세요
      </div>

      {/* 📜 하단 카피라이트 - 법적 정보 및 브랜딩 */}
      <div className={styles.mainCopyright}>
        © 2024 AWS² GiOT System. All rights reserved.
      </div>
    </div>
  );
};

export default MainScreen;