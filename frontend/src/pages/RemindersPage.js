import React, { useState, useEffect } from 'react';
import { ArrowLeft, AlarmClock, Plus, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import api from '../services/api';

export default function RemindersPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const response = await api.get('/reminders');
      setReminders(response.data.reminders || response.data || []);
    } catch (err) {
      console.error('Failed to fetch reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, padding: '16px' }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        paddingTop: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', padding: '8px' }}>
            <ArrowLeft size={24} color={colors.text} />
          </button>
          <h1 style={{ color: colors.text, fontSize: '20px', fontWeight: 600 }}>
            {t('navigation.reminders')}
          </h1>
        </div>
        <button style={{
          backgroundColor: colors.primary,
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '14px',
          fontWeight: 600
        }}>
          <Plus size={18} />
          {t('buttons.add') || 'Add'}
        </button>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader2 size={32} color={colors.primary} className="spinner" />
          </div>
        ) : reminders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <AlarmClock size={48} color={colors.gray300} style={{ marginBottom: '16px' }} />
            <p style={{ color: colors.textMuted }}>
              {t('empty_states.no_reminders') || 'No reminders yet'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reminders.map((reminder, idx) => (
              <div
                key={reminder.id || idx}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  borderLeft: `4px solid ${reminder.priority === 'high' ? colors.error : colors.warning}`
                }}
              >
                <AlarmClock size={24} color={reminder.priority === 'high' ? colors.error : colors.warning} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: colors.text, fontWeight: 600, fontSize: '15px' }}>
                    {reminder.title}
                  </h4>
                  <p style={{ color: colors.textMuted, fontSize: '14px', marginTop: '4px' }}>
                    {reminder.message}
                  </p>
                </div>
                <button style={{ background: 'none', padding: '4px' }}>
                  <Trash2 size={18} color={colors.textMuted} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
