/**
 * ═══════════════════════════════════════════════════════════════
 * 🔑 UserCodeScreen - 사용자 접근 코드 입력 화면
 * ═══════════════════════════════════════════════════════════════
 * 
 * 🎯 주요 기능:
 * - 일반 사용자의 시스템 접근을 위한 코드 기반 인증
 * - 관리자가 발급한 접근 코드를 통한 간편 로그인
 * - LoginScreen과 동일한 디자인 언어 사용
 * - 실시간 코드 검증 및 사용자 피드백
 * 
 * 🔐 보안 특징:
 * - 사전 정의된 유효 코드 목록을 통한 접근 제어
 * - 대소문자 자동 변환으로 입력 편의성 제공
 * - 클라이언트 사이드 검증 (실제 환경에서는 서버 검증 필요)
 * 
 * 🎨 UI/UX:
 * - LoginScreen과 일관된 시각적 디자인
 * - 반응형 레이아웃 및 모바일 최적화
 * - 로딩 스피너 및 에러 메시지 표시
 * - 도움말 섹션으로 사용자 가이드 제공
 * 
 * 🔄 데이터 플로우:
 * 1. 사용자가 접근 코드 입력
 * 2. 클라이언트 사이드 검증 (validCodes 배열 확인)
 * 3. 성공 시 onCodeSuccess 콜백 호출
 * 4. 실패 시 에러 메시지 표시
 * 
 * 📝 향후 개선사항:
 * - 서버 사이드 코드 검증 API 연동
 * - 코드 만료 시간 및 사용 횟수 제한
 * - 접근 로그 기록 및 감사 추적
 */
import React, { useState } from 'react';
import styles from './UserCodeScreen.module.css';
import TransitionScreen from "../Transition/TransitionScreen";
import { verifyCodeApi } from '../../services/LoginTypes'; // 또는 해당 파일의 상대 경로

/**
 * 🎭 사용자 코드 화면 Props 인터페이스
 * 부모 컴포넌트(AppRouter)와의 상호작용을 위한 콜백 함수들을 정의합니다.
 */
interface UserCodeScreenProps {
  onCodeSuccess: () => void;    // 코드 인증 성공 시 호출될 콜백 (대시보드로 이동)
  onGoBack: () => void;         // 역할 선택 화면으로 돌아가기 콜백
}

/**
 * 🎯 메인 사용자 코드 입력 화면 컴포넌트
 * 
 * 일반 사용자가 관리자로부터 받은 접근 코드를 입력하여
 * 시스템에 접근할 수 있도록 하는 인증 화면입니다.
 * 
 * @param onCodeSuccess - 코드 인증 성공 시 실행될 콜백
 * @param onGoBack - 이전 화면(역할 선택)으로 돌아가기 콜백
 */
const UserCodeScreen: React.FC<UserCodeScreenProps> = ({ onCodeSuccess, onGoBack }) => {
  /**
   * 📝 컴포넌트 상태 관리
   */
  const [code, setCode] = useState('');             // 사용자가 입력한 접근 코드
  const [isLoading, setIsLoading] = useState(false); // 코드 검증 중 로딩 상태
  const [error, setError] = useState('');           // 에러 메시지 표시용
const [showTransition, setShowTransition] = useState(false);
  /**
   * 🎫 유효한 접근 코드 목록
   * 
   * ⚠️ 현재는 클라이언트 사이드 검증용 하드코딩
   * 실제 프로덕션 환경에서는 서버 API를 통해 검증해야 합니다.
   * 
   * 포함된 테스트 코드:
   * - USER001, USER002, USER003: 일반 사용자 코드
   * - DEMO2024: 데모 및 테스트용 코드
   */
  // const validCodes = ['USER001', 'USER002', 'USER003', 'DEMO2024'];

  /**
   * 📋 폼 제출 핸들러
   * 
   * 사용자가 입력한 접근 코드를 검증하고 결과에 따라 적절한 액션을 수행합니다.
   * 현재는 클라이언트 사이드 검증을 시뮬레이션하지만,
   * 실제 환경에서는 서버 API를 호출해야 합니다.
   * 
   * @param e - 폼 제출 이벤트
   */
//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();  // 기본 폼 제출 동작 방지
    
//     // 📝 입력값 검증
//     if (!code.trim()) {
//       setError('코드를 입력해주세요.');
//       return;
//     }

//     // 🔄 로딩 상태 시작
//     setIsLoading(true);
//     setError('');

//     // 🔍 코드 검증 시뮬레이션 (실제로는 API 호출)
//     // TODO: 실제 환경에서는 POST /auth/verify-code API 호출
//     setTimeout(() => {
//       if (validCodes.includes(code.toUpperCase())) {
//   // ✅ 유효한 코드 → 트랜지션 먼저
//   setShowTransition(true);
// } else {
//   setError('유효하지 않은 코드입니다. 다시 시도해주세요.');
// }

//       setIsLoading(false);  // 로딩 상태 종료
//     }, 1000);  // 1초 지연으로 API 호출 시뮬레이션
//   };
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!code.trim()) {
    setError('코드를 입력해주세요.');
    return;
  }

  setIsLoading(true);
  setError('');

  try {
    await verifyCodeApi({ code: code.trim() });
    setShowTransition(true);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case 'INVALID_CODE':
          setError('유효하지 않은 코드입니다. 다시 시도해주세요.');
          break;
        case 'NETWORK_ERROR':
          setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
          break;
        default:
          setError('코드 검증 중 오류가 발생했습니다.');
      }
    } else {
      setError('코드 검증 중 오류가 발생했습니다.');
    }
  } finally {
    setIsLoading(false);
  }
};

  /**
   * ⌨️ 입력 필드 변경 핸들러
   * 
   * 사용자가 코드를 입력할 때마다 호출되며,
   * 자동으로 대문자로 변환하고 기존 에러 메시지를 제거합니다.
   * 
   * @param e - 입력 필드 변경 이벤트
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setCode(e.target.value);   // ✅ 대문자 강제 제거 → 소문자도 그대로 입력됨
  setError('');
};

  return (
    <div className={`${styles.container} ${isLoading ? styles.loading : ""}`}>
      {/* 🎨 배경 패턴 - LoginScreen과 동일한 기하학적 패턴으로 일관성 유지 */}
      <div className={styles.backgroundPattern} aria-hidden="true">
        <svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="geometric" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M20,20 L80,20 L50,80 Z" fill="none" stroke="#f39c12" strokeWidth="1" opacity="0.1"/>
              <circle cx="80" cy="80" r="15" fill="none" stroke="#3498db" strokeWidth="1" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#geometric)"/>
          <path d="M100,500 Q300,300 500,500 T900,500" stroke="#f39c12" strokeWidth="2" fill="none" opacity="0.2"/>
          <path d="M200,200 L400,300 L600,200 L800,300" stroke="#e67e22" strokeWidth="1" fill="none" opacity="0.3"/>
        </svg>
      </div>

      {/* 🏢 헤더 - AWS² GIOT 브랜딩과 Air Watch System 서브타이틀 */}
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

      {/* 🏠 메인 카드 - 코드 입력 폼을 포함한 중앙 컨테이너 */}
      <div className={styles.card}>
        <div className={styles.cardPanel}>
          {/* ⬅️ 뒤로가기 버튼 - 역할 선택 화면으로 돌아가기 */}
          <button 
            type="button"
            className={styles.backButton}
            onClick={onGoBack}
            disabled={isLoading}
          >
            ← 역할 선택으로 돌아가기
          </button>

          {/* 👤 역할 표시기 - 현재 선택된 역할(사용자) 표시 */}
          <div className={styles.roleIndicator}>
            <span className={styles.roleLabel}>선택된 역할:</span>
            <span className={styles.roleValue}>사용자</span>
          </div>

          {/* 🔑 아이콘과 제목 - 코드 입력 화면임을 시각적으로 표현 */}
          <div className={styles.iconContainer}>
            <span className={styles.icon}>🔑</span>
          </div>
          
          <h2 className={styles.title}>사용자 코드 입력</h2>
          <p className={styles.subtitle}>관리자로부터 받은 접근 코드를 입력해주세요</p>

          {/* 📝 코드 입력 폼 - 메인 인증 인터페이스 */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>접근 코드</label>
              <input
                type="text"
                value={code}
                onChange={handleInputChange}
                placeholder="코드를 입력하세요 (예: USER001)"
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                disabled={isLoading}
              />
              {error && (
                <div className={styles.errorMessage}>{error}</div>
              )}
            </div>

            {/* 🎛️ 액션 버튼들 - 뒤로가기와 접속하기 버튼 */}
            <div className={styles.buttonGroup}>
              <button
                type="button"
                onClick={onGoBack}
                disabled={isLoading}
                className={styles.secondaryButton}
              >
                뒤로가기
              </button>
              
              <button
                type="submit"
                disabled={isLoading || !code.trim()}
                className={styles.primaryButton}
              >
                {isLoading ? (
                  <>
                    <div className={styles.spinner} />
                    확인 중...
                  </>
                ) : (
                  '접속하기'
                )}
              </button>
            </div>
          </form>

          {/* 💡 도움말 섹션 - 사용자 가이드 및 테스트 코드 정보 */}
          <div className={styles.helpSection}>
            <h3 className={styles.helpTitle}>💡 도움말</h3>
            <ul className={styles.helpList}>
              <li>접근 코드는 시스템 관리자로부터 받을 수 있습니다</li>
              <li>문제가 있다면 관리자에게 문의하세요</li>
              <li><strong>테스트 코드:</strong> admin0610, admin0816, admin0331</li>
            </ul>
          </div>
        </div>

        {/* 🎨 사이드 패널 - LoginScreen과 일관된 오렌지 그라데이션 디자인 */}
        <div className={styles.sidePanel}></div>
      </div>
{showTransition && (
  <TransitionScreen
    targetRole="user"
    onTransitionComplete={() => {
      setShowTransition(false);
      onCodeSuccess();        // ✅ 트랜지션 끝난 뒤 최종 이동
    }}
  />
)}

      {/* 🏛️ 푸터 - 2025 GBSA AWS 브랜딩 */}
      <footer className={styles.footer}>2025 GBSA AWS</footer>
    </div>
  );
};

export default UserCodeScreen;