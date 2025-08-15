// GeometricBackground.tsx - 배경 기하학적 패턴 컴포넌트
import React from 'react';
import styles from './LoadingScreen.module.css';

const GeometricBackground: React.FC = () => {
  return (
    <div className={styles.geometricBackground}>
      {/* 육각형 모양들 */}
      <div 
        className={`${styles.geometricShape} ${styles.hexagon1}`}
        style={{ '--rotate': '30deg' } as React.CSSProperties}
      />
      <div 
        className={`${styles.geometricShape} ${styles.hexagon2}`}
        style={{ '--rotate': '-15deg' } as React.CSSProperties}
      />
      <div 
        className={`${styles.geometricShape} ${styles.hexagon3}`}
        style={{ '--rotate': '45deg' } as React.CSSProperties}
      />
      <div 
        className={`${styles.geometricShape} ${styles.hexagon4}`}
        style={{ '--rotate': '-30deg' } as React.CSSProperties}
      />
      
      {/* 선형 패턴들 */}
      <div className={`${styles.geometricShape} ${styles.linePattern1}`} />
      <div className={`${styles.geometricShape} ${styles.linePattern2}`} />
    </div>
  );
};

export default GeometricBackground;