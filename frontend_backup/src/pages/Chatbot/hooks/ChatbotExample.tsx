// src/components/examples/ChatbotExample.tsx
// 간단한 챗봇 사용 예시 컴포넌트

import React from 'react';
import { useChatbot } from '../../../services/UseChatbot';
import { ChatbotUtils } from '../../../services/ChatbotTypes';

const ChatbotExample: React.FC = () => {
  const {
    chatbotState,
    messagesEndRef,
    sendMessage,
    handleInputChange,
    handleKeyDown,
    retryConnection,
    clearHistory,
  } = useChatbot();

  const quickQuestions = [
    "현재 온도가 어때?",
    "습도는 어떻게 되지?",
    "공기질 상태는?",
    "센서 데이터 보여줘"
  ];

  const handleQuickQuestion = (question: string) => {
    sendMessage(question);
  };

  return (
    <div style={{ 
      maxWidth: '800px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h2>챗봇 API 연동 예시</h2>
      
      {/* 연결 상태 표시 */}
      <div style={{ 
        padding: '10px', 
        marginBottom: '20px',
        borderRadius: '5px',
        backgroundColor: chatbotState.isConnected ? '#d4edda' : '#f8d7da',
        color: chatbotState.isConnected ? '#155724' : '#721c24',
        border: `1px solid ${chatbotState.isConnected ? '#c3e6cb' : '#f5c6cb'}`
      }}>
        <strong>연결 상태:</strong> {chatbotState.modelStatus}
        {!chatbotState.isConnected && (
          <button 
            onClick={retryConnection}
            style={{ marginLeft: '10px', padding: '5px 10px' }}
          >
            재연결
          </button>
        )}
      </div>

      {/* 빠른 질문 버튼들 */}
      <div style={{ marginBottom: '20px' }}>
        <h4>빠른 질문:</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {quickQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleQuickQuestion(question)}
              disabled={chatbotState.isLoading}
              style={{
                padding: '8px 12px',
                borderRadius: '20px',
                border: '1px solid #007bff',
                backgroundColor: '#007bff',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      {/* 메시지 영역 */}
      <div style={{ 
        height: '400px', 
        overflowY: 'auto',
        border: '1px solid #ccc',
        borderRadius: '5px',
        padding: '15px',
        marginBottom: '15px',
        backgroundColor: '#f9f9f9'
      }}>
        {chatbotState.messages.map((message) => (
          <div 
            key={message.id}
            style={{
              marginBottom: '15px',
              display: 'flex',
              flexDirection: message.sender === 'user' ? 'row-reverse' : 'row'
            }}
          >
            <div style={{
              maxWidth: '70%',
              padding: '10px 15px',
              borderRadius: '18px',
              backgroundColor: message.sender === 'user' ? '#007bff' : '#e9ecef',
              color: message.sender === 'user' ? 'white' : 'black',
              wordWrap: 'break-word'
            }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {message.message}
              </div>
              
              {/* 센서 데이터 표시 */}
              {message.sensorData && (
                <div style={{ 
                  marginTop: '10px', 
                  fontSize: '12px',
                  opacity: 0.8,
                  borderTop: '1px solid rgba(255,255,255,0.3)',
                  paddingTop: '8px'
                }}>
                  🌡️ {message.sensorData.temperature.toFixed(1)}°C | 
                  💧 {message.sensorData.humidity.toFixed(1)}% | 
                  🌬️ {message.sensorData.gasConcentration.toFixed(0)}ppm
                </div>
              )}
              
              <div style={{ 
                marginTop: '5px', 
                fontSize: '10px', 
                opacity: 0.7 
              }}>
                {ChatbotUtils.formatTime(message.timestamp)}
              </div>
            </div>
          </div>
        ))}
        
        {/* 타이핑 인디케이터 */}
        {chatbotState.isTyping && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <div style={{
              padding: '10px 15px',
              borderRadius: '18px',
              backgroundColor: '#e9ecef',
              color: '#6c757d'
            }}>
              <span>챗봇이 입력 중</span>
              <span style={{ animation: 'blink 1s infinite' }}>...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 에러 메시지 */}
      {chatbotState.error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '5px',
          marginBottom: '15px'
        }}>
          <strong>오류:</strong> {chatbotState.error}
        </div>
      )}

      {/* 입력 영역 */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={chatbotState.inputMessage}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메시지를 입력하세요..."
          disabled={chatbotState.isLoading}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: '25px',
            border: '1px solid #ccc',
            outline: 'none',
            fontSize: '14px'
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={chatbotState.isLoading || !chatbotState.inputMessage.trim()}
          style={{
            padding: '12px 20px',
            borderRadius: '25px',
            border: 'none',
            backgroundColor: '#007bff',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            minWidth: '80px'
          }}
        >
          {chatbotState.isLoading ? '전송 중...' : '전송'}
        </button>
        <button
          onClick={clearHistory}
          style={{
            padding: '12px 15px',
            borderRadius: '25px',
            border: '1px solid #6c757d',
            backgroundColor: 'white',
            color: '#6c757d',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          초기화
        </button>
      </div>

      {/* 디버그 정보 (개발 모드) */}
      {process.env.NODE_ENV === 'development' && (
        <details style={{ marginTop: '20px' }}>
          <summary style={{ cursor: 'pointer', padding: '10px' }}>
            디버그 정보
          </summary>
          <pre style={{ 
            backgroundColor: '#f8f9fa', 
            padding: '15px', 
            borderRadius: '5px',
            fontSize: '12px',
            overflow: 'auto'
          }}>
            {JSON.stringify({
              messageCount: chatbotState.messages.length,
              isLoading: chatbotState.isLoading,
              isTyping: chatbotState.isTyping,
              modelStatus: chatbotState.modelStatus,
              isConnected: chatbotState.isConnected,
              error: chatbotState.error,
              inputLength: chatbotState.inputMessage.length
            }, null, 2)}
          </pre>
        </details>
      )}

      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
          }
        `}
      </style>
    </div>
  );
};

export default ChatbotExample;