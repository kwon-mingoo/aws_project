/**
 * ═══════════════════════════════════════════════════════════════
 * ⏳ LoadingScreen - 애플리케이션 초기화 로딩 화면
 * ═══════════════════════════════════════════════════════════════
 * 
 * 🎯 주요 기능:
 * - 애플리케이션 시작 시 시스템 초기화 과정 표시
 * - 실시간 진행률 애니메이션으로 로딩 상태 시각화
 * - 비동기 초기화 작업 관리 및 완료 시 자동 전환
 * - 에러 발생 시 재시도 옵션 제공
 * - 타임아웃 및 폴백 메커니즘으로 안정성 보장
 * 
 * 🔄 로딩 프로세스:
 * 1. 컴포넌트 마운트 시 초기화 시작
 * 2. 진행률 애니메이션 시작 (0% → 100%)
 * 3. LoadingAPI를 통한 시스템 준비 상태 확인
 * 4. 완료 시 onLoadingComplete 콜백 호출
 * 5. 에러 시 재시도 UI 표시
 * 
 * 🛡️ 안정성 메커니즘:
 * - 5초 타임아웃으로 무한 로딩 방지
 * - 3초 폴백 타이머로 강제 전환 보장
 * - API 에러 시 재시도 버튼 제공
 * - 진행률 애니메이션의 독립적 관리
 * 
 * 🎨 UI/UX 특징:
 * - AWS² GiOT 브랜딩 로고 표시
 * - GeometricBackground로 기술적 분위기 연출
 * - LoadingAnimation으로 동적 진행률 표시
 * - 에러 상태와 정상 상태의 명확한 구분
 * - 사용자 피드백을 위한 메시지 표시
 * 
 * 🚀 성능 최적화:
 * - useCallback으로 함수 메모이제이션
 * - 타이머 정리로 메모리 누수 방지
 * - 조건부 렌더링으로 불필요한 DOM 최소화
 * - API 호출 최적화 및 에러 핸들링
 * 
 * 🔧 기술 스택:
 * - React Hooks (useState, useEffect, useCallback)
 * - TypeScript로 타입 안전성 보장
 * - LoadingTypes 서비스와 연동
 * - CSS Modules 스타일링
 * - 비동기 처리 및 상태 관리
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  LoadingState, 
  LoadingAPI, 
  LoadingUtils,
  LoadingResponse,
  LoadingError
} from '../../services/LoadingTypes';
import LoadingAnimation from './LoadingAnimation';
import GeometricBackground from './GeometricBackground';
import styles from './LoadingScreen.module.css';

// ========== 타입 정의 ==========

/**
 * 🎭 로딩 화면 컴포넌트 Props 인터페이스
 * 
 * 부모 컴포넌트(주로 AppRouter)와의 상호작용을 위한 콜백 함수를 정의합니다.
 * 로딩 완료 시 어느 화면으로 이동할지 결정하는 리다이렉트 경로를 전달합니다.
 */
interface LoadingScreenProps {
  onLoadingComplete: (redirectPath: string) => void;    // 로딩 완료 시 호출되는 콜백 함수
}

// ========== 메인 컴포넌트 ==========

/**
 * ⏳ 애플리케이션 초기화 로딩 화면 메인 컴포넌트
 * 
 * 시스템 시작 시 사용자에게 로딩 상태를 시각적으로 표시하고,
 * 백그라운드에서 필요한 초기화 작업을 수행한 후 적절한 화면으로 이동시킵니다.
 * 
 * 🎯 핵심 역할:
 * - 사용자 대기 경험 개선 (지루함 방지)
 * - 시스템 초기화 상태 실시간 표시
 * - 에러 발생 시 복구 옵션 제공
 * - 안정적인 앱 시작 환경 보장
 * 
 * 🔄 상태 관리:
 * - loadingState: 로딩 진행률, 에러, 완료 상태
 * - 타이머: 진행률 애니메이션, 타임아웃, 폴백
 * - API 응답: 초기화 결과 및 리다이렉트 정보
 * 
 * @param onLoadingComplete - 로딩 완료 시 호출될 콜백 함수
 */
