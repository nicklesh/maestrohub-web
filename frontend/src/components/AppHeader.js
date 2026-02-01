import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Mail, LogOut, ArrowLeft, X, Loader2, MessageCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import ChatWindow from './ChatWindow';
import './AppHeader.css';

export default function AppHeader({ showBack = false, title = '', showUserName = false }) {
  const { user, logout, token } = useAuth();
  const { colors, isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [showContactSheet, setShowContactSheet] = useState(false);
  const [showChatWindow, setShowChatWindow] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        if (!token) return;
        
        const response = await api.get('/notifications');
        const notifications = response.data || [];
        const unread = notifications.filter(n => !n.read).length;
        setUnreadCount(unread);
      } catch (error) {
        console.log('Failed to fetch notifications count');
      }
    };
    
    fetchUnreadCount();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'consumer': return t('roles.parent');
      case 'tutor': return t('roles.tutor');
      case 'admin': return t('roles.admin');
      default: return role;
    }
  };

  const handleLogoPress = () => {
    if (user?.role === 'tutor') {
      navigate('/tutor/dashboard');
    } else if (user?.role === 'admin') {
      navigate('/admin/dashboard');
    } else {
      navigate('/home');
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      handleLogoPress();
    }
  };

  const handleLogout = async () => {
    const confirmed = window.confirm(t('modals.logout.message') || 'Are you sure you want to logout?');
    if (confirmed) {
      try {
        await logout();
      } catch (error) {
        console.error('Logout error:', error);
      }
      navigate('/login');
    }
  };

  const handleNotificationsClick = () => {
    if (user?.role === 'tutor') {
      navigate('/tutor/notifications');
    } else {
      navigate('/notifications');
    }
  };

  const handleContactSubmit = async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) {
      showError(t('messages.errors.fill_all_fields') || 'Please fill in all fields');
      return;
    }

    setSubmittingContact(true);
    try {
      await api.post('/contact', {
        subject: contactSubject,
        message: contactMessage,
        category: 'general'
      });
      
      showSuccess(t('messages.success.message_sent') || 'Your message has been sent!');
      setShowContactSheet(false);
      setContactSubject('');
      setContactMessage('');
    } catch (error) {
      showError(t('messages.errors.generic') || 'Failed to send message');
    } finally {
      setSubmittingContact(false);
    }
  };

  // Gold color for dark mode envelope
  const envelopeColor = isDark ? '#D4AF37' : colors.text;

  // Choose logo based on theme
  const logoSrc = isDark ? '/mh_logo_dark_trimmed.png' : '/mh_logo_trimmed.png';

  return (
    <>
      <header className="app-header" style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}>
        <div className="header-inner">
          {/* Left - Back Button OR User Info */}
          <div className="header-left">
            {showBack ? (
              <div className="back-container">
                <button onClick={handleBack} className="back-button" data-testid="header-back-btn">
                  <ArrowLeft size={24} color={colors.text} />
                </button>
                {(showUserName && title) && (
                  <span className="header-title" style={{ color: colors.text }}>{title}</span>
                )}
                {(showUserName && !title && user?.name) && (
                  <span className="header-title" style={{ color: colors.text }}>{user.name}</span>
                )}
              </div>
            ) : (
              <div className="user-info">
                <div className="user-avatar" style={{ backgroundColor: colors.primary }} data-testid="header-user-avatar">
                  <span className="user-avatar-text">{user?.name?.charAt(0) || 'U'}</span>
                </div>
                <div className="user-details">
                  <span className="user-name" style={{ color: colors.text }}>
                    {user?.name?.split(' ')[0] || 'User'}
                  </span>
                  <span className="user-role" style={{ color: colors.textMuted }}>
                    {getRoleDisplay(user?.role || '')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Center - Logo */}
          <button onClick={handleLogoPress} className="logo-container" data-testid="header-logo">
            <img src={logoSrc} alt="Maestro Habitat" className="header-logo" />
          </button>

          {/* Right - Actions */}
          <div className="header-right">
            {/* Notification Bell - only for non-admin users */}
            {user?.role !== 'admin' && (
              <button 
                onClick={handleNotificationsClick}
                className="icon-button"
                style={{ backgroundColor: colors.background }}
                data-testid="header-notifications-btn"
              >
                <Bell size={20} color={colors.primary} />
                {unreadCount > 0 && (
                  <span className="notification-badge" style={{ backgroundColor: colors.error }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}
            
            {/* Contact Us - hide for admin */}
            {user?.role !== 'admin' && (
              <button 
                onClick={() => setShowContactSheet(true)}
                className="icon-button"
                style={{ backgroundColor: colors.background }}
                data-testid="header-contact-btn"
              >
                <Mail size={20} color={envelopeColor} />
              </button>
            )}
            
            {/* Logout */}
            <button 
              onClick={handleLogout}
              className="icon-button"
              style={{ backgroundColor: colors.background }}
              data-testid="header-logout-btn"
            >
              <LogOut size={20} color={colors.error} />
            </button>
          </div>
        </div>
      </header>

      {/* Contact Us Bottom Sheet */}
      {showContactSheet && (
        <div className="modal-overlay" onClick={() => setShowContactSheet(false)}>
          <div 
            className="bottom-sheet" 
            style={{ backgroundColor: colors.surface }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sheet-handle" style={{ backgroundColor: colors.gray300 }} />
            
            <button 
              className="sheet-close-button"
              onClick={() => setShowContactSheet(false)}
            >
              <X size={24} color={colors.textMuted} />
            </button>
            
            <div className="sheet-header">
              <Mail size={24} color={colors.primary} />
              <h3 style={{ color: colors.text }}>{t('modals.contact_us.title')}</h3>
            </div>
            
            <label className="input-label" style={{ color: colors.textMuted }}>
              {t('modals.contact_us.subject')}
            </label>
            <input
              type="text"
              className="sheet-input"
              style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
              placeholder={t('modals.contact_us.subject_placeholder')}
              value={contactSubject}
              onChange={e => setContactSubject(e.target.value)}
            />
            
            <label className="input-label" style={{ color: colors.textMuted }}>
              {t('modals.contact_us.message')}
            </label>
            <textarea
              className="sheet-input sheet-textarea"
              style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
              placeholder={t('modals.contact_us.message_placeholder')}
              value={contactMessage}
              onChange={e => setContactMessage(e.target.value)}
              rows={4}
            />
            
            <button 
              className="submit-button"
              style={{ backgroundColor: colors.primary }}
              onClick={handleContactSubmit}
              disabled={submittingContact}
            >
              {submittingContact ? (
                <Loader2 size={20} className="spinner" />
              ) : (
                t('modals.contact_us.send')
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
