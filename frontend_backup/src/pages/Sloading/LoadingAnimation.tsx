// LoadingAnimation.tsx - 로딩 애니메이션 컴포넌트
import React from 'react';
import { LoadingUtils } from '../../services/LoadingTypes';
import styles from './LoadingScreen.module.css';

interface LoadingAnimationProps {
  progress: number;
}

const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ progress }) => {
  const arrowLength = LoadingUtils.getArrowLength(progress);
  const stage = LoadingUtils.getAnimationStage(progress);
  
  // 단계별 화살표 클래스 결정
  const getArrowClass = () => {
    if (progress < 25) return styles.arrowStage1;
    if (progress < 50) return styles.arrowStage2;
    if (progress < 75) return styles.arrowStage3;
    return styles.arrowStage4;
  };

  return (
    <div className={styles.arrowContainer}>
      <div 
        className={`${styles.arrow} ${getArrowClass()}`}
        style={{
          width: `${arrowLength * 2.4}px`, // 최대 240px
        }}
      >
        <div className={styles.arrowHead} />
      </div>
    </div>
  );
};

export default LoadingAnimation;