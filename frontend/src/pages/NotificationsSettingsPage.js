import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Mail, MessageSquare, Volume2, Loader } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './NotificationsSettingsPage.css';

const NotificationsSettingsPage = () => {
  const [settings, setSettings] = useState({
    push_enabled: true,
    email_enabled: true,
    sms_enabled: false,
    booking_reminders: true,
    marketing_emails: false,
    session_updates: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/user/notification-settings');
      setSettings(response.data || settings);
    } catch (err) {
      // Use defaults
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    try {
      setSaving(true);
      await api.put('/user/notification-settings', newSettings);
      showSuccess(t('messages.success.settings_saved'));
    } catch (err) {
      setSettings(settings);
      showError(t('messages.errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const ToggleRow = ({ icon: Icon, title, subtitle, settingKey }) => (
    <div className="setting-row" style={{ borderColor: colors.border }}>
      <div className="setting-icon" style={{ backgroundColor: colors.primaryLight }}>
        <Icon size={20} color={colors.primary} />
      </div>
      <div className="setting-info">
        <h4 style={{ color: colors.text }}>{title}</h4>
        {subtitle && <p style={{ color: colors.textMuted }}>{subtitle}</p>}
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={settings[settingKey]}
          onChange={(e) => updateSetting(settingKey, e.target.checked)}
        />
        <span className="toggle-slider" style={{ backgroundColor: settings[settingKey] ? colors.primary : colors.gray300 }} />
      </label>
    </div>
  );

  if (loading) {
    return (
      <div className="notifications-settings-page" style={{ backgroundColor: colors.background }}>
        <div className="loading-state">
          <Loader className="spinner" size={32} color={colors.primary} />
        </div>
      </div>
    );
  }

  return (
    <div className="notifications-settings-page" style={{ backgroundColor: colors.background }}>
      <header className="page-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate(-1)} style={{ color: colors.text }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ color: colors.text }}>{t('pages.settings.notifications')}</h1>
          {saving && <Loader className="spinner" size={20} color={colors.primary} />}
        </div>
      </header>

      <main className="page-main">
        <div className="page-container">
          <div className="settings-section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <h3 style={{ color: colors.text }}>Notification Channels</h3>
            <ToggleRow
              icon={Bell}
              title={t('pages.settings.push_notifications')}
              subtitle="Receive push notifications on your device"
              settingKey="push_enabled"
            />
            <ToggleRow
              icon={Mail}
              title={t('pages.settings.email_notifications')}
              subtitle="Receive important updates via email"
              settingKey="email_enabled"
            />
            <ToggleRow
              icon={MessageSquare}
              title={t('pages.settings.sms_notifications')}
              subtitle="Receive SMS for urgent updates"
              settingKey="sms_enabled"
            />
          </div>

          <div className="settings-section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <h3 style={{ color: colors.text }}>Notification Types</h3>
            <ToggleRow
              icon={Volume2}
              title="Booking Reminders"
              subtitle="Get reminded before your sessions"
              settingKey="booking_reminders"
            />
            <ToggleRow
              icon={Bell}
              title="Session Updates"
              subtitle="Changes to your bookings"
              settingKey="session_updates"
            />
            <ToggleRow
              icon={Mail}
              title="Marketing Emails"
              subtitle="Promotions and news"
              settingKey="marketing_emails"
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default NotificationsSettingsPage;
