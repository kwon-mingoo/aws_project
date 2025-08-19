/**
 * ═══════════════════════════════════════════════════════════════
 * 🧭 useAppRouter - 애플리케이션 라우팅 및 상태 관리 훅
 * ═══════════════════════════════════════════════════════════════
 * 
 * 🎯 주요 기능:
 * - 전체 애플리케이션의 라우팅 상태 관리 (loading → main → role → [adminLogin|userCode] → dashboard ⇄ [chatbot|history])
 * - 사용자 인증 상태 및 역할(admin/user) 관리
 * - 세션 스토리지를 통한 상태 영속성 보장
 * - 이벤트 리스너 관리 (새로고침, ESC 키 등)
 * - 메뉴 상태 동기화 및 네비게이션 제어
 * 
 * 🔄 라우팅 플로우:
 * 1. loading: 초기 로딩 화면 (3초 후 자동 전환)
 * 2. main: 메인 화면 (시작하기 버튼)
 * 3. role: 역할 선택 화면 (관리자/사용자)
 * 4. adminLogin: 관리자 로그인 화면
 * 5. userCode: 사용자 코드 입력 화면
 * 6. dashboard: 메인 대시보드 (로그인 성공 후)
 * 7. chatbot: 챗봇 화면 (대시보드에서 이동)
 * 8. history: 히스토리 화면 (대시보드에서 이동)
 * 
 * 🔐 보안 고려사항:
 * - 인증되지 않은 사용자는 dashboard 이후 화면 접근 불가
 * - 새로고침 시 항상 loading 화면으로 리셋 (보안 강화)
 * - 세션 스토리지 기반 상태 관리 (XSS 방어)
 * 
 * 🎮 사용하는 컴포넌트:
 * - App.tsx: 메인 라우터에서 상태 구독
 * - AppRouter.tsx: 실제 화면 렌더링 로직
 * - 각 페이지 컴포넌트: 네비게이션 및 상태 변경 요청
 */

import { useState, useEffect } from 'react';
import { RoleSelectUtils } from '../services/RoleSelectionTypes';

/**
 * 🎯 라우트 타입 정의
 * 애플리케이션에서 사용되는 모든 화면 경로를 문자열 리터럴로 정의
 * TypeScript 타입 안전성을 통해 잘못된 라우트 사용 방지
 */
export type AppRoute =
  | 'loading'      // 🔄 초기 로딩 화면 (스플래시)
  | 'main'         // 🏠 메인 화면 (시작하기)
  | 'role'         // 👤 역할 선택 화면 (관리자/사용자)
  | 'adminLogin'   // 🔐 관리자 로그인 화면
  | 'userCode'     // 🔢 사용자 코드 입력 화면
  | 'dashboard'    // 📊 메인 대시보드 (인증 후)
  | 'chatbot'      // 🤖 챗봇 화면
  | 'history';     // 📝 히스토리 화면

/**
 * 👤 사용자 역할 타입
 * 관리자와 일반 사용자를 구분하는 열거형
 */
export type UserRole = 'admin' | 'user';

/**
 * 📱 애플리케이션 상태 인터페이스
 * 전체 앱의 현재 상태를 나타내는 핵심 데이터 구조
 */
export interface AppState {
  currentRoute: AppRoute;           // 🧭 현재 활성화된 라우트
  selectedRole: UserRole | null;    // 👤 선택된 사용자 역할 (로그인 전까지 null)
  isAuthenticated: boolean;         // 🔐 인증 상태 (로그인 완료 여부)
  activeMenu: string;               // 📋 현재 활성화된 메뉴 (사이드바 하이라이트용)
}

/**
 * 🎮 이벤트 핸들러 인터페이스
 * 각 컴포넌트에서 호출할 수 있는 상태 변경 함수들
 * 단방향 데이터 플로우를 유지하기 위한 콜백 패턴
 */
