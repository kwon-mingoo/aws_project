// ChatbotScreen.tsx - 챗봇 화면 컴포넌트
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Bell, 
  User, 
  ChevronLeft, 
  Printer, 
  Star, 
  Trash2, 
  Paperclip, 
  Send,
  MoreHorizontal,
  MessageCircle
} from 'lucide-react';
import { ChatbotState, ChatMessage, ChatbotAPI, ChatbotUtils } from '../../services/ChatbotTypes';
import { NotificationData, DashboardAPI } from '../../services/DashboardTypes';
import styles from "./ChatbotScreen.module.css"


// 타이핑 인디케이터 컴포넌트
const TypingIndicator: React.FC = () => (
  <div className={`${styles.chatbotMessageItem} ${styles.bot}`}>
    <div className={`${styles.chatbotMessageAvatar} ${styles.bot}`}>AWS²</div>
    <div className={styles.chatbotTypingIndicator}>
      <div className={styles.chatbotTypingBubble}>
        <div className={styles.chatbotTypingDot}></div>
        <div className={styles.chatbotTypingDot}></div>
        <div className={styles.chatbotTypingDot}></div>
      </div>
    </div>
  </div>
);

// 메시지 아이템 컴포넌트
const MessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isBot = message.sender === 'bot';
  
  return (
    <div className={`${styles.chatbotMessageItem} ${styles[message.sender]}`}>
      {isBot && (
        <div className={`${styles.chatbotMessageAvatar} ${styles.bot}`}>AWS²</div>
      )}
      
      <div className={styles.chatbotMessageBubble}>
        <div className={`${styles.chatbotMessageContent} ${styles[message.sender]}`}>
          {message.message.split('\n').map((line, index) => (
            <React.Fragment key={index}>
              {line}
              {index < message.message.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
          
          {/* 센서 데이터 표시 (봇 메시지인 경우) */}
          {isBot && message.sensorData && (
            <div className={styles.chatbotSensorData}>
              <div className={styles.chatbotSensorItem}>
                <span>온도:</span>
                <span>{message.sensorData.temperature}°C</span>
              </div>
              <div className={styles.chatbotSensorItem}>
                <span>습도:</span>
                <span>{message.sensorData.humidity}%</span>
              </div>
              <div className={styles.chatbotSensorItem}>
                <span>가스농도:</span>
                <span>{message.sensorData.gasConcentration}ppm</span>
              </div>
            </div>
          )}
        </div>
        
        <div className={`${styles.chatbotMessageMeta} ${styles[message.sender]}`}>
          <span className={styles.chatbotMessageTime}>
            {ChatbotUtils.formatTime(message.timestamp)}
          </span>
          <div className={styles.chatbotMessageActions}>
            <button className={styles.chatbotMessageActionButton}>
              <MoreHorizontal size={12} />
            </button>
          </div>
        </div>
      </div>
      
      {!isBot && (
        <div className={`${styles.chatbotMessageAvatar} ${styles.user}`}>A</div>
      )}
    </div>
  );
};

// 알림 드롭다운 컴포넌트 (Dashboard에서 재사용)
const NotificationDropdown: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  notifications: NotificationData['notifications'];
}> = ({ isOpen, onClose, notifications }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.dropdown}>
        <div className={styles.dropdownHeader}>
          <h3 className={styles.dropdownTitle}>알림</h3>
        </div>
        <div className={styles.notificationList}>
          {notifications.length === 0 ? (
            <div className={styles.emptyNotification}>새로운 알림이 없습니다</div>
          ) : (
            notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`${styles.notificationItem} ${!notification.read ? styles.notificationItemUnread : ''}`}
              >
                <p className={styles.notificationMessage}>{notification.message}</p>
                <p className={styles.notificationTimestamp}>{notification.timestamp}</p>
              </div>
            ))
          )}
        </div>
      </div>
      <button 
        onClick={onClose}
        className={styles.dropdownOverlay}
        aria-label="알림 닫기"
      />
    </>
  );
};

// 관리자 드롭다운 컴포넌트 (Dashboard에서 재사용)
const AdminDropdown: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      <div className={styles.adminDropdown}>
        <div className={styles.adminDropdownContent}>
          <button className={styles.adminDropdownItem}>프로필 설정</button>
          <button className={styles.adminDropdownItem}>계정 관리</button>
          <div className={styles.adminDropdownDivider} />
          <button className={`${styles.adminDropdownItem} ${styles.adminDropdownLogout}`}>로그아웃</button>
        </div>
      </div>
      <button 
        onClick={onClose}
        className={styles.dropdownOverlay}
        aria-label="관리자 메뉴 닫기"
      />
    </>
  );
};

