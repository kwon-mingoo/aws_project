// RoleSelectScreen.tsx - 역할 선택 화면 컴포넌트
import React, { useState, useCallback, useEffect } from 'react';
import { Check } from 'lucide-react';
import { 
  RoleSelectState, 
  RoleType, 
  RoleOption,
  RoleSelectAPI, 
  RoleSelectUtils 
} from '../../services/RoleSelectionTypes';
import styles from './RoleSelectionScreen.module.css';

// 배경 기하학적 패턴 컴포넌트
const RoleSelectGeometricBackground: React.FC = () => (
  <div className={styles.roleSelectGeometricBackground}>
    {/* 육각형들 */}
    <div 
      className={`${styles.roleSelectGeometricShape} ${styles.roleSelectHexagon1}`}
      style={{ '--rotate': '28deg' } as React.CSSProperties}
    />
    <div 
      className={`${styles.roleSelectGeometricShape} ${styles.roleSelectHexagon2}`}
      style={{ '--rotate': '-22deg' } as React.CSSProperties}
    />
    <div 
      className={`${styles.roleSelectGeometricShape} ${styles.roleSelectHexagon3}`}
      style={{ '--rotate': '42deg' } as React.CSSProperties}
    />
    <div 
      className={`${styles.roleSelectGeometricShape} ${styles.roleSelectHexagon4}`}
      style={{ '--rotate': '-38deg' } as React.CSSProperties}
    />
    
    {/* 선형 패턴들 */}
    <div className={`${styles.roleSelectGeometricShape} ${styles.roleSelectLinePattern1}`} />
    <div className={`${styles.roleSelectGeometricShape} ${styles.roleSelectLinePattern2}`} />
  </div>
);