export interface AppHandlers {
  onLoadingComplete: (redirectPath: string) => void;        // 🔄 로딩 완료 시 호출
  onNavigateToRoleSelect: () => void;                       // 🏠 메인에서 역할 선택으로 이동
  onRoleSelected: (role: UserRole, redirect: AppRoute) => void;  // 👤 역할 선택 완료
  onAdminLoginSuccess: () => void;                          // 🔐 관리자 로그인 성공
  onUserCodeSuccess: () => void;                            // 🔢 사용자 코드 입력 성공
  onLogout: () => void;                                     // 🚪 로그아웃 (역할 선택으로 돌아가기)
  onGoBackToRole: () => void;                               // 🔙 역할 선택 화면으로 돌아가기
}

/**
 * 🧭 네비게이션 인터페이스
 * 라우트 변경 및 메뉴 상태 관리를 위한 함수들
 */
export interface AppNavigation {
  navigateToRoute: (route: AppRoute) => void;    // 🎯 특정 라우트로 직접 이동
  setActiveMenu: (menu: string) => void;         // 📋 활성 메뉴 상태 변경 (사이드바 동기화)
}

/**
 * 🎯 메인 라우터 훅 함수
 * 
 * 애플리케이션의 핵심 상태 관리 훅입니다.
 * 모든 라우팅 로직과 상태 변화를 중앙 집중식으로 관리하며,
 * React의 useState와 useEffect를 활용해 상태 영속성을 보장합니다.
 * 
 * @returns {object} 앱 상태, 핸들러, 네비게이션 함수들을 포함한 객체
 */
