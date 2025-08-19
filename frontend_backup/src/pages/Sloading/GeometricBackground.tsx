/**
 * ═══════════════════════════════════════════════════════════════
 * 🎨 GeometricBackground - 로딩 화면 배경 기하학적 패턴
 * ═══════════════════════════════════════════════════════════════
 * 
 * 🎯 주요 기능:
 * - 로딩 화면의 배경으로 사용되는 기하학적 패턴 렌더링
 * - AWS² GiOT 시스템의 기술적이고 모던한 분위기 연출
 * - 육각형과 선형 패턴을 조합한 복잡한 시각적 구성
 * - CSS 커스텀 프로퍼티를 활용한 동적 회전 애니메이션
 * 
 * 🎨 디자인 컨셉:
 * - IoT 네트워크의 노드와 연결선을 추상화한 디자인
 * - 육각형: IoT 센서 노드들을 상징
 * - 선형 패턴: 데이터 흐름과 네트워크 연결을 표현
 * - 회전 애니메이션: 시스템의 동적 특성 시각화
 * 
 * 🔧 기술적 특징:
 * - React Functional Component 방식
 * - CSS Modules를 통한 스타일 격리
 * - CSS 커스텀 프로퍼티 (--rotate)로 동적 스타일 적용
 * - 절대 위치 지정으로 배경 레이어 구성
 * 
 * 🎭 시각적 요소:
 * - 4개의 육각형 패턴 (각각 다른 위치와 회전값)
 * - 2개의 선형 패턴 (연결선 및 데이터 흐름 표현)
 * - 반투명 효과로 전경 콘텐츠와의 조화
 * - 반응형 디자인으로 다양한 화면 크기 대응
 * 
 * 🚀 성능 최적화:
 * - 순수 CSS 애니메이션으로 GPU 가속 활용
 * - React.memo 사용 가능 (props 없는 정적 컴포넌트)
 * - 가벼운 렌더링 비용 (DOM 요소 최소화)
 * 
 * 📱 반응형 지원:
 * - 화면 크기에 따른 패턴 스케일 조정
 * - 모바일 환경에서도 부드러운 애니메이션
 * - 성능을 고려한 애니메이션 최적화
 */
import React from 'react';
import styles from './LoadingScreen.module.css';

/**
 * 🎨 로딩 화면 기하학적 배경 컴포넌트
 * 
 * 시각적으로 매력적인 배경 패턴을 제공하여 로딩 시간 동안
 * 사용자의 관심을 유지하고 시스템의 기술적 특성을 표현합니다.
 * 
 * 🎯 핵심 역할:
 * - 로딩 대기 시간의 지루함 완화
 * - 브랜드 아이덴티티 강화 (기술적 이미지)
 * - 시각적 계층구조에서 배경 레이어 담당
 * - 애니메이션을 통한 "시스템 동작 중" 인상 전달
 * 
 * 🔧 구현 세부사항:
 * - props가 없는 순수 표현 컴포넌트
 * - CSS 모듈을 통한 스타일 캡슐화
 * - React.CSSProperties 타입으로 타입 안전성 보장
 * - 각 패턴 요소별 고유한 회전값 적용
 * 
 * @returns 기하학적 배경 패턴 JSX 엘리먼트
 */
const GeometricBackground: React.FC = () => {
  return (
    <div className={styles.geometricBackground}>
      {/* 🔷 육각형 패턴들 - IoT 네트워크 노드를 상징하는 기하학적 요소 */}
      
      {/* 첫 번째 육각형 - 30도 회전, 주요 노드 역할 */}
      <div 
        className={`${styles.geometricShape} ${styles.hexagon1}`}
        style={{ '--rotate': '30deg' } as React.CSSProperties}
      />
      
      {/* 두 번째 육각형 - 반시계방향 15도 회전, 보조 노드 */}
      <div 
        className={`${styles.geometricShape} ${styles.hexagon2}`}
        style={{ '--rotate': '-15deg' } as React.CSSProperties}
      />
      
      {/* 세 번째 육각형 - 45도 회전, 강조 노드 */}
      <div 
        className={`${styles.geometricShape} ${styles.hexagon3}`}
        style={{ '--rotate': '45deg' } as React.CSSProperties}
      />
      
      {/* 네 번째 육각형 - 반시계방향 30도 회전, 균형 노드 */}
      <div 
        className={`${styles.geometricShape} ${styles.hexagon4}`}
        style={{ '--rotate': '-30deg' } as React.CSSProperties}
      />
      
      {/* 📏 선형 패턴들 - 데이터 흐름과 네트워크 연결선을 표현 */}
      
      {/* 첫 번째 선형 패턴 - 주요 데이터 경로 */}
      <div className={`${styles.geometricShape} ${styles.linePattern1}`} />
      
      {/* 두 번째 선형 패턴 - 보조 연결선 및 흐름 표시 */}
      <div className={`${styles.geometricShape} ${styles.linePattern2}`} />
    </div>
  );
};

export default GeometricBackground;