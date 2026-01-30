import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Mail, Bell, CreditCard, Star, Gift, Users, 
  HelpCircle, MessageCircle, Globe, LogOut, ChevronRight, Sun, Moon, 
  Settings, BarChart3, FileText, AlarmClock, School, UserPlus, Loader, X,
  CheckCircle, Diamond
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './ProfilePage.css';

const ProfilePage = () => {
  const [notifications, setNotifications] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);

  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    fetchReminders();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(response.data.unread_count || 0);
    } catch (err) {
      // Silent fail
    }
  };

  const fetchReminders = async () => {
    try {
      const response = await api.get('/reminders');
      setReminders(response.data.reminders || []);
    } catch (err) {
      // Silent fail
    }
  };

  const handleLogout = () => {
    if (window.confirm(t('messages.confirm.logout'))) {
      logout();
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactSubject.trim() || !contactMessage.trim()) {
      showError(t('forms.validation.fill_all_fields'));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/contact', {
        subject: contactSubject,
        message: contactMessage,
        category: 'general'
      });
      setContactSuccess(true);
      setContactSubject('');
      setContactMessage('');
      setTimeout(() => {
        setContactSuccess(false);
        setShowContact(false);
      }, 2000);
    } catch (err) {
      showError(t('messages.errors.failed_to_send'));
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'consumer': return t('pages.profile.parent_guardian');
      case 'tutor': return t('pages.profile.tutor_instructor');
      case 'admin': return t('pages.profile.administrator');
      default: return role;
    }
  };

  const MenuItem = ({ icon: Icon, label, badge, badgeColor, onClick, to, iconColor }) => {
    const content = (
      <>
        <div className="menu-item-left">
          <Icon size={22} color={iconColor || colors.primary} />
          <span style={{ color: colors.text }}>{label}</span>
        </div>
        <div className="menu-item-right">
          {badge > 0 && (
            <span className="menu-badge" style={{ backgroundColor: badgeColor || colors.error }}>
              {badge}
            </span>
          )}
          <ChevronRight size={20} color={colors.textMuted} />
        </div>
      </>
    );

    if (to) {
      return (
        <Link to={to} className="menu-item" data-testid={`menu-${to.replace(/\//g, '-')}`}>
          {content}
        </Link>
      );
    }

    return (
      <button className="menu-item" onClick={onClick} data-testid={`menu-btn-${label.toLowerCase().replace(/\s/g, '-')}`}>
        {content}
      </button>
    );
  };

  return (
    <div className="profile-page" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <header className="profile-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <h1 style={{ color: colors.text }}>{t('pages.profile.account_title')}</h1>
          <button 
            className="notification-btn" 
            onClick={() => setShowNotifications(true)}
            style={{ backgroundColor: colors.gray100 }}
            data-testid="notifications-btn"
          >
            <Bell size={22} color={colors.text} />
            {unreadCount > 0 && (
              <span className="notification-badge" style={{ backgroundColor: colors.error }}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="profile-main">
        <div className="profile-container">
          {/* User Header */}
          <div className="user-header">
            <div className="user-avatar" style={{ backgroundColor: colors.primary }}>
              {user?.profile_picture ? (
                <img src={user.profile_picture} alt={user.name} />
              ) : (
                <span style={{ color: colors.textInverse }}>
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              )}
            </div>
            <div className="user-info">
              <h2 style={{ color: colors.text }}>{user?.name}</h2>
              <p style={{ color: colors.textMuted }}>{getRoleDisplay(user?.role)}</p>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <h3 className="section-title" style={{ color: colors.text }}>{t('pages.settings.appearance')}</h3>
            <button className="menu-item" onClick={toggleTheme} data-testid="theme-toggle">
              <div className="menu-item-left">
                {isDark ? <Moon size={22} color={colors.primary} /> : <Sun size={22} color={colors.primary} />}
                <span style={{ color: colors.text }}>
                  {isDark ? t('pages.profile.dark_mode') : t('pages.profile.light_mode')}
                </span>
              </div>
              <div className="toggle-switch" style={{ backgroundColor: isDark ? colors.primary : colors.gray300 }}>
                <div className="toggle-knob" style={{ transform: isDark ? 'translateX(22px)' : 'translateX(0)' }} />
              </div>
            </button>
          </div>

          {/* Reminders Section */}
          {reminders.length > 0 && (
            <button 
              className="section reminders-section" 
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              onClick={() => setShowReminders(true)}
              data-testid="reminders-section"
            >
              <div className="section-header-row">
                <h3 className="section-title" style={{ color: colors.text }}>{t('navigation.reminders')}</h3>
                <span className="reminder-badge" style={{ backgroundColor: colors.warning }}>
                  {reminders.length}
                </span>
              </div>
              {reminders.slice(0, 2).map((reminder, idx) => (
                <div key={idx} className="reminder-item">
                  <AlarmClock size={18} color={reminder.priority === 'high' ? colors.error : colors.warning} />
                  <span style={{ color: colors.text }}>{reminder.message}</span>
                </div>
              ))}
            </button>
          )}

          {/* Account Section */}
          <div className="section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <h3 className="section-title" style={{ color: colors.text }}>{t('pages.profile.account_title')}</h3>
            
            <MenuItem icon={User} label={t('pages.profile.edit_profile')} to="/edit-profile" />
            <MenuItem icon={Bell} label={t('pages.profile.notifications')} badge={unreadCount} to="/notifications-settings" />
            <MenuItem icon={Diamond} label={t('subscription.title')} iconColor={colors.warning} to="/subscription" />
            <MenuItem icon={AlarmClock} label={t('navigation.reminders')} badge={reminders.length} badgeColor={colors.warning} to="/reminders" />
            <MenuItem icon={Star} label={t('navigation.reviews')} to="/reviews" />
            <MenuItem icon={CreditCard} label={t('navigation.billing')} to="/billing" />
            <MenuItem icon={BarChart3} label={t('navigation.reports')} to="/reports" />
            <MenuItem icon={FileText} label={t('navigation.tax_reports')} to="/tax-reports" />
            <MenuItem icon={Gift} label={t('navigation.referrals')} to="/referrals" />
            <MenuItem icon={Users} label={t('navigation.invite_parents')} to="/invite-parent" />
            <MenuItem icon={UserPlus} label={t('navigation.invite_providers')} to="/invite-provider" />
            
            {user?.role === 'consumer' && (
              <MenuItem icon={School} label={t('navigation.become_coach')} to="/become-tutor" />
            )}
          </div>

          {/* Support Section */}
          <div className="section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <h3 className="section-title" style={{ color: colors.text }}>{t('pages.profile.support')}</h3>
            
            <MenuItem icon={MessageCircle} label={t('buttons.contact_us')} onClick={() => setShowContact(true)} />
            <MenuItem icon={HelpCircle} label={t('navigation.help_center')} to="/faq" />
            <MenuItem icon={Globe} label={t('pages.settings.language')} to="/language" />
          </div>

          {/* Logout Button */}
          <button 
            className="logout-btn"
            onClick={handleLogout}
            style={{ backgroundColor: colors.errorLight }}
            data-testid="logout-btn"
          >
            <LogOut size={22} color={colors.error} />
            <span style={{ color: colors.error }}>{t('navigation.logout')}</span>
          </button>

          <p className="version-text" style={{ color: colors.textMuted }}>
            {t('pages.profile.version')} 1.0.0
          </p>
        </div>
      </main>

      {/* Notifications Modal */}
      {showNotifications && (
        <div className="modal-overlay" onClick={() => setShowNotifications(false)}>
          <div 
            className="modal-sheet" 
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" style={{ backgroundColor: colors.gray300 }} />
            <div className="modal-header">
              <h2 style={{ color: colors.text }}>{t('pages.profile.notifications')}</h2>
              <button onClick={() => setShowNotifications(false)}>
                <X size={24} color={colors.text} />
              </button>
            </div>
            <div className="modal-content">
              {notifications.length === 0 ? (
                <p className="empty-text" style={{ color: colors.textMuted }}>
                  {t('empty_states.no_notifications')}
                </p>
              ) : (
                notifications.map((notif, idx) => (
                  <div 
                    key={idx} 
                    className={`notif-item ${!notif.read ? 'unread' : ''}`}
                    style={{ backgroundColor: !notif.read ? colors.primaryLight : 'transparent' }}
                  >
                    <Bell size={24} color={colors.primary} />
                    <div className="notif-content">
                      <h4 style={{ color: colors.text }}>{notif.title}</h4>
                      <p style={{ color: colors.textMuted }}>{notif.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reminders Modal */}
      {showReminders && (
        <div className="modal-overlay" onClick={() => setShowReminders(false)}>
          <div 
            className="modal-sheet" 
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" style={{ backgroundColor: colors.gray300 }} />
            <div className="modal-header">
              <h2 style={{ color: colors.text }}>{t('navigation.reminders')}</h2>
              <button onClick={() => setShowReminders(false)}>
                <X size={24} color={colors.text} />
              </button>
            </div>
            <div className="modal-content">
              {reminders.length === 0 ? (
                <p className="empty-text" style={{ color: colors.textMuted }}>
                  {t('empty_states.no_reminders')}
                </p>
              ) : (
                reminders.map((reminder, idx) => (
                  <div 
                    key={idx} 
                    className="notif-item reminder"
                    style={{ borderLeftColor: reminder.priority === 'high' ? colors.error : colors.warning }}
                  >
                    <AlarmClock size={24} color={reminder.priority === 'high' ? colors.error : colors.warning} />
                    <div className="notif-content">
                      <h4 style={{ color: colors.text }}>{reminder.title}</h4>
                      <p style={{ color: colors.textMuted }}>{reminder.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {showContact && (
        <div className="modal-overlay" onClick={() => !contactSuccess && setShowContact(false)}>
          <div 
            className="modal-sheet" 
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" style={{ backgroundColor: colors.gray300 }} />
            
            {contactSuccess ? (
              <div className="success-container">
                <CheckCircle size={64} color={colors.success} />
                <h2 style={{ color: colors.text }}>{t('pages.contact.success_title')}</h2>
                <p style={{ color: colors.textMuted }}>{t('pages.contact.success_message')}</p>
              </div>
            ) : (
              <>
                <button className="close-btn" onClick={() => setShowContact(false)}>
                  <X size={24} color={colors.textMuted} />
                </button>
                <div className="sheet-header">
                  <Mail size={24} color={isDark ? colors.accent : colors.primary} />
                  <h2 style={{ color: colors.text }}>{t('pages.contact.title')}</h2>
                </div>
                
                <form onSubmit={handleContactSubmit} className="contact-form">
                  <div className="form-group">
                    <label style={{ color: colors.textMuted }}>{t('pages.contact.subject')}</label>
                    <input
                      type="text"
                      placeholder={t('pages.contact.subject_placeholder')}
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: colors.textMuted }}>{t('pages.contact.message')}</label>
                    <textarea
                      placeholder={t('pages.contact.message_placeholder')}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      rows={4}
                      style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="submit-btn"
                    disabled={submitting}
                    style={{ backgroundColor: colors.primary }}
                  >
                    {submitting ? <Loader className="spinner" size={20} /> : t('pages.contact.send_message')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
