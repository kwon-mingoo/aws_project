/**
 * ═══════════════════════════════════════════════════════════════
 * 🤖 ChatbotScreen - 대화형 챗봇 인터페이스 컴포넌트
 * ═══════════════════════════════════════════════════════════════
 * 
 * 주요 기능:
 * - 사용자와 챗봇 간의 실시간 대화 인터페이스 제공
 * - 백엔드 Python 챗봇 모듈과 API 연동
 * - 센서 관련 질문에 대한 스마트한 답변 제공
 * - 대화 이력 관리 및 세션 유지
 * 
 * API 연동 구조:
 * - UseChatbot 훅을 통해 챗봇 API 통신 관리
 * - POST /chatbot/ask 엔드포인트로 질문 전송
 * - 실시간 타이핑 인디케이터 및 응답 처리
 * - 에러 핸들링 및 연결 상태 모니터링
 * 
 * 컴포넌트 구조:
 * - ChatbotHeader: 모델 상태 및 뒤로가기
 * - MessageItem: 개별 메시지 표시 (사용자/봇)
 * - TypingIndicator: 봇 응답 대기 중 표시
 * - ChatbotInput: 메시지 입력 및 전송
 */

// ChatbotScreen.tsx - 간소화된 챗봇 화면 컴포넌트
import React, { useState, useEffect } from 'react';
import { Bell, User, ChevronDown } from 'lucide-react';
import { Sidebar } from '../../components/common/Sidebar';
import NotificationDropdown from '../../components/common/dropdown/NotificationDropdown';
import AdminDropdown from '../../components/common/dropdown/AdminDropdown';
import { ChatbotScreenProps, NotificationData } from '../../services/ChatbotTypes';
import styles from "./ChatbotScreen.module.css";
import { useChatbot } from '../../services/UseChatbot';
import {
  ChatbotHeader,
  MessageItem,
  TypingIndicator,
  ChatbotInput,
} from './hooks/ChatbotComponents';

const ChatbotScreen: React.FC<ChatbotScreenProps> = ({ 
  onNavigateToHistory,
  onNavigateToRole,
  onNavigateToDashboard,
  activeMenu,
  setActiveMenu,
}) => {

  /**
   * 🎯 핵심 API 연동 훅 사용
   * UseChatbot: 챗봇 API 통신의 모든 로직을 캡슐화
   * - chatbotState: 메시지, 로딩 상태, 에러 상태 관리
   * - sendMessage: POST /chatbot/ask API 호출 함수
   * - 실시간 대화 상태 및 세션 관리
   */

  // ChatbotScreen.tsx 상단에 추가
const useCurrentTime = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleString('ko-KR', { hour12: false });
};


  const {
    chatbotState,        // 챗봇 전체 상태 (메시지, 로딩, 에러 등)
    messagesEndRef,      // 메시지 스크롤 자동 이동용 ref
    sendMessage,         // 메시지 전송 함수 (API 호출)
    handleInputChange,   // 입력 필드 변경 핸들러
    handleKeyDown        // 키보드 입력 핸들러 (Enter 등)
  } = useChatbot();

  // 현재 시간 표시용 훅
  const currentTime = useCurrentTime();

  /**
   * 🔔 UI 상태 관리 (알림, 드롭다운 등)
   * API 연동과는 별개의 로컬 UI 상태들
   */
  const [notificationData, setNotificationData] = useState<NotificationData>({
    count: 0,
    notifications: []
  });
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);

  // 메뉴 클릭 핸들러
  const handleMenuClick = (label: string) => {
    setActiveMenu(label);

    switch (label) {
      case 'Dashboard':
        onNavigateToDashboard();
        break;
      case 'History':
        onNavigateToHistory();
        break;
      case 'Chatbot':
        // 챗봇 화면이므로 현재 화면 유지
        break;
      case 'Logout':
        onNavigateToRole?.();
        break;
      default:
        break;
    }
  };

  return (
    <div className={styles.dashboardContainer}>
      {/* 사이드바 */}
      <Sidebar 
        activeMenu={activeMenu}
        onMenuClick={handleMenuClick}
      />

      {/* 메인 컨텐츠 영역 */}
      <main className={styles.mainContent}>
        {/* 상단 헤더 */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.pageTitle}>{activeMenu}</h1>
            <p className={styles.pageSubtitle}>{currentTime}</p>
          </div>

          <div className={styles.headerRight}>
            {/* 알림 아이콘 */}
            <div className={styles.headerItem}>
              <button
                onClick={() => {
                  setIsNotificationOpen(!isNotificationOpen);
                  setIsAdminMenuOpen(false);
                }}
                className={styles.headerButton}
                aria-label="알림"
              >
                <Bell size={20} />
                {notificationData.count > 0 && (
                  <span className={styles.notificationBadge}>
                    {notificationData.count > 99 ? '99+' : notificationData.count}
                  </span>
                )}
              </button>

              <NotificationDropdown
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                notifications={notificationData.notifications}
              />
            </div>

            {/* 관리자 메뉴 */}
            <div className={styles.headerItem}>
              <button
                onClick={() => {
                  setIsAdminMenuOpen(!isAdminMenuOpen);
                  setIsNotificationOpen(false);
                }}
                className={styles.adminButton}
                aria-label="관리자 메뉴"
              >
                <User size={20} />
                <span>관리자</span>
                <ChevronDown size={16} />
              </button>

              <AdminDropdown
                isOpen={isAdminMenuOpen}
                onClose={() => setIsAdminMenuOpen(false)}
              />
            </div>
          </div>
        </header>

        {/* 메인 챗봇 컨텐츠 */}
        <div className={styles.dashboardContent}>
          <div className={styles.chatbotContainer}>
            {/* 챗봇 헤더 */}
            <ChatbotHeader
  modelStatus={chatbotState.modelStatus as 'Active' | 'Inactive' | 'Loading'}
  onBackClick={() => onNavigateToRole && onNavigateToRole()}
/>


            {/* 메시지 영역 */}
            <div className={styles.chatbotMessagesContainer}>
              <div className={styles.chatbotMessages}>
                {chatbotState.messages.map((message) => (
                  <MessageItem key={message.id} message={message} />
                ))}
                
                {chatbotState.isTyping && <TypingIndicator />}
                
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* 입력 영역 */}
            <ChatbotInput 
              inputMessage={chatbotState.inputMessage}
              isLoading={chatbotState.isLoading}
              onInputChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onSendMessage={sendMessage}
              error={chatbotState.error}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatbotScreen;