import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Bot, User, Loader2, Trash2, AlertCircle, 
  MessageSquare, X, Minimize2, Maximize2
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './ChatWidget.css';

export default function ChatWidget() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { showError } = useToast();
  const { t } = useTranslation();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Load chat history if session exists
  const loadChatHistory = useCallback(async (sid) => {
    if (!sid) return;
    setLoading(true);
    try {
      const response = await api.get(`/chat/history/${sid}`);
      if (response.data.messages) {
        setMessages(response.data.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.created_at
        })));
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0 && !sessionId) {
      setMessages([{
        role: 'assistant',
        content: t('chat.welcome_message') || 
          "Hi there! 👋 I'm your Maestro Habitat assistant. I can help you with:\n\n• Booking sessions with coaches\n• Understanding subscription plans\n• Account and profile settings\n• Finding the right coach\n\nHow can I help you today?",
        timestamp: new Date().toISOString()
      }]);
    }
  }, [isOpen, messages.length, sessionId, t]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    // Add user message immediately
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

      // Update session ID
      if (response.data.session_id && !sessionId) {
        setSessionId(response.data.session_id);
      }

      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.data.response,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.error('Chat error:', error);
      showError(t('chat.error_sending') || 'Failed to send message. Please try again.');
      
      // Add error message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('chat.error_response') || 
          "I'm sorry, I'm having trouble responding right now. Please try again or contact your coach for immediate assistance.",
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    try {
      await api.delete(`/chat/session/${sessionId}`);
      setMessages([]);
      setSessionId(null);
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
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

  // Chat bubble button (always visible)
  if (!isOpen) {
    return (
      <button
        className="chat-bubble-btn"
        onClick={() => setIsOpen(true)}
        style={{ backgroundColor: colors.primary }}
        data-testid="chat-bubble-btn"
        aria-label="Open chat"
      >
        <MessageSquare size={24} color="#fff" />
        <span className="chat-bubble-label">
          {t('chat.help') || 'Help'}
        </span>
      </button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div 
        className="chat-minimized"
        style={{ backgroundColor: colors.primary }}
        onClick={() => setIsMinimized(false)}
      >
        <MessageSquare size={20} color="#fff" />
        <span style={{ color: '#fff', fontWeight: 600 }}>
          {t('chat.title') || 'Chat Support'}
        </span>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
          className="chat-close-btn"
        >
          <X size={18} color="#fff" />
        </button>
      </div>
    );
  }

  // Full chat widget
  return (
    <div className="chat-widget" style={{ backgroundColor: colors.surface }}>
      {/* Header */}
      <div className="chat-header" style={{ backgroundColor: colors.primary }}>
        <div className="chat-header-info">
          <Bot size={24} color="#fff" />
          <div>
            <h3 style={{ color: '#fff', margin: 0, fontSize: '16px', fontWeight: 600 }}>
              {t('chat.title') || 'Chat Support'}
            </h3>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
              {t('chat.available') || 'Always available'}
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
            onClick={() => setIsOpen(false)}
            className="chat-action-btn"
            title={t('common.close') || 'Close'}
          >
            <X size={18} color="#fff" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages" style={{ backgroundColor: colors.background }}>
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
                    borderColor: msg.isError ? colors.error : 'transparent'
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
                  style={{ backgroundColor: colors.surface }}
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
          {t('chat.disclaimer') || 'For personalized advice, please contact your coach directly.'}
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
  );
}
