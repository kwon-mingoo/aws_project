// LoadingScreen.tsx - 메인 로딩 화면 컴포넌트
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

interface LoadingScreenProps {
  onLoadingComplete: (redirectPath: string) => void;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ onLoadingComplete }) => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
  isLoading: true,
  isReady: false,
  progress: 0,
  error: null,
  showRetryButton: false,
  message: '',          
});


  // 진행률 증가 애니메이션
  const startProgressAnimation = useCallback(() => {
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 8 + 2; // 2-10씩 증가
      
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(progressInterval);
      }
      
      setLoadingState(prev => ({
        ...prev,
        progress: currentProgress
      }));
    }, 150); // 150ms마다 업데이트

    return progressInterval;
  }, []);

  // 초기화 로직
  const initializeApp = useCallback(async () => {
    try {
      setLoadingState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        showRetryButton: false
      }));

      // 진행률 애니메이션 시작
      const progressInterval = startProgressAnimation();

      // API 호출 (개발 시에는 목 데이터 사용)
      const response = await LoadingAPI.generateMockResponse(); // 실제로는 LoadingAPI.initializeApp() 사용
      
      // 타입 가드로 응답 확인
      if ('isReady' in response) {
        const loadingResponse = response as LoadingResponse;
        
        if (loadingResponse.isReady) {
          // 진행률 100% 완료 대기
          const waitForProgress = () => {
            if (loadingState.progress >= 100) {
              setTimeout(() => {
                onLoadingComplete(loadingResponse.redirect);
              }, 500); // 완료 후 0.5초 대기
            } else {
              setTimeout(waitForProgress, 100);
            }
          };
          waitForProgress();
        } else {
          // 3초 후 강제 전환
          setTimeout(() => {
            onLoadingComplete(loadingResponse.redirect);
          }, loadingResponse.delay);
        }
        
        setLoadingState(prev => ({
          ...prev,
          isReady: loadingResponse.isReady
        }));
      } else {
        // 에러 응답 처리
        const errorResponse = response as LoadingError;
        throw new Error(errorResponse.message);
      }

      // 진행률 애니메이션 정리
      clearInterval(progressInterval);
      
    } catch (error) {
      console.error('로딩 초기화 실패:', error);
      
      setLoadingState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        showRetryButton: true
      }));
    }
  }, [onLoadingComplete, startProgressAnimation, loadingState.progress]);

  // 재시도 핸들러
  const handleRetry = useCallback(() => {
    setLoadingState({
      isLoading: true,
      isReady: false,
      progress: 0,
      error: null,
      showRetryButton: false,
      message: '',
    });
    initializeApp();
  }, [initializeApp]);

  // 5초 타임아웃 처리
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
    }, 5000);

    return () => clearTimeout(timeoutId);
  }, [loadingState.isLoading, loadingState.isReady]);

  // 컴포넌트 마운트 시 초기화 시작
  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // 3초 강제 전환 타이머
  useEffect(() => {
    const fallbackTimeout = setTimeout(() => {
      if (loadingState.isLoading) {
        onLoadingComplete('/main');
      }
    }, 3000);

    return () => clearTimeout(fallbackTimeout);
  }, [onLoadingComplete, loadingState.isLoading]);

  return (
    <div className={styles.loadingContainer}>
      {/* 배경 기하학적 패턴 */}
      <GeometricBackground />
      
      {/* 메인 로딩 콘텐츠 */}
      {loadingState.error ? (
        // 에러 상태
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
        // 정상 로딩 상태
        <>
          <div className={styles.logoContainer}>
            <div className={styles.logoText}>
              <div className={styles.logoMain}>AWS²</div>
              <div className={styles.logoAccent}>GIoT</div>
            </div>
            <div className={styles.logoSubtext}>Air Watch System</div>
          </div>
          
          <LoadingAnimation progress={loadingState.progress} />
          
          <div className={styles.loadingText}>
            시스템을 초기화하고 있습니다...
          </div>
        </>
      )}
      
      {/* 하단 카피라이트 */}
      <div className={styles.copyright}>
        2025 GBSA AWS
      </div>
    </div>
  );
};

export default LoadingScreen;