const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoadingComplete }) => {
  
  // ========== 상태 관리 ==========
  
  /**
   * 📊 로딩 상태 통합 관리
   * 
   * 로딩 화면의 모든 상태를 하나의 객체로 관리하여 일관성을 보장합니다.
   * 각 속성은 UI의 다른 부분을 제어하는 데 사용됩니다.
   */
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: true,        // 현재 로딩 중인지 여부
    isReady: false,         // 시스템 준비 완료 여부
    progress: 0,            // 진행률 (0-100)
    error: null,            // 에러 메시지 (있는 경우)
    showRetryButton: false, // 재시도 버튼 표시 여부
    message: '',            // 사용자에게 표시할 메시지
  });

  // ========== 핵심 로직 함수들 ==========

  /**
   * 📈 진행률 증가 애니메이션 관리 함수
   * 
   * 시각적 피드백을 위한 진행률 애니메이션을 관리합니다.
   * 실제 API 호출과는 독립적으로 동작하여 사용자 경험을 개선합니다.
   * 
   * 🎯 애니메이션 특징:
   * - 랜덤한 증가량 (2-10씩)으로 자연스러운 진행
   * - 150ms 간격으로 부드러운 업데이트
   * - 100% 도달 시 자동 정지
   * - 메모리 누수 방지를 위한 타이머 반환
   * 
   * @returns 진행률 애니메이션 타이머 (정리용)
   */
  const startProgressAnimation = useCallback(() => {
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 8 + 2;    // 2-10씩 랜덤 증가
      
      if (currentProgress >= 100) {
        currentProgress = 100;                     // 100% 상한선 설정
        clearInterval(progressInterval);           // 애니메이션 종료
      }
      
      // 🎨 진행률 상태 업데이트
      setLoadingState(prev => ({
        ...prev,
        progress: currentProgress
      }));
    }, 150);    // 150ms마다 업데이트 (부드러운 애니메이션)

    return progressInterval;    // 타이머 정리를 위해 반환
  }, []);

  /**
   * 🚀 애플리케이션 초기화 메인 로직
   * 
   * 시스템 시작에 필요한 모든 초기화 작업을 수행합니다.
   * API 호출, 진행률 애니메이션, 에러 처리를 통합 관리합니다.
   * 
   * 🔄 초기화 과정:
   * 1. 로딩 상태 초기화 및 진행률 애니메이션 시작
   * 2. LoadingAPI를 통한 시스템 준비 상태 확인
   * 3. 응답에 따른 처리 (성공/실패)
   * 4. 완료 시 적절한 화면으로 리다이렉트
   * 5. 에러 시 재시도 UI 표시
   * 
   * 🛡️ 에러 처리:
   * - API 호출 실패 시 에러 메시지 표시
   * - 재시도 버튼 활성화
   * - 로딩 상태 적절히 초기화
   * - 타이머 정리로 메모리 누수 방지
   */
  const initializeApp = useCallback(async () => {
    try {
      // 🎬 로딩 시작 - UI 상태 초기화
      setLoadingState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        showRetryButton: false
      }));

      // 📈 진행률 애니메이션 시작
      const progressInterval = startProgressAnimation();

      // 📞 API 호출 - 시스템 초기화 상태 확인
      // 🔄 현재는 Mock 응답 사용, 실제 환경에서는 LoadingAPI.initializeApp() 사용
      const response = await LoadingAPI.generateMockResponse();
      
      // 🔍 응답 타입 가드 - 성공/실패 응답 구분
      if ('isReady' in response) {
        const loadingResponse = response as LoadingResponse;
        
        if (loadingResponse.isReady) {
          // ✅ 시스템 준비 완료 - 진행률 100% 대기 후 전환
          const waitForProgress = () => {
            if (loadingState.progress >= 100) {
              setTimeout(() => {
                onLoadingComplete(loadingResponse.redirect);
              }, 500);    // 완료 후 0.5초 대기 (시각적 완료감)
            } else {
              setTimeout(waitForProgress, 100);    // 진행률 체크 반복
            }
          };
          waitForProgress();
        } else {
          // ⏰ 시스템 준비 중 - 지정된 지연 시간 후 강제 전환
          setTimeout(() => {
            onLoadingComplete(loadingResponse.redirect);
          }, loadingResponse.delay);
        }
        
        // 📊 시스템 준비 상태 업데이트
        setLoadingState(prev => ({
          ...prev,
          isReady: loadingResponse.isReady
        }));
      } else {
        // ❌ 에러 응답 처리
        const errorResponse = response as LoadingError;
        throw new Error(errorResponse.message);
      }

      // 🧹 진행률 애니메이션 정리
      clearInterval(progressInterval);
      
    } catch (error) {
      // 🔧 에러 로깅 및 상태 복구
      console.error('로딩 초기화 실패:', error);
      
      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        showRetryButton: true
      }));
    }
  }, [onLoadingComplete, startProgressAnimation, loadingState.progress]);

  /**
   * 🔄 재시도 핸들러
   * 
   * 에러 발생 시 사용자가 재시도 버튼을 클릭했을 때 실행됩니다.
   * 모든 상태를 초기화하고 다시 초기화 과정을 시작합니다.
   * 
   * 🎯 재시도 과정:
   * 1. 모든 상태를 초기값으로 리셋
   * 2. 에러 메시지 및 재시도 버튼 숨김
   * 3. 초기화 로직 재실행
   */
  const handleRetry = useCallback(() => {
    setLoadingState({
      isLoading: true,
      isReady: false,
      progress: 0,
      error: null,
      showRetryButton: false,
      message: '',
    });
    initializeApp();    // 초기화 다시 시작
  }, [initializeApp]);

  // ========== 생명주기 관리 ==========

  /**
   * ⏰ 5초 타임아웃 보호 메커니즘
   * 
   * 로딩이 5초 이상 지속될 경우 자동으로 에러 상태로 전환하여
   * 사용자가 무한 대기하지 않도록 보호합니다.
   * 
   * 🛡️ 보호 로직:
   * - 로딩 중이면서 준비되지 않은 상태가 5초 지속
   * - 자동으로 에러 메시지 표시 및 재시도 버튼 활성화
   * - 컴포넌트 언마운트 시 타이머 정리
   */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (loadingState.isLoading && !loadingState.isReady) {
        setLoadingState(prev => ({
          ...prev,
          isLoading: false,
          error: '로딩이 지연되고 있어요. 다시 시도해 주세요.',
          showRetryButton: true
        }));
      }
    }, 5000);    // 5초 타임아웃

    return () => clearTimeout(timeoutId);    // 클린업
  }, [loadingState.isLoading, loadingState.isReady]);

  /**
   * 🎬 컴포넌트 마운트 시 초기화 시작
   * 
   * 컴포넌트가 화면에 표시되자마자 즉시 초기화 과정을 시작합니다.
   * 사용자가 기다림 없이 바로 로딩 상태를 확인할 수 있습니다.
   */
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  /**
   * 🚨 3초 폴백 강제 전환 메커니즘
   * 
   * 모든 것이 실패했을 경우의 최후 보루로,
   * 3초 후에는 무조건 메인 화면으로 이동시킵니다.
   * 
   * 🛡️ 최종 안전망:
   * - API 실패, 타임아웃 등 모든 상황 커버
   * - 사용자가 앱을 사용할 수 없는 상황 방지
   * - 최소한의 기본 기능 보장
   */
  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      if (loadingState.isLoading) {
        onLoadingComplete('/main');    // 메인 화면으로 강제 전환
      }
    }, 3000);    // 3초 폴백

    return () => clearTimeout(fallbackTimeout);    // 클린업
  }, [onLoadingComplete, loadingState.isLoading]);

  // ========== JSX 렌더링 ==========

  return (
    <div className={styles.loadingContainer}>
      {/* 🎨 배경 기하학적 패턴 - 기술적 분위기 연출 */}
      <GeometricBackground />
      
      {/* 🎭 메인 로딩 콘텐츠 - 에러/정상 상태 조건부 렌더링 */}
      {loadingState.error ? (
        // ❌ 에러 상태 - 에러 메시지 및 재시도 옵션
        <div className={styles.errorContainer}>
          <div className={styles.errorTitle}>로딩 실패</div>
          <div className={styles.errorMessage}>{loadingState.error}</div>
          {loadingState.showRetryButton && (
            <button 
              className={styles.retryButton}
              onClick={handleRetry}
            >
              다시 시도
            </button>
          )}
        </div>
      ) : (
        // ✅ 정상 로딩 상태 - 로고, 애니메이션, 상태 메시지
        <>
          {/* 🏢 AWS² GiOT 로고 섹션 */}
          <div className={styles.logoContainer}>
            <div className={styles.logoText}>
              <div className={styles.logoMain}>AWS²</div>        {/* AWS 제곱 */}
              <div className={styles.logoAccent}>GIoT</div>      {/* Green IoT */}
            </div>
            <div className={styles.logoSubtext}>Air Watch System</div>
          </div>
          
          {/* ⚡ 동적 로딩 애니메이션 - 진행률 기반 화살표 */}
          <LoadingAnimation progress={loadingState.progress} />
          
          {/* 💬 로딩 상태 메시지 */}
          <div className={styles.loadingText}>
            시스템을 초기화하고 있습니다...
          </div>
        </>
      )}
      
      {/* 📜 하단 카피라이트 정보 */}
      <div className={styles.copyright}>
        2025 GBSA AWS
      </div>
    </div>
  );
};

export default LoadingScreen;