interface ChatbotScreenProps {
  onNavigateBack: () => void;
}

const ChatbotScreen: React.FC<ChatbotScreenProps> = ({ onNavigateBack }) => {
  const [chatbotState, setChatbotState] = useState<ChatbotState>({
    messages: [],
    isLoading: false,
    isTyping: false,
    inputMessage: '',
    error: null,
    modelStatus: 'Active'
  });

  const [notificationData, setNotificationData] = useState<NotificationData>({
    count: 0,
    notifications: []
  });
  
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 메시지 영역 스크롤을 맨 아래로
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // 메시지 전송
  const sendMessage = useCallback(async () => {
    const message = chatbotState.inputMessage.trim();
    
    // 메시지 검증
    const validation = ChatbotUtils.validateMessage(message);
    if (!validation.isValid) {
      setChatbotState(prev => ({ ...prev, error: validation.error || null }));
      return;
    }

    // 사용자 메시지 추가
    const userMessage: ChatMessage = {
      id: ChatbotUtils.generateMessageId(),
      message,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setChatbotState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      inputMessage: '',
      isLoading: true,
      isTyping: true,
      error: null
    }));

    try {
      // API 호출 (개발 시에는 목 응답 사용)
      const response = await ChatbotAPI.generateMockResponse(message);
      
      if ('success' in response && response.success) {
        // 타이핑 효과를 위한 지연
        const typingDelay = ChatbotUtils.calculateTypingDelay(response.reply);
        
        setTimeout(() => {
          const botMessage: ChatMessage = {
            id: ChatbotUtils.generateMessageId(),
            message: response.reply,
            sender: 'bot',
            timestamp: response.timestamp,
            sensorData: response.sensorData,
            status: response.status
          };

          setChatbotState(prev => ({
            ...prev,
            messages: [...prev.messages, botMessage],
            isLoading: false,
            isTyping: false
          }));
        }, typingDelay);
      } else {
  const msg = 'error' in response ? response.error : 'Unknown error';
  throw new Error(msg);
}
    } catch (error) {
      setChatbotState(prev => ({
        ...prev,
        isLoading: false,
        isTyping: false,
        error: error instanceof Error ? error.message : '답변을 생성할 수 없습니다.'
      }));
    }
  }, [chatbotState.inputMessage]);

  // 입력 필드 변경 핸들러
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 300) {
      setChatbotState(prev => ({ 
        ...prev, 
        inputMessage: value,
        error: null 
      }));
    }
  }, []);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!chatbotState.isLoading && chatbotState.inputMessage.trim()) {
        sendMessage();
      }
    }
  }, [chatbotState.isLoading, chatbotState.inputMessage, sendMessage]);

  // 알림 데이터 가져오기
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await DashboardAPI.getNotifications();
      setNotificationData(data);
    } catch (error) {
      console.error('알림 데이터 가져오기 실패:', error);
    }
  }, []);

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    // 환영 메시지 추가
    const welcomeMessage = ChatbotUtils.createWelcomeMessage();
    setChatbotState(prev => ({
      ...prev,
      messages: [welcomeMessage]
    }));

    // 알림 데이터 가져오기
    fetchNotifications();

    // 입력 필드에 포커스
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, [fetchNotifications]);

  // 메시지 추가 시 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [chatbotState.messages, chatbotState.isTyping, scrollToBottom]);

  // 메시지 히스토리 저장
  useEffect(() => {
    if (chatbotState.messages.length > 0) {
      ChatbotUtils.saveMessageHistory(chatbotState.messages);
    }
  }, [chatbotState.messages]);

  const canSend = chatbotState.inputMessage.trim().length > 0 && !chatbotState.isLoading;
  const charCount = chatbotState.inputMessage.length;
  const charCountClass = charCount > 250 ? 'error' : charCount > 200 ? 'warning' : '';

  return (
    <div className={styles.container}>
      {/* 사이드바 (Dashboard에서 재사용) */}
      <div className={styles.sidebar}>
        <div className={styles.logoSection}>
          <div className={styles.logoContainer}>
            <div className={styles.logoMain}>AWS²</div>
            <div className={styles.logoAccent}>GIoT</div>
          </div>
          <div className={styles.logoSubtext}>IoT Cloud System</div>
        </div>

        <nav className={styles.navigation}>
          <button className={styles.sidebarItem} onClick={onNavigateBack}>
            <span><MessageCircle size={20} /></span>
            <span>Dashboard</span>
          </button>
          <button className={`${styles.sidebarItem} ${styles.sidebarItemActive}`}>
            <span><MessageCircle size={20} /></span>
            <span>Chatbot</span>
          </button>
          <button className={styles.sidebarItem}>
            <span><MessageCircle size={20} /></span>
            <span>History</span>
          </button>
          <button className={styles.sidebarItem}>
            <span><MessageCircle size={20} /></span>
            <span>Settings</span>
          </button>
          <button className={styles.sidebarItem}>
            <span><MessageCircle size={20} /></span>
            <span>Logout</span>
          </button>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.footerText}>2025 GBSA AWS</div>
        </div>
      </div>

      {/* 메인 컨텐츠 영역 */}
      <div className={styles.mainContent}>
        {/* 상단 헤더 */}
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <div>
              <h1 className={styles.headerTitle}>Chatbot</h1>
              <p className={styles.headerSubtitle}>{new Date().toLocaleString('ko-KR')}</p>
            </div>
            
            <div className={styles.headerActions}>
              {/* 알림 아이콘 */}
              <div className={styles.notificationContainer}>
                <button
                  onClick={() => {
                    setIsNotificationOpen(!isNotificationOpen);
                    setIsAdminMenuOpen(false);
                  }}
                  className={styles.notificationButton}
                >
                  <Bell size={24} />
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

              {/* 관리자 프로필 */}
              <div className={styles.adminContainer}>
                <button
                  onClick={() => {
                    setIsAdminMenuOpen(!isAdminMenuOpen);
                    setIsNotificationOpen(false);
                  }}
                  className={styles.adminButton}
                >
                  <div className={styles.adminAvatar}>
                    <User size={18} style={{ color: 'white' }} />
                  </div>
                  <span className={styles.adminLabel}>Admin</span>
                </button>
                
                <AdminDropdown
                  isOpen={isAdminMenuOpen}
                  onClose={() => setIsAdminMenuOpen(false)}
                />
              </div>
            </div>
          </div>
        </header>

        {/* 챗봇 메인 영역 */}
        <div className={styles.chatbotContainer}>
          {/* 챗봇 헤더 */}
          <div className={styles.chatbotHeader}>
            <div className={styles.chatbotHeaderLeft}>
              <button 
                className={styles.chatbotBackButton}
                onClick={onNavigateBack}
                aria-label="뒤로 가기"
              >
                <ChevronLeft size={20} />
              </button>
              
              <div className={styles.chatbotModelInfo}>
                <div className={styles.chatbotModelName}>Model Name</div>
                <div className={styles.chatbotModelStatus}>
                  <span className={`${styles.chatbotStatusBadge} ${styles[`chatbotStatus${chatbotState.modelStatus}`]}`}>
                    {chatbotState.modelStatus}
                  </span>
                </div>
              </div>
            </div>
            
            <div className={styles.chatbotHeaderActions}>
              <button className={styles.chatbotActionButton} aria-label="인쇄">
                <Printer size={18} />
              </button>
              <button className={styles.chatbotActionButton} aria-label="즐겨찾기">
                <Star size={18} />
              </button>
              <button className={styles.chatbotActionButton} aria-label="삭제">
                <Trash2 size={18} />
              </button>
            </div>
          </div>

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

          {/* 에러 메시지 */}
          {chatbotState.error && (
            <div className={styles.chatbotErrorMessage}>
              {chatbotState.error}
            </div>
          )}

          {/* 입력 영역 */}
          <div className={styles.chatbotInputContainer}>
            <div className={styles.chatbotInputWrapper}>
              <button 
                className={styles.chatbotAttachButton}
                aria-label="파일 첨부"
              >
                <Paperclip size={18} />
              </button>
              
              <div style={{ position: 'relative', flex: 1 }}>
                <textarea
                  ref={inputRef}
                  className={styles.chatbotInputField}
                  value={chatbotState.inputMessage}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Write message"
                  rows={1}
                  disabled={chatbotState.isLoading}
                />
                <div className={`${styles.chatbotCharCounter} ${charCountClass}`}>
                  {charCount}/300
                </div>
              </div>
              
              <button 
                className={styles.chatbotSendButton}
                onClick={sendMessage}
                disabled={!canSend}
                aria-label="메시지 전송"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotScreen;