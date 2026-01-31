import React, { useState, useEffect } from 'react';
import { ArrowLeft, Bell, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import api from '../services/api';

export default function NotificationsPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications || response.data || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, padding: '16px' }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        paddingTop: '8px'
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', padding: '8px' }}>
          <ArrowLeft size={24} color={colors.text} />
        </button>
        <h1 style={{ color: colors.text, fontSize: '20px', fontWeight: 600 }}>
          {t('navigation.notifications')}
        </h1>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader2 size={32} color={colors.primary} className="spinner" />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <Bell size={48} color={colors.gray300} style={{ marginBottom: '16px' }} />
            <p style={{ color: colors.textMuted }}>
              {t('empty_states.no_notifications') || 'No notifications yet'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notifications.map((notif, idx) => (
              <div
                key={notif.id || idx}
                style={{
                  backgroundColor: !notif.read ? colors.primaryLight : colors.surface,
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}
                data-testid={`notification-${idx}`}
              >
                <Bell size={24} color={colors.primary} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ color: colors.text, fontWeight: 600, fontSize: '15px' }}>
                      {notif.title}
                    </h4>
                    <span style={{ color: colors.textMuted, fontSize: '12px' }}>
                      {formatTimeAgo(notif.created_at)}
                    </span>
                  </div>
                  <p style={{ color: colors.textMuted, fontSize: '14px', marginTop: '4px' }}>
                    {notif.message}
                  </p>
                </div>
                {!notif.read && (
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: colors.primary,
                    flexShrink: 0,
                    marginTop: '6px'
                  }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
