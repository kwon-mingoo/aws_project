// App.tsx - 메인 애플리케이션 컴포넌트
import React, { useState, useEffect } from 'react';
import './App.css';
import LoadingScreen from './pages/Sloading/LoadingScreen';
import MainScreen from './pages/Main/MainScreen';
import RoleSelectionScreen from './pages/RoleSelection/RoleSelectionScreen';
import TransitionScreen from './pages/Transition/TransitionScreen';
import DashboardScreen from './pages/Dashboard/DashboardScreen';
import ChatbotScreen from './pages/Chatbot/ChatbotScreen';
import HistoryScreen from './pages/History/HistoryScreen';

type AppState = 'loading' | 'main' | 'roleSelect' | 'transition' | 'dashboard' | 'chatbot' | 'history';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('loading');
  const [selectedRole, setSelectedRole] = useState<'admin' | 'user' | null>(null);

  // 로딩 완료 핸들러
  const handleLoadingComplete = (redirectPath: string) => {
    if (redirectPath === '/main' || redirectPath === '/dashboard') {
      setAppState('main'); // 로딩 후 메인 화면으로
    }
  };

  // 메인에서 역할 선택 화면으로 이동
  const handleNavigateToRoleSelect = () => {
    setAppState('roleSelect');
  };

  // 역할 선택 완료 후 전환 화면으로 이동
  const handleRoleSelected = (role: 'admin' | 'user', _redirectPath: string) => {
    setSelectedRole(role);
    setAppState('transition');
  };

  // 전환 완료 후 대시보드로 이동
  const handleTransitionComplete = () => {
    setAppState('dashboard');
  };

  // 대시보드에서 챗봇으로 이동
  const handleNavigateToChatbot = () => {
    setAppState('chatbot');
  };

  // 대시보드에서 히스토리로 이동
  const handleNavigateToHistory = () => {
    setAppState('history');
  };

  // 챗봇에서 대시보드로 돌아가기
  const handleNavigateBackToDashboard = () => {
    setAppState('dashboard');
  };

  // 히스토리에서 대시보드로 돌아가기
  const handleNavigateBackFromHistory = () => {
    setAppState('dashboard');
  };

  // 히스토리에서 챗봇으로 이동
  const handleNavigateFromHistoryToChatbot = () => {
    setAppState('chatbot');
  };

  // 새로고침 감지 및 로딩 화면 재표시
  useEffect(() => {
    const handleBeforeUnload = () => {
      setAppState('loading');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 첫 방문 여부 확인
  useEffect(() => {
    const hasVisited = sessionStorage.getItem('aws_iot_visited');

    // 개발 모드에서는 항상 로딩부터 시작
    if (process.env.NODE_ENV === 'development') {
      setAppState('loading');
    }

    // 방문 표시
    if (!hasVisited) {
      sessionStorage.setItem('aws_iot_visited', 'true');
    }
  }, []);

  // ESC 키로 메인으로 돌아가기 (개발용)
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && appState !== 'loading') {
        setAppState('main');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [appState]);

  // 현재 상태에 따른 컴포넌트 렌더링
  const renderCurrentScreen = () => {
    switch (appState) {
      case 'loading':
        return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;

      case 'main':
        return <MainScreen onNavigateToDashboard={handleNavigateToRoleSelect} />;

      case 'roleSelect':
        return <RoleSelectionScreen onRoleSelected={handleRoleSelected} />;

      case 'transition':
        return (
          <TransitionScreen
            targetRole={selectedRole || 'admin'}
            onTransitionComplete={handleTransitionComplete}
          />
        );

      case 'dashboard':
        return (
          <DashboardScreen
            onNavigateToChatbot={handleNavigateToChatbot}
            onNavigateToHistory={handleNavigateToHistory}
          />
        ); 

      case 'chatbot':
        return <ChatbotScreen onNavigateBack={handleNavigateBackToDashboard} />;

      case 'history':
        return (
          <HistoryScreen
            onNavigateBack={handleNavigateBackFromHistory}
            onNavigateToChatbot={handleNavigateFromHistoryToChatbot}
            onNavigateToHistory={handleNavigateToHistory} 
          />
        );

      default:
        return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
    }
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
      }}
    >
      {renderCurrentScreen()}

      {/* 개발용 상태 표시 (프로덕션에서 제거) */}
      {process.env.NODE_ENV === 'development' && (
        <div
          style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            zIndex: 10000,
          }}
        >
          State: {appState} | Role: {selectedRole || 'none'} | Press ESC to go to main
        </div>
      )}
    </div>
  );
};

export default App; 
