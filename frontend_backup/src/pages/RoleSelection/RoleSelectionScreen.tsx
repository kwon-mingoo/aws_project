/**
 * ═══════════════════════════════════════════════════════════════
 * 🎭 RoleSelectionScreen - 사용자 역할 선택 화면
 * ═══════════════════════════════════════════════════════════════
 * 
 * 🎯 주요 기능:
 * - 관리자(Admin)와 사용자(User) 역할 선택 인터페이스
 * - 시각적 역할 카드 UI로 직관적인 선택 경험 제공
 * - 선택 시 로딩 상태 및 피드백 애니메이션
 * - 키보드 단축키 지원 (1/A: 관리자, 2/U: 사용자)
 * - 선택된 역할 정보 세션 저장 및 관리
 * 
 * 🎨 UI/UX 특징:
 * - 기하학적 배경 패턴으로 기술적 분위기 연출
 * - 역할별 차별화된 카드 디자인 (색상, 아이콘)
 * - 선택 상태별 시각적 피드백 (체크마크, 로딩 스피너)
 * - 페이드 인/아웃 트랜지션 애니메이션
 * - 접근성 고려 (키보드 네비게이션, ARIA 라벨)
 * 
 * 🔄 상태 관리:
 * - selectedRole: 현재 선택된 역할
 * - isLoading: 역할 선택 처리 중 상태
 * - error: 에러 메시지 표시 상태
 * - isTransitioning: 화면 전환 애니메이션 상태
 * 
 * 🚀 성능 최적화:
 * - useCallback을 통한 핸들러 함수 메모이제이션
 * - 중복 클릭 방지 로직
 * - 자동 에러 제거 타이머
 * - 효율적인 키보드 이벤트 관리
 * 
 * 🔐 보안 고려사항:
 * - 역할 선택 API 호출 시 적절한 에러 처리
 * - 세션 스토리지를 통한 안전한 역할 정보 저장
 * - XSS 방지를 위한 입력값 검증
 * 
 * 📱 접근성 지원:
 * - 키보드로 카드 선택 가능
 * - 화면 리더를 위한 적절한 ARIA 라벨
 * - 고대비 색상 및 충분한 클릭 영역
 * - 포커스 관리 및 시각적 피드백
 */
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

// ========== 서브 컴포넌트 정의 ==========

/**
 * 🎨 역할 선택 화면 배경 기하학적 패턴 컴포넌트
 * 
 * AWS² GiOT 시스템의 기술적 분위기를 연출하는 배경 패턴입니다.
 * 육각형과 선형 패턴을 조합하여 IoT 네트워크의 연결성을 시각화합니다.
 * 
 * 🔧 기술적 특징:
 * - CSS 커스텀 프로퍼티를 통한 동적 회전 값 적용
 * - 위치 절대값과 z-index를 통한 레이어 관리
 * - 반투명 효과로 메인 콘텐츠 가독성 보장
 */
const RoleSelectGeometricBackground: React.FC = () => (
  <div className={styles.roleSelectGeometricBackground}>
    {/* 🔷 육각형 패턴들 - IoT 노드를 상징하는 연결된 구조 */}
    <div 
      className={`${styles.roleSelectGeometricShape} ${styles.roleSelectHexagon1}`}
      style={{ '--rotate': '28deg' } as React.CSSProperties}  // 동적 회전값
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
    
    {/* 📏 선형 패턴들 - 데이터 흐름과 네트워크 연결선을 표현 */}
    <div className={`${styles.roleSelectGeometricShape} ${styles.roleSelectLinePattern1}`} />
    <div className={`${styles.roleSelectGeometricShape} ${styles.roleSelectLinePattern2}`} />
  </div>
);

