/**
 * ═══════════════════════════════════════════════════════════════
 * 🔐 LoginScreen - 관리자 로그인 시스템
 * ═══════════════════════════════════════════════════════════════
 * 
 * 주요 기능:
 * - Admin: 이메일/비밀번호 기반 1차 인증만
 * - 자동 로그인 유지 옵션
 * - 반응형 UI 및 접근성 지원
 * 
 * API 연동:
 * - loginApi: 이메일/비밀번호 1차 인증 (Admin만)
 * 
 * 인증 흐름:
 * - Admin: 이메일/비밀번호 입력 → 바로 대시보드
 */

// import React, { useState, useEffect } from "react";
import React, { useState, useEffect, useRef } from "react";
import styles from "./AuthSystem.module.css";
import {
  loginApi,
  LoginFormData,
} from "./authApi";
import TransitionScreen from "../Transition/TransitionScreen";

/**
 * 🎭 인증 시스템 Props 타입 정의
 * 부모 컴포넌트에서 역할 정보와 성공 콜백을 전달받음
 */
interface AuthSystemProps {
  onLoginSuccess?: () => void;              // 로그인 성공 시 호출될 콜백 함수
  selectedRole?: 'admin' | 'user' | null;  // 사전 선택된 사용자 역할
  onGoBack?: () => void;                    // 역할 선택으로 돌아가기 콜백 함수
}

/**
 * 🎯 메인 인증 시스템 컴포넌트
 * 관리자 로그인만 처리하는 컴포넌트
 */
