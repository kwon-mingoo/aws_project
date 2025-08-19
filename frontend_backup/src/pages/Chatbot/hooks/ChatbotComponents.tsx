// src/components/chatbot/ChatbotComponents.tsx

import React from 'react';
import { Send, ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import { ChatMessage } from '../../../services/ChatbotTypes';

// ========== ChatbotHeader ==========
interface ChatbotHeaderProps {
  modelStatus: 'Active' | 'Inactive' | 'Loading';
  onBackClick: () => void;
}

export const ChatbotHeader: React.FC<ChatbotHeaderProps> = ({ 
  modelStatus, 
  onBackClick 
}) => {
  const getStatusColor = () => {
    switch (modelStatus) {
      case 'Active': return '#10b981';
      case 'Loading': return '#f59e0b';
      case 'Inactive': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = () => {
    switch (modelStatus) {
      case 'Active': return <Wifi size={16} />;
      case 'Loading': return <div className="loading-spinner" />;
      case 'Inactive': return <WifiOff size={16} />;
      default: return <WifiOff size={16} />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 24px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: 'white'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onBackClick}
          style={{
            padding: '8px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#f3f4f6',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
          AWS² IoT 공기질 분석 챗봇
        </h2>
      </div>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '20px',
        backgroundColor: '#f3f4f6',
        fontSize: '14px'
      }}>
        <span style={{ color: getStatusColor() }}>
          {getStatusIcon()}
        </span>
        <span style={{ color: getStatusColor(), fontWeight: '500' }}>
          {modelStatus}
        </span>
      </div>
      
      <style>{`
        .loading-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #f3f4f6;
          border-top: 2px solid #f59e0b;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// ========== MessageItem ==========
interface MessageItemProps {
  message: ChatMessage;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Good': return '#10b981';
      case 'Warning': return '#f59e0b';
      case 'Normal': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '';
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '16px'
    }}>
      <div style={{
        maxWidth: '70%',
        padding: '12px 16px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        backgroundColor: isUser ? '#3b82f6' : '#f3f4f6',
        color: isUser ? 'white' : '#1f2937',
        wordWrap: 'break-word'
      }}>
        <div style={{ 
          whiteSpace: 'pre-wrap',
          lineHeight: '1.5'
        }}>
          {message.message}
        </div>
        
        {/* 센서 데이터 표시 */}
        {message.sensorData && !isUser && (
          <div style={{
            marginTop: '8px',
            padding: '8px',
            backgroundColor: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            fontSize: '12px'
          }}>
            <div>🌡️ 온도: {message.sensorData.temperature.toFixed(1)}°C</div>
            <div>💧 습도: {message.sensorData.humidity.toFixed(1)}%</div>
            <div>🌬️ CO2: {message.sensorData.gasConcentration.toFixed(0)}ppm</div>
          </div>
        )}
        
        {/* 상태 및 시간 */}
        <div style={{
          marginTop: '4px',
          fontSize: '11px',
          opacity: 0.7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{formatTime(message.timestamp)}</span>
          {message.status && !isUser && (
            <span style={{
              color: getStatusColor(message.status),
              fontWeight: '500'
            }}>
              ● {message.status}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ========== TypingIndicator ==========
export const TypingIndicator: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'flex-start',
      marginBottom: '16px'
    }}>
      <div style={{
        padding: '12px 16px',
        borderRadius: '18px 18px 18px 4px',
        backgroundColor: '#f3f4f6',
        color: '#6b7280'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>챗봇이 입력 중</span>
          <div className="typing-dots">
            <span>●</span>
            <span>●</span>
            <span>●</span>
          </div>
        </div>
      </div>
      
      <style>{`
        .typing-dots span {
          animation: blink 1.4s infinite both;
          margin: 0 1px;
        }
        
        .typing-dots span:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-dots span:nth-child(3) {
          animation-delay: 0.4s;
        }
        
        @keyframes blink {
          0%, 80%, 100% {
            opacity: 0.3;
          }
          40% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

// ========== ChatbotInput ==========
interface ChatbotInputProps {
  inputMessage: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSendMessage: () => void;
  error: string | null;
}

export const ChatbotInput: React.FC<ChatbotInputProps> = ({
  inputMessage,
  isLoading,
  onInputChange,
  onKeyDown,
  onSendMessage,
  error
}) => {
  return (
    <div style={{
      padding: '20px 24px',
      borderTop: '1px solid #e5e7eb',
      backgroundColor: 'white'
    }}>
      {/* 에러 메시지 */}
      {error && (
        <div style={{
          marginBottom: '12px',
          padding: '8px 12px',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          borderRadius: '6px',
          fontSize: '14px',
          border: '1px solid #fecaca'
        }}>
          {error}
        </div>
      )}
      
      {/* 입력 영역 */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-end'
      }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="메시지를 입력하세요... (예: 현재 온도가 어때?)"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '24px',
              border: '1px solid #d1d5db',
              outline: 'none',
              fontSize: '14px',
              backgroundColor: isLoading ? '#f9fafb' : 'white',
              transition: 'border-color 0.2s',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#d1d5db';
            }}
          />
        </div>
        
        <button
          onClick={onSendMessage}
          disabled={isLoading || !inputMessage.trim()}
          style={{
            padding: '12px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: (isLoading || !inputMessage.trim()) ? '#d1d5db' : '#3b82f6',
            color: 'white',
            cursor: (isLoading || !inputMessage.trim()) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s',
            minWidth: '44px',
            minHeight: '44px'
          }}
        >
          <Send size={20} />
        </button>
      </div>
      
      {/* 도움말 텍스트 */}
      <div style={{
        marginTop: '8px',
        fontSize: '12px',
        color: '#6b7280',
        textAlign: 'center'
      }}>
        Enter를 눌러 전송하거나 센서 상태를 물어보세요
      </div>
    </div>
  );
};