/**
 * 🎴 역할 선택 카드 컴포넌트
 * 
 * 개별 역할(관리자/사용자)을 나타내는 대화형 카드입니다.
 * 선택 상태, 로딩 상태에 따른 시각적 피드백을 제공합니다.
 * 
 * 🎯 주요 기능:
 * - 클릭/키보드를 통한 역할 선택
 * - 선택 상태 시각적 표시 (체크마크)
 * - 로딩 상태 스피너 및 텍스트
 * - 접근성을 위한 ARIA 라벨링
 * 
 * @param role - 역할 옵션 정보 (타입, 제목, 부제목 등)
 * @param isSelected - 현재 선택된 상태 여부
 * @param isLoading - 선택 처리 중 로딩 상태
 * @param onClick - 역할 선택 시 호출되는 콜백 함수
 */
const RoleCard: React.FC<{
  role: RoleOption;
  isSelected: boolean;
  isLoading: boolean;
  onClick: (roleType: RoleType) => void;
}> = ({ role, isSelected, isLoading, onClick }) => {
  
  /**
   * 🖱️ 카드 클릭 핸들러
   * 로딩 상태가 아닐 때만 역할 선택을 실행합니다.
   * useCallback으로 메모이제이션하여 불필요한 리렌더링을 방지합니다.
   */
  const handleClick = useCallback(() => {
    if (!isLoading) {
      onClick(role.role);
    }
  }, [role.role, isLoading, onClick]);

  /**
   * ⌨️ 키보드 접근성 핸들러
   * Enter 또는 Space 키로 역할을 선택할 수 있습니다.
   * 접근성 향상을 위한 키보드 네비게이션 지원입니다.
   */
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && !isLoading) {
      event.preventDefault();  // 기본 스크롤 동작 방지 (Space 키)
      onClick(role.role);
    }
  }, [role.role, isLoading, onClick]);

  return (
    <div
      className={`${styles.roleSelectCard} ${styles[role.role]} ${isSelected ? styles.selected : ''} ${isLoading ? styles.loading : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyPress}
      tabIndex={0}                          // 키보드 포커스 가능하도록 설정
      role="button"                         // 스크린 리더를 위한 역할 명시
      aria-label={`${role.title} 역할 선택`}  // 접근성 라벨
    >
      {/* 👤 역할 아바타 영역 - 향후 실제 이미지 추가 가능 */}
      <div className={`${styles.roleSelectAvatar} ${role.avatar ? styles.hasImage : ''}`}>
        {/* 🖼️ 실제 이미지가 있다면 여기에 img 태그 추가 */}
        {/* <img src={role.avatar} alt={`${role.title} 아바타`} /> */}
      </div>
      
      {/* 📝 역할 정보 텍스트 영역 */}
      <div className={styles.roleSelectInfo}>
        <div className={styles.roleSelectRoleTitle}>{role.title}</div>      {/* 역할 제목 */}
        <div className={styles.roleSelectRoleSubtitle}>{role.subtitle}</div> {/* 역할 설명 */}
      </div>
      
      {/* ✅ 선택 완료 인디케이터 - 선택된 카드에만 표시 */}
      {isSelected && (
        <div className={styles.roleSelectSelectedIndicator}>
          <Check size={16} />
        </div>
      )}
      
      {/* ⏳ 로딩 스피너 - 선택 처리 중일 때 표시 */}
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

// ========== 타입 정의 ==========

/**
 * 🧭 애플리케이션 라우트 타입
 * 역할 선택 후 이동할 수 있는 화면들을 정의합니다.
 */
type AppRoute = 'role' | 'dashboard' | 'chatbot' | 'history';

/**
 * 🎭 역할 선택 화면 Props 인터페이스
 * 부모 컴포넌트(AppRouter)와의 상호작용을 위한 콜백 함수를 정의합니다.
 */
interface RoleSelectScreenProps {
  onRoleSelected: (role: 'admin' | 'user', redirect: AppRoute) => void;  // 역할 선택 완료 콜백
}

// ========== 메인 컴포넌트 ==========

/**
 * 🎭 역할 선택 화면 메인 컴포넌트
 * 
 * 사용자가 관리자 또는 일반 사용자 역할을 선택할 수 있는 인터페이스를 제공합니다.
 * 선택 과정에서 로딩 상태, 에러 처리, 애니메이션 등을 관리합니다.
 * 
 * 🔄 상태 관리:
 * - roleSelectState: 선택된 역할, 로딩, 에러, 전환 상태
 * - roleOptions: 사용 가능한 역할 옵션 목록
 * 
 * 🎯 주요 기능:
 * - 역할 카드 클릭/키보드 선택
 * - API 호출을 통한 역할 검증
 * - 선택 정보 세션 저장
 * - 에러 처리 및 자동 복구
 * - 화면 전환 애니메이션
 * 
 * @param onRoleSelected - 역할 선택 완료 시 호출되는 콜백 함수
 */
const RoleSelectScreen: React.FC<RoleSelectScreenProps> = ({ onRoleSelected }) => {
  
  // ========== 상태 관리 ==========
  
  /**
   * 📊 역할 선택 상태 관리
   * 현재 선택된 역할, 로딩 상태, 에러 메시지, 전환 상태를 포함합니다.
   */
  const [roleSelectState, setRoleSelectState] = useState<RoleSelectState>({
    selectedRole: null,      // 현재 선택된 역할 (admin | user | null)
    isLoading: false,        // 역할 선택 처리 중 여부
    error: null,             // 에러 메시지 (있는 경우)
    isTransitioning: false   // 화면 전환 애니메이션 상태
  });

  /**
   * 🎴 역할 옵션 목록
   * RoleSelectUtils에서 제공하는 기본 역할 옵션들을 가져옵니다.
   * 관리자와 사용자 역할의 제목, 부제목, 스타일 정보를 포함합니다.
   */
  const [roleOptions] = useState<RoleOption[]>(RoleSelectUtils.getRoleOptions());

  // ========== 이벤트 핸들러 ==========

  /**
   * 🎯 역할 선택 처리 함수
   * 
   * 사용자가 역할을 선택했을 때 실행되는 메인 로직입니다.
   * API 호출, 상태 업데이트, 에러 처리, 화면 전환을 순차적으로 처리합니다.
   * 
   * 🔄 처리 과정:
   * 1. 중복 클릭 방지 체크
   * 2. 로딩 상태 시작
   * 3. API 호출 (현재는 Mock)
   * 4. 성공 시 세션 저장 및 화면 전환
   * 5. 실패 시 에러 메시지 표시
   * 
   * @param roleType - 선택된 역할 타입 ('admin' | 'user')
   */
  const handleRoleSelect = useCallback(async (roleType: RoleType) => {
    // 🚧 중복 클릭 방지 - 이미 처리 중이거나 조건이 맞지 않으면 중단
    if (!RoleSelectUtils.canProceedWithSelection() || roleSelectState.isLoading) {
      return;
    }

    try {
      // 🎬 로딩 상태 시작 - UI 피드백 제공
      setRoleSelectState(prev => ({
        ...prev,
        selectedRole: roleType,
        isLoading: true,
        error: null                // 이전 에러 메시지 초기화
      }));

      // 📞 API 호출 - 역할 선택 검증 (현재는 Mock 응답 사용)
      const response = await RoleSelectAPI.generateMockResponse(roleType);
      // 🔄 실제 환경에서는: const response = await RoleSelectAPI.selectRole(roleType);
      
      // ✅ 성공 응답 처리
      if ('success' in response && response.success) {
        // 💾 역할 정보 세션 저장 - 새로고침 후에도 유지
        RoleSelectUtils.saveSelectedRole(roleType);
        
        // 🎭 성공 애니메이션을 위한 지연 (800ms)
        setTimeout(() => {
          setRoleSelectState(prev => ({
            ...prev,
            isTransitioning: true    // 페이드 아웃 애니메이션 시작
          }));
          
          // 🚀 화면 전환 완료 후 콜백 호출 (300ms 추가 지연)
          setTimeout(() => {
            onRoleSelected(roleType, response.redirect as AppRoute);
          }, 300);
        }, 800);
        
      // ❌ API 응답 실패 처리
      } else if ('success' in response && !response.success) {
        throw new Error(response.message);
      } else {
        throw new Error((response as any).error);
      }
      
    } catch (error) {
      // 🔧 에러 로깅 및 상태 복구
      console.error('역할 선택 실패:', error);
      
      setRoleSelectState(prev => ({
        ...prev,
        selectedRole: null,      // 선택 상태 초기화
        isLoading: false,        // 로딩 종료
        error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      }));
    }
  }, [roleSelectState.isLoading, onRoleSelected]);

  // ========== 생명주기 관리 ==========

  /**
   * 🕒 에러 메시지 자동 제거 타이머
   * 에러가 발생했을 때 5초 후 자동으로 에러 메시지를 제거합니다.
   * 사용자가 계속해서 에러 메시지를 보지 않도록 UX를 개선합니다.
   */
  useEffect(() => {
    if (roleSelectState.error) {
      const timer = setTimeout(() => {
        setRoleSelectState(prev => ({ ...prev, error: null }));
      }, 5000);  // 5초 후 자동 제거
      
      return () => clearTimeout(timer);  // 컴포넌트 언마운트 시 타이머 정리
    }
  }, [roleSelectState.error]);

  /**
   * 💾 이전 선택 역할 정보 확인
   * 컴포넌트 마운트 시 세션에 저장된 이전 역할 선택 정보를 확인합니다.
   * 개발 환경에서 디버깅 정보로 활용됩니다.
   */
  useEffect(() => {
    const savedRole = RoleSelectUtils.getSavedRole();
    if (savedRole) {
      console.log('이전에 선택된 역할:', savedRole);
      // 📝 향후 개선: 자동 진행 또는 이전 선택 표시 기능 추가 가능
    }
  }, []);

  /**
   * ⌨️ 키보드 단축키 지원
   * 키보드로 빠르게 역할을 선택할 수 있는 단축키를 제공합니다.
   * - 1 또는 A: 관리자 선택
   * - 2 또는 U: 사용자 선택
   * 
   * 접근성과 사용자 편의성을 위한 기능입니다.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (roleSelectState.isLoading) return;  // 로딩 중에는 키보드 입력 무시
      
      if (event.key === '1' || event.key === 'a' || event.key === 'A') {
        handleRoleSelect('admin');
      } else if (event.key === '2' || event.key === 'u' || event.key === 'U') {
        handleRoleSelect('user');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [roleSelectState.isLoading, handleRoleSelect]);

  // ========== JSX 렌더링 ==========

  return (
    <div className={`${styles.roleSelectContainer} ${roleSelectState.isTransitioning ? styles.fadeOut : ''}`}>
      {/* 🎨 배경 기하학적 패턴 */}
      <RoleSelectGeometricBackground />
      
      {/* 🏢 상단 로고 영역 - AWS² GiOT 브랜딩 */}
      <div className={styles.roleSelectLogo}>
        <div className={styles.roleSelectLogoText}>
          <div className={styles.roleSelectLogoMain}>AWS²</div>        {/* AWS 제곱 */}
          <div className={styles.roleSelectLogoAccent}>GIoT</div>      {/* Green IoT */}
          <div className={styles.roleSelectArrowDecor}>→</div>         {/* 방향 화살표 */}
        </div>
        <div className={styles.roleSelectLogoSubtext}>Air Watch System</div>
      </div>
      
      {/* 🎭 메인 콘텐츠 영역 */}
      <div className={styles.roleSelectContent}>
        {/* 📝 화면 제목 */}
        <h1 className={styles.roleSelectTitle}>What's Your Role?</h1>
        
        {/* 🎴 역할 선택 카드들 */}
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
        
        {/* ❌ 에러 메시지 표시 영역 */}
        {roleSelectState.error && (
          <div className={styles.roleSelectError}>
            {roleSelectState.error}
          </div>
        )}
      </div>
      
      {/* 📜 하단 카피라이트 */}
      <div className={styles.roleSelectCopyright}>
        2025 GBSA AWS
      </div>
    </div>
  );
};

export default RoleSelectScreen;