// 역할 카드 컴포넌트
const RoleCard: React.FC<{
  role: RoleOption;
  isSelected: boolean;
  isLoading: boolean;
  onClick: (roleType: RoleType) => void;
}> = ({ role, isSelected, isLoading, onClick }) => {
  const handleClick = useCallback(() => {
    if (!isLoading) {
      onClick(role.role);
    }
  }, [role.role, isLoading, onClick]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && !isLoading) {
      event.preventDefault();
      onClick(role.role);
    }
  }, [role.role, isLoading, onClick]);

  return (
    <div
      className={`${styles.roleSelectCard} ${styles[role.role]} ${isSelected ? styles.selected : ''} ${isLoading ? styles.loading : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyPress}
      tabIndex={0}
      role="button"
      aria-label={`${role.title} 역할 선택`}
    >
      <div className={`${styles.roleSelectAvatar} ${role.avatar ? styles.hasImage : ''}`}>
        {/* 실제 이미지가 있다면 여기에 img 태그 추가 */}
      </div>
      
      <div className={styles.roleSelectInfo}>
        <div className={styles.roleSelectRoleTitle}>{role.title}</div>
        <div className={styles.roleSelectRoleSubtitle}>{role.subtitle}</div>
      </div>
      
      {isSelected && (
        <div className={styles.roleSelectSelectedIndicator}>
          <Check size={16} />
        </div>
      )}
      
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center'
        }}>
          <div className={styles.roleSelectLoadingSpinner} />
          <span className={styles.roleSelectLoadingText}>선택 중...</span>
        </div>
      )}
    </div>
  );
};

type AppRoute = 'role' | 'dashboard' | 'chatbot' | 'history';

interface RoleSelectScreenProps {
  onRoleSelected: (role: 'admin' | 'user', redirect: AppRoute) => void;
}

const RoleSelectScreen: React.FC<RoleSelectScreenProps> = ({ onRoleSelected }) => {
  const [roleSelectState, setRoleSelectState] = useState<RoleSelectState>({
    selectedRole: null,
    isLoading: false,
    error: null,
    isTransitioning: false
  });

  const [roleOptions] = useState<RoleOption[]>(RoleSelectUtils.getRoleOptions());

  // 역할 선택 처리
  const handleRoleSelect = useCallback(async (roleType: RoleType) => {
    // 중복 클릭 방지
    if (!RoleSelectUtils.canProceedWithSelection() || roleSelectState.isLoading) {
      return;
    }

    try {
      setRoleSelectState(prev => ({
        ...prev,
        selectedRole: roleType,
        isLoading: true,
        error: null
      }));

      // API 호출 (개발 시에는 목 응답 사용)
      const response = await RoleSelectAPI.generateMockResponse(roleType);
      // 실제로는: const response = await RoleSelectAPI.selectRole(roleType);
      
      if ('success' in response && response.success) {
        // 역할 정보 세션에 저장
        RoleSelectUtils.saveSelectedRole(roleType);
        
        // 성공 애니메이션을 위한 짧은 지연
        setTimeout(() => {
          setRoleSelectState(prev => ({
            ...prev,
            isTransitioning: true
          }));
          
          // 전환 완료 콜백 호출
          setTimeout(() => {
            onRoleSelected(roleType, response.redirect as AppRoute);
          }, 300);
        }, 800);
      } else if ('success' in response && !response.success) {
        throw new Error(response.message);
      } else {
        throw new Error((response as any).error);
      }
    } catch (error) {
      console.error('역할 선택 실패:', error);
      
      setRoleSelectState(prev => ({
        ...prev,
        selectedRole: null,
        isLoading: false,
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      }));
    }
  }, [roleSelectState.isLoading, onRoleSelected]);

  // 에러 자동 제거
  useEffect(() => {
    if (roleSelectState.error) {
      const timer = setTimeout(() => {
        setRoleSelectState(prev => ({ ...prev, error: null }));
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [roleSelectState.error]);

  // 컴포넌트 마운트 시 이전 선택 정보 확인
  useEffect(() => {
    const savedRole = RoleSelectUtils.getSavedRole();
    if (savedRole) {
      console.log('이전에 선택된 역할:', savedRole);
      // 필요하다면 자동 진행 또는 표시만 할 수 있음
    }
  }, []);

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (roleSelectState.isLoading) return;
      
      if (event.key === '1' || event.key === 'a' || event.key === 'A') {
        handleRoleSelect('admin');
      } else if (event.key === '2' || event.key === 'u' || event.key === 'U') {
        handleRoleSelect('user');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [roleSelectState.isLoading, handleRoleSelect]);

  return (
    <div className={`${styles.roleSelectContainer} ${roleSelectState.isTransitioning ? styles.fadeOut : ''}`}>
      {/* 배경 기하학적 패턴 */}
      <RoleSelectGeometricBackground />
      
      {/* 상단 로고 */}
      <div className={styles.roleSelectLogo}>
        <div className={styles.roleSelectLogoText}>
          <div className={styles.roleSelectLogoMain}>AWS²</div>
          <div className={styles.roleSelectLogoAccent}>GIoT</div>
          <div className={styles.roleSelectArrowDecor}>→</div>
        </div>
        <div className={styles.roleSelectLogoSubtext}>Air Watch System</div>
      </div>
      
      {/* 메인 콘텐츠 */}
      <div className={styles.roleSelectContent}>
        <h1 className={styles.roleSelectTitle}>What's Your Role?</h1>
        
        <div className={styles.roleSelectCards}>
          {roleOptions.map((roleOption) => (
            <RoleCard
              key={roleOption.role}
              role={roleOption}
              isSelected={roleSelectState.selectedRole === roleOption.role}
              isLoading={roleSelectState.isLoading && roleSelectState.selectedRole === roleOption.role}
              onClick={handleRoleSelect}
            />
          ))}
        </div>
        
        {/* 에러 메시지 */}
        {roleSelectState.error && (
          <div className={styles.roleSelectError}>
            {roleSelectState.error}
          </div>
        )}
      </div>
      
      {/* 하단 카피라이트 */}
      <div className={styles.roleSelectCopyright}>
        2025 GBSA AWS
      </div>
    </div>
  );
};

export default RoleSelectScreen;