const AuthSystem: React.FC<AuthSystemProps> = ({
  onLoginSuccess,     // 로그인 성공 시 콜백
  selectedRole,       // 선택된 사용자 역할
  onGoBack           // 역할 선택으로 돌아가기 콜백
}) => {

  // 1차 인증 폼 데이터 (이메일/비밀번호) - Admin용
  const [loginForm, setLoginForm] = useState<LoginFormData>({
    email: "esteban_schiller@gmail.com",    // 개발용 기본값
    password: "",
    rememberMe: false,
  });

  /**
   * 🔄 UI 상태 관리
   * 로딩, 에러, 성공 메시지 상태
   */
  const [loading, setLoading] = useState(false);    // API 호출 로딩 상태
  const [error, setError] = useState("");           // 에러 메시지
  const [success, setSuccess] = useState("");       // 성공 메시지
  const hasNavigatedRef = useRef(false);
  /**
   * 🎭 역할 기반 UI 메시지 생성 함수들
   * 선택된 역할(관리자)에 따라 적절한 메시지를 표시
   */

  /** 역할별 환영 메시지 */
  const getRoleWelcomeMessage = () => {
    return '관리자 로그인';
  };

  /** 역할별 설명 메시지 */
  const getRoleSubtitle = () => {
    return 'Please enter your admin credentials to continue';
  };

  /**
   * 📝 폼 검증 함수들
   * 사용자 입력의 유효성을 실시간으로 검증
   */

  /** 로그인 폼 유효성 검증 */
  const isLoginValid =
    loginForm.email.trim() !== "" &&        // 이메일 필드가 비어있지 않음
    loginForm.password.trim() !== "" &&     // 비밀번호 필드가 비어있지 않음
    loginForm.email.includes("@");          // 기본적인 이메일 형식 검증

  const [showTransition, setShowTransition] = useState(false);
  /**
   * 🔐 Admin 로그인 처리 함수 (이메일/비밀번호)
   * 
   * API 연동 상세:
   * - POST /auth/login 엔드포인트 호출
   * - 성공 시 바로 대시보드로 이동
   * - 실패 시 사용자에게 에러 메시지 표시
   */
  // ✅ 이 함수 전체를 아래 코드로 교체
  // const handleLoginSubmit = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!isLoginValid) return;

  //   setLoading(true);
  //   setError("");
  //   setSuccess("");

  //   try {
  //     await loginApi(loginForm);
  //     setSuccess("로그인 성공! 대시보드로 이동합니다.");
  //     // onLoginSuccess?.();  // ❌ 즉시 이동 금지
  //     setShowTransition(true); // ✅ 트랜지션 먼저
  //   } catch (err) {
  //     setError("이메일 또는 비밀번호가 잘못되었습니다.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoginValid) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await loginApi(loginForm);
      setSuccess("로그인 성공! 대시보드로 이동합니다.");

      // ❌ (삭제) onLoginSuccess?.();  // 바로 라우팅 금지
      // ❌ (삭제) setTimeout(() => onLoginSuccess?.(), 300);  // 이것도 금지

      // ✅ 트랜지션 먼저 띄우기
      setShowTransition(true);
    } catch (err) {
      setError("이메일 또는 비밀번호가 잘못되었습니다.");
    } finally {
      setLoading(false);
    }
  };


  /**
   * ⬅️ 역할 선택 화면으로 돌아가기
   * 부모 컴포넌트의 onGoBack 콜백을 호출하거나 대안 방법 사용
   */
  const handleBackToRoleSelection = () => {
    if (onGoBack) {
      // 부모 컴포넌트에서 onGoBack prop을 제공한 경우
      onGoBack();
    } else {
      // onGoBack prop이 없는 경우 대안 방법 (개발 환경용)
      console.warn('onGoBack prop이 제공되지 않았습니다. 페이지를 새로고침합니다.');
      window.location.reload();
    }
  };

  // Admin 로그인 폼 렌더링
  const renderAdminLoginForm = () => (
    <div className={styles.authContainer}>
      <div className={styles.authPanel}>
        {/* 뒤로가기 버튼 */}
        <button
          type="button"
          className={styles.backButton}
          onClick={handleBackToRoleSelection}
          disabled={loading}
        >
          ← 역할 선택으로 돌아가기
        </button>

        <h2 className={styles.authTitle}>{getRoleWelcomeMessage()}</h2>
        <p className={styles.authSubtitle}>{getRoleSubtitle()}</p>

        {selectedRole && (
          <div className={styles.roleIndicator}>
            <span className={styles.roleLabel}>선택된 역할:</span>
            <span className={`${styles.roleValue} ${styles[selectedRole]}`}>관리자</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email address:</label>
            <input
              type="email"
              className={`${styles.formInput} ${loginForm.email ? styles.filled : ""}`}
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              placeholder="Enter your email"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Password
              <a href="#" className={styles.forgotPassword}>Forget Password?</a>
            </label>
            <input
              type="password"
              className={`${styles.formInput} ${loginForm.password ? styles.filled : ""}`}
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              placeholder="••••••••"
            />
          </div>

          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="rememberMe"
              className={styles.checkbox}
              checked={loginForm.rememberMe}
              onChange={(e) => setLoginForm({ ...loginForm, rememberMe: e.target.checked })}
            />
            <label htmlFor="rememberMe" className={styles.checkboxLabel}>Remember Password</label>
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}
          {success && <div className={styles.successMessage}>{success}</div>}

          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!isLoginValid || loading}>
            {loading ? "Loading..." : "Login"}
          </button>
        </form>

        <div className={styles.createAccount}>
          Don't have an account? <a href="#">Create Account</a>
        </div>
      </div>

      <div className={styles.sidePanel}></div>
    </div>
  );

  return (
    <div className={`${styles.container} ${loading ? styles.loading : ""}`}>
      {/* 배경 패턴 */}
      <div className={styles.backgroundPattern} aria-hidden="true">
        <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="geometric" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M20,20 L80,20 L50,80 Z" fill="none" stroke="#f39c12" strokeWidth="1" opacity="0.1" />
              <circle cx="80" cy="80" r="15" fill="none" stroke="#3498db" strokeWidth="1" opacity="0.1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#geometric)" />
          <path d="M100,500 Q300,300 500,500 T900,500" stroke="#f39c12" strokeWidth="2" fill="none" opacity="0.2" />
          <path d="M200,200 L400,300 L600,200 L800,300" stroke="#e67e22" strokeWidth="1" fill="none" opacity="0.3" />
        </svg>
      </div>

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoText}>AWS²</span>
          <div className={styles.logoGiot}>
            GIOT
            <div className={styles.wifiIcon}></div>
          </div>
        </div>
        <div className={styles.subtitle}>Air Watch System</div>
      </header>

      {/* Admin 로그인 폼만 렌더링 */}
      {renderAdminLoginForm()}

      {/* ✅ 트랜지션: 오직 여기에서, 가드로 한 번만 라우팅 */}
      {showTransition && (
        <TransitionScreen
          targetRole="admin"
          onTransitionComplete={() => {
            if (hasNavigatedRef.current) return; // 중복 방지
            hasNavigatedRef.current = true;
            onLoginSuccess?.(); // 최종 라우팅 (대시보드 이동)
          }}
        />
      )}


      <footer className={styles.footer}>2025 GBSA AWS</footer>
    </div>
  );
};

export default AuthSystem;