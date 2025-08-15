// TransitionScreen.tsx - 전환 로딩 화면 컴포넌트
import React, { useState, useEffect, useCallback } from 'react';
import { 
  TransitionState, 
  TransitionAPI, 
  TransitionUtils,
  TransitionResponse,
  TransitionError
} from '../../services/TransitionTypes';
import styles from './TransitionScreen.module.css';

interface TransitionScreenProps {
  targetRole?: 'admin' | 'user';
  onTransitionComplete: () => void;
}

// 배경 기하학적 패턴 컴포넌트
const TransitionGeometricBackground: React.FC = () => (
  <div className={styles.transitionGeometricBackground}>
    {/* 육각형들 */}
    <div 
      className={`${styles.transitionGeometricShape} ${styles.transitionHexagon1}`}
      style={{ '--rotate': '25deg' } as React.CSSProperties}
    />
    <div 
      className={`${styles.transitionGeometricShape} ${styles.transitionHexagon2}`}
      style={{ '--rotate': '-20deg' } as React.CSSProperties}
    />
    <div 
      className={`${styles.transitionGeometricShape} ${styles.transitionHexagon3}`}
      style={{ '--rotate': '40deg' } as React.CSSProperties}
    />
    <div 
      className={`${styles.transitionGeometricShape} ${styles.transitionHexagon4}`}
      style={{ '--rotate': '-35deg' } as React.CSSProperties}
    />
    <div 
      className={`${styles.transitionGeometricShape} ${styles.transitionCenterHexagon}`}
      style={{ '--rotate': '0deg' } as React.CSSProperties}
    />
    
    {/* 선형 패턴들 */}
    <div className={`${styles.transitionGeometricShape} ${styles.transitionLinePattern1}`} />
    <div className={`${styles.transitionGeometricShape} ${styles.transitionLinePattern2}`} />
  </div>
);

