import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Bot, User, Loader2, Trash2, AlertCircle, X, Minimize2
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './ChatWindow.css';

export default function ChatWindow({ onClose }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showError } = useToast();
  const { t } = useTranslation();
  
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!isMinimized) {
      inputRef.current?.focus();
    }
  }, [isMinimized]);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0 && !sessionId) {
      setMessages([{
        role: 'assistant',
        content: t('chat.ask_maestro_welcome') || 
          "Hi! I'm Maestro, your personal assistant. I can help you with:\n\n• Finding and booking sessions with coaches\n• Understanding subscription plans\n• Account settings and profile\n• Connecting with your coach\n\nHow can I help you today?",
        timestamp: new Date().toISOString()
      }]);
    }
  }, [messages.length, sessionId, t]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);

    try {
      const response = await api.post('/chat/message', {
        message: userMessage,
        session_id: sessionId
      });

      if (response.data.session_id && !sessionId) {
        setSessionId(response.data.session_id);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      showError(t('chat.error_sending') || 'Failed to send message');
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('chat.error_response') || 
          "I'm having trouble responding. For immediate help, please contact your coach directly or use the Contact Us option.",
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    if (sessionId) {
      try {
        await api.delete(`/chat/session/${sessionId}`);
      } catch (error) {
        console.error('Failed to clear chat:', error);
      }
    }
    setMessages([{
      role: 'assistant',
      content: t('chat.ask_maestro_welcome') || 
        "Hi! I'm Maestro, your personal assistant. How can I help you today?",
      timestamp: new Date().toISOString()
    }]);
    setSessionId(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      return new Date(timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '';
    }
  };

  // Minimized state
  if (isMinimized) {
    return (
      <div 
        className="chat-window-minimized"
        style={{ backgroundColor: colors.primary }}
        onClick={() => setIsMinimized(false)}
      >
        <Bot size={20} color="#fff" />
        <span style={{ color: '#fff', fontWeight: 600 }}>Ask Maestro</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="chat-min-close"
        >
          <X size={18} color="#fff" />
        </button>
      </div>
    );
  }

  return (
    <div className="chat-window-overlay" onClick={onClose}>
      <div 
        className="chat-window" 
        style={{ backgroundColor: colors.surface }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="chat-window-header" style={{ backgroundColor: colors.primary }}>
          <div className="chat-header-info">
            <Bot size={24} color="#fff" />
            <div>
              <h3 style={{ color: '#fff', margin: 0, fontSize: '16px', fontWeight: 600 }}>
                Ask Maestro
              </h3>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                {t('chat.available') || 'Always available to help'}
              </span>
            </div>
          </div>
          <div className="chat-header-actions">
            <button 
              onClick={handleClearChat}
              className="chat-action-btn"
              title={t('chat.clear') || 'Clear chat'}
            >
              <Trash2 size={18} color="#fff" />
            </button>
            <button 
              onClick={() => setIsMinimized(true)}
              className="chat-action-btn"
              title={t('chat.minimize') || 'Minimize'}
            >
              <Minimize2 size={18} color="#fff" />
            </button>
            <button 
              onClick={onClose}
              className="chat-action-btn"
              title={t('common.close') || 'Close'}
            >
              <X size={18} color="#fff" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-window-messages" style={{ backgroundColor: colors.background }}>
          {loading ? (
            <div className="chat-loading">
              <Loader2 size={24} color={colors.primary} className="spinner" />
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div 
                  key={index}
                  className={`chat-message ${msg.role === 'user' ? 'user' : 'assistant'}`}
                >
                  <div 
                    className="message-avatar"
                    style={{ 
                      backgroundColor: msg.role === 'user' ? colors.primary : colors.accent 
                    }}
                  >
                    {msg.role === 'user' ? (
                      <User size={16} color="#fff" />
                    ) : (
                      <Bot size={16} color="#fff" />
                    )}
                  </div>
                  <div 
                    className={`message-bubble ${msg.isError ? 'error' : ''}`}
                    style={{ 
                      backgroundColor: msg.role === 'user' ? colors.primary : colors.surface,
                      color: msg.role === 'user' ? '#fff' : colors.text,
                      borderColor: msg.isError ? colors.error : colors.border
                    }}
                  >
                    <p style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                    <span 
                      className="message-time"
                      style={{ 
                        color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : colors.textMuted 
                      }}
                    >
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              
              {sending && (
                <div className="chat-message assistant">
                  <div 
                    className="message-avatar"
                    style={{ backgroundColor: colors.accent }}
                  >
                    <Bot size={16} color="#fff" />
                  </div>
                  <div 
                    className="message-bubble typing"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  >
                    <div className="typing-indicator">
                      <span style={{ backgroundColor: colors.textMuted }}></span>
                      <span style={{ backgroundColor: colors.textMuted }}></span>
                      <span style={{ backgroundColor: colors.textMuted }}></span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Disclaimer */}
        <div className="chat-disclaimer" style={{ backgroundColor: colors.warningLight || '#FEF3C7' }}>
          <AlertCircle size={14} color={colors.warning || '#D97706'} />
          <span style={{ color: colors.warning || '#D97706' }}>
            {t('chat.disclaimer') || 'For personalized advice, please message your coach directly.'}
          </span>
        </div>

        {/* Input */}
        <div className="chat-input-container" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
          <textarea
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('chat.placeholder') || 'Type your message...'}
            disabled={sending}
            rows={1}
            style={{ 
              backgroundColor: colors.background,
              color: colors.text,
              borderColor: colors.border
            }}
            data-testid="chat-input"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || sending}
            className="chat-send-btn"
            style={{ backgroundColor: colors.primary }}
            data-testid="chat-send-btn"
          >
            {sending ? (
              <Loader2 size={20} color="#fff" className="spinner" />
            ) : (
              <Send size={20} color="#fff" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