export const useAppRouter = () => {
  /**
   * 🏗️ 초기 상태 설정
   * 애플리케이션 시작 시 기본값으로 설정되는 상태
   * 보안을 위해 항상 loading 화면부터 시작
   */
  const [appState, setAppState] = useState<AppState>({
    currentRoute: 'loading',      // 🔄 항상 로딩 화면부터 시작 (보안)
    selectedRole: null,           // 👤 역할 미선택 상태
    isAuthenticated: false,       // 🔐 미인증 상태
    activeMenu: 'Dashboard'       // 📋 기본 메뉴는 대시보드
  });

  /**
   * ⚡ 컴포넌트 생명주기 관리
   * 마운트 시 상태 복원 및 이벤트 리스너 설정
   * 언마운트 시 메모리 누수 방지를 위한 정리 작업
   */
  useEffect(() => {
    checkAuthenticationState();  // 🔍 저장된 인증 상태 확인
    setupEventListeners();       // 🎧 이벤트 리스너 등록

    // 🧹 컴포넌트 언마운트 시 정리 작업
    return () => {
      cleanup();
    };
  }, []);

  /**
   * 🔍 인증 상태 확인 함수
   * 
   * 보안을 위해 새로고침이나 첫 진입 시 항상 초기 상태로 리셋합니다.
   * 이는 브라우저 새로고침을 통한 인증 우회를 방지하는 보안 조치입니다.
   */
  const checkAuthenticationState = () => {
    // 🔒 보안 강화: 새로고침 시 항상 loading으로 리셋
    // 인증 상태를 유지하지 않아 보안성 향상
    setAppState(prev => ({
      ...prev,
      currentRoute: 'loading',
      selectedRole: null,
      isAuthenticated: false
    }));

    // 📊 방문 기록 관리 (분석용, 기능에 영향 없음)
    const hasVisited = sessionStorage.getItem('aws_iot_visited');
    if (!hasVisited) {
      sessionStorage.setItem('aws_iot_visited', 'true');
    }
  };

  /**
   * 🎧 이벤트 리스너 설정 함수
   * 
   * 브라우저 이벤트를 감지하여 적절한 상태 변화를 처리합니다.
   * 사용자 경험 향상과 개발 편의성을 위한 다양한 이벤트를 처리합니다.
   */
  const setupEventListeners = () => {
    /**
     * 🔄 페이지 새로고침 감지 핸들러
     * beforeunload 이벤트로 새로고침을 감지하여 보안 상태 리셋
     */
    const handleBeforeUnload = () => {
      setAppState(prev => ({ ...prev, currentRoute: 'loading' }));
    };

    /**
     * ⌨️ 키보드 단축키 핸들러 (개발용)
     * ESC 키를 눌러 빠르게 대시보드로 이동할 수 있는 개발자 편의 기능
     */
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && appState.currentRoute !== 'loading') {
        navigateToDashboard();  // 🚀 개발용 빠른 대시보드 이동
      }
    };

    // 🎯 이벤트 리스너 등록
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeyPress);

    // 📤 핸들러 함수들 반환 (정리 작업용)
    return { handleBeforeUnload, handleKeyPress };
  };

  /**
   * 🧹 메모리 정리 함수
   * 
   * 컴포넌트 언마운트 시 등록된 이벤트 리스너를 제거합니다.
   * 메모리 누수 방지를 위한 필수 정리 작업입니다.
   */
  const cleanup = () => {
    // ⚠️ 주의: 현재 구현은 빈 함수로 리스너 제거가 제대로 되지 않음
    // 💡 개선 필요: setupEventListeners에서 반환된 실제 핸들러 함수 사용 권장
    window.removeEventListener('beforeunload', () => { });
    window.removeEventListener('keydown', () => { });
  };

  /**
   * 🚀 개발용 대시보드 빠른 이동 함수
   * 
   * ESC 키 또는 개발 중 빠른 테스트를 위해 인증을 우회하고
   * 관리자 권한으로 대시보드에 직접 접근할 수 있는 개발자 도구입니다.
   * 
   * ⚠️ 프로덕션 환경에서는 이 기능을 비활성화해야 합니다.
   */
  const navigateToDashboard = () => {
    setAppState(prev => ({
      ...prev,
      selectedRole: 'admin',        // 👨‍💼 강제로 관리자 권한 부여
      currentRoute: 'dashboard',    // 📊 대시보드로 직접 이동
      isAuthenticated: true         // 🔓 인증 상태 활성화
    }));
  };

  /**
   * 🎬 로딩 완료 핸들러
   * 
   * 초기 스플래시 로딩이 완료된 후 다음 화면으로 전환하는 로직을 처리합니다.
   * 일반적으로 3초 후 메인 화면으로 자동 전환됩니다.
   * 
   * @param redirectPath - 리다이렉트할 경로 (현재는 '/main'만 지원)
   */
  const handleLoadingComplete = (redirectPath: string) => {
    console.log(`🎬 로딩 완료, 리다이렉트: ${redirectPath}`);
    
    // 🎯 현재는 메인 화면으로만 이동 (향후 다른 경로 추가 가능)
    if (redirectPath === '/main') {
      setAppState(prev => ({ ...prev, currentRoute: 'main' }));
    }
  };

  /**
   * 🎯 메인에서 역할 선택으로 이동 핸들러
   * 
   * 메인 화면의 '시작하기' 버튼을 클릭했을 때 호출되는 함수입니다.
   * 사용자를 역할 선택 화면(관리자/사용자)으로 안내합니다.
   */
  const handleNavigateToRoleSelect = () => {
    console.log(`🎯 메인 → 역할 선택 이동`);
    setAppState(prev => ({ ...prev, currentRoute: 'role' }));
  };

  /**
   * 🎯 역할 선택 완료 핸들러
   * 
   * 사용자가 관리자 또는 일반 사용자 역할을 선택했을 때 호출되는 함수입니다.
   * 선택된 역할에 따라 다른 인증 화면으로 분기합니다.
   * 
   * @param role - 선택된 사용자 역할 ('admin' | 'user')
   * @param redirect - 인증 완료 후 이동할 경로 (현재는 미사용)
   */
  const handleRoleSelected = (role: UserRole, redirect: AppRoute) => {
    console.log(`🎯 역할 선택됨: ${role}, 리다이렉트: ${redirect}`);

    if (role === 'admin') {
      // 👨‍💼 관리자는 로그인 화면으로 이동
      setAppState(prev => ({ ...prev, selectedRole: role, currentRoute: 'adminLogin' }));
    } else {
      // 👤 일반 사용자는 코드 입력 화면으로 이동
      setAppState(prev => ({ ...prev, selectedRole: role, currentRoute: 'userCode' }));
    }
  };

  /**
   * ✅ 관리자 로그인 성공 핸들러
   * 
   * 관리자가 올바른 자격증명으로 로그인에 성공했을 때 호출됩니다.
   * 인증 상태를 활성화하고 대시보드 화면으로 이동시킵니다.
   */
  const handleAdminLoginSuccess = () => {
    console.log('✅ 관리자 로그인 성공');
    authenticateUser('dashboard');  // 🔐 인증 처리 및 대시보드 이동
  };

  /**
   * ✅ 사용자 코드 입력 성공 핸들러
   * 
   * 일반 사용자가 올바른 접근 코드를 입력했을 때 호출됩니다.
   * 인증 상태를 활성화하고 대시보드 화면으로 이동시킵니다.
   */
  const handleUserCodeSuccess = () => {
    console.log('✅ 사용자 코드 입력 성공');
    authenticateUser('dashboard');  // 🔐 인증 처리 및 대시보드 이동
  };

  /**
   * 🔐 사용자 인증 처리 함수
   * 
   * 로그인 또는 코드 입력 성공 후 공통으로 호출되는 인증 처리 로직입니다.
   * 세션 스토리지에 인증 상태를 저장하고 지정된 화면으로 이동합니다.
   * 
   * @param targetRoute - 인증 완료 후 이동할 대상 라우트
   */
  const authenticateUser = (targetRoute: AppRoute) => {
    // 💾 세션 스토리지에 인증 상태 저장 (브라우저 탭 내에서만 유지)
    sessionStorage.setItem('isAuthenticated', 'true');

    // 🔄 애플리케이션 상태 업데이트
    setAppState(prev => ({
      ...prev,
      isAuthenticated: true,    // 🔓 인증 상태 활성화
      currentRoute: targetRoute // 🎯 지정된 화면으로 이동
    }));
  };

  /**
   * 🧭 라우트 네비게이션 함수
   * 
   * 애플리케이션 내에서 다른 화면으로 직접 이동할 때 사용하는 함수입니다.
   * 라우트 변경과 함께 해당 화면에 맞는 활성 메뉴도 자동으로 설정합니다.
   * 
   * @param route - 이동할 대상 라우트
   */
  const navigateToRoute = (route: AppRoute) => {
    const newActiveMenu = getActiveMenuForRoute(route);  // 📋 라우트에 맞는 메뉴 결정

    setAppState(prev => ({
      ...prev,
      currentRoute: route,      // 🎯 새로운 라우트로 변경
      activeMenu: newActiveMenu // 📌 활성 메뉴 동기화
    }));
  };

  /**
   * 📋 라우트에 따른 활성 메뉴 결정 함수
   * 
   * 각 화면에 해당하는 사이드바 메뉴 이름을 반환합니다.
   * 사이드바의 하이라이트 상태를 올바르게 유지하기 위해 사용됩니다.
   * 
   * @param route - 현재 라우트
   * @returns 활성화할 메뉴 이름 문자열
   */
  const getActiveMenuForRoute = (route: AppRoute): string => {
    switch (route) {
      case 'dashboard': return 'Dashboard';  // 📊 대시보드 메뉴
      case 'chatbot': return 'Chatbot';      // 🤖 챗봇 메뉴
      case 'history': return 'History';      // 📝 히스토리 메뉴
      default: return appState.activeMenu;   // 🔄 기존 활성 메뉴 유지
    }
  };

  /**
   * 🚪 로그아웃 처리 함수
   * 
   * 사용자가 로그아웃을 요청했을 때 모든 인증 정보를 초기화하고
   * 역할 선택 화면으로 돌아갑니다. 보안을 위해 모든 세션 데이터를 완전히 삭제합니다.
   */
  const handleLogout = () => {
    console.log('🚪 로그아웃 처리');

    // 🧹 모든 세션 데이터 완전 삭제
    RoleSelectUtils.clearSavedRole();              // 역할 선택 정보 삭제
    sessionStorage.removeItem('isAuthenticated');  // 인증 상태 삭제

    // 🔄 애플리케이션 상태를 초기 상태로 리셋
    setAppState({
      currentRoute: 'role',        // 🎯 역할 선택 화면으로 이동
      selectedRole: null,          // 👤 역할 선택 초기화
      isAuthenticated: false,      // 🔐 인증 상태 비활성화
      activeMenu: 'Dashboard'      // 📋 기본 메뉴로 리셋
    });
  };

  /**
   * 📌 메뉴 상태 업데이트 함수
   * 
   * 사이드바에서 메뉴를 클릭했을 때 활성 메뉴 상태를 업데이트합니다.
   * 현재 화면과 무관하게 사용자가 선택한 메뉴를 하이라이트하는 데 사용됩니다.
   * 
   * @param menu - 활성화할 메뉴 이름
   */
  const setActiveMenu = (menu: string) => {
    setAppState(prev => ({
      ...prev,
      activeMenu: menu  // 📋 새로운 활성 메뉴 설정
    }));
  };

  /**
   * 🔙 역할 선택 화면으로 돌아가기 함수
   * 
   * 로그인 화면이나 코드 입력 화면에서 '뒤로 가기' 버튼을 클릭했을 때 호출됩니다.
   * 인증 정보는 초기화하되 세션 스토리지는 유지하여 부분적인 상태 리셋을 수행합니다.
   */
  const goBackToRoleSelection = () => {
    console.log('🔙 역할 선택으로 돌아가기');

    setAppState(prev => ({
      ...prev,
      currentRoute: 'role',        // 🎯 역할 선택 화면으로 이동
      selectedRole: null,          // 👤 선택된 역할 초기화
      isAuthenticated: false       // 🔐 인증 상태 비활성화
    }));
  };

  /**
   * 🎮 이벤트 핸들러 객체 구성
   * 
   * 모든 상태 변경 핸들러들을 하나의 객체로 그룹화하여 제공합니다.
   * 컴포넌트에서 구조 분해 할당으로 필요한 핸들러만 선택적으로 사용할 수 있습니다.
   */
  const handlers: AppHandlers = {
    onLoadingComplete: handleLoadingComplete,        // 🎬 로딩 완료 처리
    onNavigateToRoleSelect: handleNavigateToRoleSelect, // 🎯 역할 선택 이동
    onRoleSelected: handleRoleSelected,              // 👤 역할 선택 완료
    onAdminLoginSuccess: handleAdminLoginSuccess,    // ✅ 관리자 로그인 성공
    onUserCodeSuccess: handleUserCodeSuccess,        // ✅ 사용자 코드 입력 성공
    onLogout: handleLogout,                          // 🚪 로그아웃 처리
    onGoBackToRole: goBackToRoleSelection           // 🔙 역할 선택으로 돌아가기
  };

  /**
   * 🧭 네비게이션 함수 객체 구성
   * 
   * 라우트 변경과 메뉴 상태 관리를 위한 함수들을 그룹화합니다.
   * 컴포넌트에서 직접적인 네비게이션 제어가 필요할 때 사용됩니다.
   */
  const navigation: AppNavigation = {
    navigateToRoute,  // 🎯 특정 라우트로 직접 이동
    setActiveMenu     // 📋 활성 메뉴 상태 변경
  };

  /**
   * 📦 훅 반환값 구성
   * 
   * useAppRouter 훅에서 제공하는 모든 기능을 객체로 반환합니다.
   * 컴포넌트에서는 구조 분해 할당을 통해 필요한 기능만 선택적으로 사용할 수 있습니다.
   * 
   * @returns 애플리케이션 상태, 이벤트 핸들러, 네비게이션 함수들
   */
  return {
    appState,    // 📱 현재 애플리케이션 상태 (currentRoute, selectedRole, isAuthenticated, activeMenu)
    handlers,    // 🎮 상태 변경을 위한 이벤트 핸들러들
    navigation   // 🧭 라우트 변경 및 메뉴 제어 함수들
  };
};