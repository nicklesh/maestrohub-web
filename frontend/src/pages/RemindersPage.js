import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlarmClock, Calendar, CreditCard, Bell, Loader2, 
  Clock, Settings, ChevronRight 
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import api from '../services/api';

export default function RemindersPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  
  const [reminders, setReminders] = useState([]);
  const [config, setConfig] = useState({
    session_reminder_hours: 1,
    payment_reminder_days: 1,
    weekly_summary: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sessionHourOptions = [1, 2, 4, 12, 24];
  const paymentDayOptions = [1, 3, 7];

  const loadData = useCallback(async () => {
    try {
      const [remindersRes, configRes] = await Promise.all([
        api.get('/reminders').catch(() => ({ data: { reminders: [] } })),
        api.get('/reminders/config').catch(() => ({ data: null }))
      ]);
      setReminders(remindersRes.data.reminders || []);
      if (configRes.data) {
        setConfig(configRes.data);
      }
    } catch (error) {
      console.error('Failed to load reminders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveConfig = async (newConfig) => {
    setSaving(true);
    try {
      await api.put('/reminders/config', newConfig);
      setConfig(newConfig);
      showSuccess(t('pages.reminders.settings_saved') || 'Settings saved');
    } catch (error) {
      showError(t('pages.reminders.settings_save_failed') || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const formatDueDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.ceil(diff / (1000 * 60 * 60));
    const days = Math.ceil(hours / 24);

    if (hours <= 0) return t('pages.reminders.now') || 'Now';
    if (hours < 24) return t('pages.reminders.in_hours', { count: hours }) || `In ${hours}h`;
    if (days === 1) return t('pages.reminders.tomorrow') || 'Tomorrow';
    return t('pages.reminders.in_days', { count: days }) || `In ${days} days`;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return colors.error;
      case 'medium': return colors.warning;
      default: return colors.primary;
    }
  };

  const getPriorityBg = (priority) => {
    switch (priority) {
      case 'high': return colors.errorLight || '#FECACA';
      case 'medium': return colors.warningLight || '#FEF3C7';
      default: return colors.primaryLight || '#DBEAFE';
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
        <AppHeader showBack title={t('pages.reminders.title') || 'Reminders'} showUserName />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: 'calc(100vh - 140px)',
          paddingTop: '60px'
        }}>
          <Loader2 size={32} color={colors.primary} className="spinner" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      <AppHeader showBack title={t('pages.reminders.title') || 'Reminders'} showUserName />

      <div style={{ 
        maxWidth: '560px', 
        margin: '0 auto', 
        padding: '76px 16px 100px'
      }}>
        {/* Active Reminders Section */}
        <h3 style={{ 
          color: colors.text, 
          fontSize: '16px', 
          fontWeight: 600, 
          marginBottom: '12px' 
        }}>
          {t('pages.reminders.active_reminders') || 'Active Reminders'}
        </h3>

        {reminders.length === 0 ? (
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            <AlarmClock size={32} color={colors.textMuted} style={{ marginBottom: '8px' }} />
            <p style={{ color: colors.textMuted, fontSize: '14px' }}>
              {t('pages.reminders.no_active_reminders') || 'No active reminders'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {reminders.map((reminder) => (
              <div
                key={reminder.reminder_id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: '12px',
                  padding: '16px',
                  borderLeft: `4px solid ${getPriorityColor(reminder.priority)}`
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  {reminder.type === 'upcoming_session' ? (
                    <Calendar size={20} color={getPriorityColor(reminder.priority)} />
                  ) : (
                    <CreditCard size={20} color={getPriorityColor(reminder.priority)} />
                  )}
                  <span style={{ 
                    flex: 1, 
                    color: colors.text, 
                    fontSize: '15px', 
                    fontWeight: 600 
                  }}>
                    {reminder.title}
                  </span>
                  <span style={{ 
                    color: getPriorityColor(reminder.priority), 
                    fontSize: '13px', 
                    fontWeight: 500 
                  }}>
                    {formatDueDate(reminder.due_at)}
                  </span>
                </div>
                <p style={{ color: colors.textMuted, fontSize: '13px', lineHeight: 1.4 }}>
                  {reminder.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Reminder Settings Section */}
        <h3 style={{ 
          color: colors.text, 
          fontSize: '16px', 
          fontWeight: 600, 
          marginBottom: '12px',
          marginTop: '24px'
        }}>
          {t('pages.reminders.reminder_settings') || 'Reminder Settings'}
        </h3>

        {/* Session Reminders */}
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px'
        }}>
          <h4 style={{ color: colors.text, fontSize: '15px', fontWeight: 600 }}>
            {t('pages.reminders.session_reminders') || 'Session Reminders'}
          </h4>
          <p style={{ color: colors.textMuted, fontSize: '13px', marginTop: '2px', marginBottom: '12px' }}>
            {t('pages.reminders.session_reminders_desc') || 'How long before a session should we remind you?'}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {sessionHourOptions.map((hours) => (
              <button
                key={hours}
                onClick={() => saveConfig({ ...config, session_reminder_hours: hours })}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  backgroundColor: config.session_reminder_hours === hours 
                    ? colors.primary 
                    : colors.background,
                  color: config.session_reminder_hours === hours 
                    ? '#fff' 
                    : colors.text,
                  fontSize: '14px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.2s ease'
                }}
                data-testid={`session-hours-${hours}`}
              >
                {hours}h
              </button>
            ))}
          </div>
        </div>

        {/* Payment Reminders */}
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px'
        }}>
          <h4 style={{ color: colors.text, fontSize: '15px', fontWeight: 600 }}>
            {t('pages.reminders.payment_reminders') || 'Payment Reminders'}
          </h4>
          <p style={{ color: colors.textMuted, fontSize: '13px', marginTop: '2px', marginBottom: '12px' }}>
            {t('pages.reminders.payment_reminders_desc') || 'Remind me about pending payments'}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {paymentDayOptions.map((days) => (
              <button
                key={days}
                onClick={() => saveConfig({ ...config, payment_reminder_days: days })}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  backgroundColor: config.payment_reminder_days === days 
                    ? colors.primary 
                    : colors.background,
                  color: config.payment_reminder_days === days 
                    ? '#fff' 
                    : colors.text,
                  fontSize: '14px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.2s ease'
                }}
                data-testid={`payment-days-${days}`}
              >
                {days === 1 
                  ? (t('time.one_day') || '1 day') 
                  : (t('time.n_days', { count: days }) || `${days} days`)}
              </button>
            ))}
          </div>
        </div>

        {/* Weekly Summary Toggle */}
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            <div style={{ flex: 1, marginRight: '12px' }}>
              <h4 style={{ color: colors.text, fontSize: '15px', fontWeight: 600 }}>
                {t('pages.reminders.weekly_summary') || 'Weekly Summary'}
              </h4>
              <p style={{ color: colors.textMuted, fontSize: '13px', marginTop: '2px' }}>
                {t('pages.reminders.weekly_summary_desc') || 'Receive a weekly email with your upcoming sessions'}
              </p>
            </div>
            <button
              onClick={() => saveConfig({ ...config, weekly_summary: !config.weekly_summary })}
              disabled={saving}
              style={{
                width: '50px',
                height: '28px',
                borderRadius: '14px',
                backgroundColor: config.weekly_summary ? colors.primary : colors.gray300,
                position: 'relative',
                cursor: 'pointer',
                border: 'none',
                transition: 'background-color 0.2s ease'
              }}
              data-testid="weekly-summary-toggle"
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: '#fff',
                position: 'absolute',
                top: '2px',
                left: config.weekly_summary ? '24px' : '2px',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }} />
            </button>
          </div>
        </div>
      </div>

      <BottomNav />

      <style>{`
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