const TransitionScreen: React.FC<TransitionScreenProps> = ({ 
  targetRole = 'admin', 
  onTransitionComplete 
}) => {
  const [transitionState, setTransitionState] = useState<TransitionState>({
    isTransitioning: true,
    isLoading: true,
    isReady: false,
    progress: 0,
    arrowOpacity: 0.4,
    targetRole,
    error: null,
    showRetryButton: false,
    nextPage: '/dashboard'
  });

  const [isFadingOut, setIsFadingOut] = useState(false);

  // 진행률 증가 애니메이션
  const startProgressAnimation = useCallback(() => {
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 12 + 8; // 8-20씩 증가 (빠른 전환)
      
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(progressInterval);
      }
      
      const arrowOpacity = TransitionUtils.calculateArrowOpacity(currentProgress);
      
      setTransitionState(prev => ({
        ...prev,
        progress: currentProgress,
        arrowOpacity
      }));
    }, 120); // 120ms마다 업데이트 (빠른 애니메이션)

    return progressInterval;
  }, []);

  // 전환 초기화
  const initializeTransition = useCallback(async () => {
    try {
      // 중복 실행 방지 체크
      if (TransitionUtils.checkTransitionFlag()) {
        console.log('전환이 이미 진행 중입니다.');
        return;
      }

      // 전환 플래그 설정
      TransitionUtils.setTransitionFlag();

      setTransitionState(prev => ({
        ...prev,
        isTransitioning: true,
        error: null,
        showRetryButton: false
      }));

      // 진행률 애니메이션 시작
      const progressInterval = startProgressAnimation();

      // API 호출 (개발 시에는 목 데이터 사용)
      const response = await TransitionAPI.generateMockResponse(targetRole); // 실제로는 TransitionAPI.prepareTransition(targetRole) 사용
      
      // 타입 가드로 응답 확인
      if ('status' in response) {
        const transitionResponse = response as TransitionResponse;
        
        if (transitionResponse.status === 'transition_ready') {
          setTransitionState(prev => ({
            ...prev,
            nextPage: transitionResponse.nextPage
          }));

          // 진행률 100% 완료까지 대기
          const checkProgress = () => {
            setTransitionState(current => {
              if (current.progress >= 100) {
                // 완료 후 잠시 대기 후 전환
                setTimeout(() => {
                  handleTransitionComplete();
                }, 300);
                return current;
              }
              // 아직 100%가 아니면 다시 체크
              setTimeout(checkProgress, 100);
              return current;
            });
          };
          checkProgress();
        }
      } else {
        // 에러 응답 처리
        const errorResponse = response as TransitionError;
        throw new Error(errorResponse.message);
      }

      // 진행률 애니메이션 정리
      clearInterval(progressInterval);
      
    } catch (error) {
      console.error('전환 초기화 실패:', error);
      
      setTransitionState(prev => ({
        ...prev,
        isTransitioning: false,
        error: error instanceof Error ? error.message : '전환 중 문제가 발생했습니다.',
        showRetryButton: true
      }));

      // 전환 플래그 초기화
      TransitionUtils.clearTransitionFlag();
    }
  }, [targetRole, startProgressAnimation]);

  // 전환 완료 처리
  const handleTransitionComplete = useCallback(() => {
    setIsFadingOut(true);
    
    // 페이드 아웃 애니메이션 후 전환
    setTimeout(() => {
      TransitionUtils.clearTransitionFlag();
      onTransitionComplete();
    }, 800);
  }, [onTransitionComplete]);

  // 재시도 핸들러
  const handleRetry = useCallback(() => {
    TransitionUtils.clearTransitionFlag();
    setTransitionState({
      isTransitioning: true,
      isLoading: true,
      isReady: false,
      progress: 0,
      arrowOpacity: 0.4,
      targetRole,
      error: null,
      showRetryButton: false,
      nextPage: '/dashboard'
    });
    initializeTransition();
  }, [targetRole, initializeTransition]);

  // 컴포넌트 마운트 시 초기화 시작
  useEffect(() => {
    initializeTransition();
  }, [initializeTransition]);

  // 5초 타임아웃 처리
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (transitionState.isTransitioning && !transitionState.error) {
        setTransitionState(prev => ({
          ...prev,
          isTransitioning: false,
          error: '전환 중 문제가 발생했습니다. 다시 시도해주세요.',
          showRetryButton: true
        }));
        TransitionUtils.clearTransitionFlag();
      }
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [transitionState.isTransitioning, transitionState.error]);

  // 2초 강제 전환 타이머
  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      if (transitionState.isTransitioning && !transitionState.error) {
        handleTransitionComplete();
      }
    }, 2000);

    return () => clearTimeout(fallbackTimeout);
  }, [transitionState.isTransitioning, transitionState.error, handleTransitionComplete]);

  // 애니메이션 단계 계산
  const animationStage = TransitionUtils.getAnimationStage(transitionState.progress);
  const arrowStageClass = styles[`transitionArrowStage${
    animationStage === 'start' ? '1' : 
    animationStage === 'middle' ? '2' : 
    animationStage === 'intense' ? '3' : 'Complete'
  }`];

  // 진행률에 따른 상태 메시지
  const getStatusMessage = () => {
    if (transitionState.progress < 30) {
      return '권한을 확인하고 있습니다...';
    } else if (transitionState.progress < 60) {
      return '리소스를 로딩하고 있습니다...';
    } else if (transitionState.progress < 90) {
      return '초기화를 완료하고 있습니다...';
    } else {
      return '준비가 완료되었습니다!';
    }
  };

  return (
    <div className={`${styles.transitionContainer} ${isFadingOut ? styles.fadeOut : ''}`}>
      {/* 배경 기하학적 패턴 */}
      <TransitionGeometricBackground />
      
      {/* 메인 전환 콘텐츠 */}
      {transitionState.error ? (
        // 에러 상태
        <div className={styles.transitionErrorContainer}>
          <div className={styles.transitionErrorTitle}>전환 실패</div>
          <div className={styles.transitionErrorMessage}>{transitionState.error}</div>
          {transitionState.showRetryButton && (
            <button 
              className={styles.transitionRetryButton}
              onClick={handleRetry}
            >
              다시 시도
            </button>
          )}
        </div>
      ) : (
        // 정상 전환 상태
        <>
          <div className={styles.transitionLogoContainer}>
            <div className={styles.transitionLogoText}>
              <div className={styles.transitionLogoMain}>AWS²</div>
              <div className={styles.transitionLogoAccent}>GIoT</div>
            </div>
            <div className={styles.transitionLogoSubtext}>Air Watch System</div>
          </div>
          
          {/* 점점 선명해지는 화살표 */}
          <div className={`${styles.transitionArrowContainer} ${arrowStageClass}`}>
            <div 
              className={styles.transitionArrow}
              style={{ opacity: transitionState.arrowOpacity }}
            >
              <div 
                className={styles.transitionArrowHead}
                style={{ opacity: transitionState.arrowOpacity }}
              />
            </div>
          </div>
          
          {/* 상태 메시지 */}
          <div className={styles.transitionStatusContainer}>
            <div className={styles.transitionStatusText}>
              {getStatusMessage()}
            </div>
            <div className={styles.transitionProgressText}>
              {Math.round(transitionState.progress)}% 완료
            </div>
          </div>
        </>
      )}
      
      {/* 하단 카피라이트 */}
      <div className={styles.transitionCopyright}>
        2025 GBSA AWS
      </div>
    </div>
  );
};

export default TransitionScreen;