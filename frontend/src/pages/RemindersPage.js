import React, { useState, useEffect } from 'react';
import { ArrowLeft, AlarmClock, Plus, Trash2, Loader2, X, Clock, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';

export default function RemindersPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    time: '',
    priority: 'normal'
  });

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const response = await api.get('/reminders').catch(() => ({ data: [] }));
      setReminders(response.data.reminders || response.data || []);
    } catch (err) {
      console.error('Failed to fetch reminders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      showError(t('forms.validation.title_required') || 'Title is required');
      return;
    }

    setSaving(true);
    try {
      await api.post('/reminders', formData);
      showSuccess(t('messages.success.reminder_added') || 'Reminder added successfully');
      setShowModal(false);
      setFormData({ title: '', message: '', time: '', priority: 'normal' });
      fetchReminders();
    } catch (err) {
      showError(err.response?.data?.detail || t('messages.errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const deleteReminder = async (reminderId) => {
    if (!window.confirm(t('messages.confirm.delete_reminder') || 'Delete this reminder?')) return;

    try {
      await api.delete(`/reminders/${reminderId}`);
      showSuccess(t('messages.success.reminder_deleted') || 'Reminder deleted');
      fetchReminders();
    } catch (err) {
      showError(t('messages.errors.generic'));
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: '100px' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', padding: '8px' }}>
            <ArrowLeft size={24} color={colors.text} />
          </button>
          <h1 style={{ color: colors.text, fontSize: '20px', fontWeight: 600 }}>
            {t('navigation.reminders')}
          </h1>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          style={{
            backgroundColor: colors.primary,
            color: '#fff',
            padding: '10px 16px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            fontWeight: 600
          }}
          data-testid="add-reminder-btn"
        >
          <Plus size={18} />
          {t('buttons.add') || 'Add'}
        </button>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader2 size={32} color={colors.primary} className="spinner" />
          </div>
        ) : reminders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>
            <AlarmClock size={64} color={colors.gray300} style={{ marginBottom: '16px' }} />
            <h3 style={{ color: colors.text, marginBottom: '8px' }}>
              {t('empty_states.no_reminders_title') || 'No reminders yet'}
            </h3>
            <p style={{ color: colors.textMuted, marginBottom: '24px' }}>
              {t('empty_states.no_reminders') || 'Add reminders to stay on track with your sessions'}
            </p>
            <button
              onClick={() => setShowModal(true)}
              style={{
                backgroundColor: colors.primary,
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Plus size={20} />
              {t('reminders.add_first') || 'Add Your First Reminder'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reminders.map((reminder, idx) => (
              <div
                key={reminder.id || idx}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  borderLeft: `4px solid ${reminder.priority === 'high' ? colors.error : colors.warning}`
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: reminder.priority === 'high' ? colors.errorLight : colors.warningLight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <AlarmClock size={22} color={reminder.priority === 'high' ? colors.error : colors.warning} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ color: colors.text, fontWeight: 600, fontSize: '16px', marginBottom: '4px' }}>
                    {reminder.title}
                  </h4>
                  {reminder.message && (
                    <p style={{ color: colors.textMuted, fontSize: '14px', marginBottom: '8px' }}>
                      {reminder.message}
                    </p>
                  )}
                  {reminder.time && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={14} color={colors.textMuted} />
                      <span style={{ color: colors.textMuted, fontSize: '13px' }}>{reminder.time}</span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => deleteReminder(reminder.id)}
                  style={{ background: 'none', padding: '8px' }}
                >
                  <Trash2 size={18} color={colors.textMuted} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Reminder Modal */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowModal(false)}
        >
          <div 
            style={{
              width: '100%',
              maxWidth: '500px',
              backgroundColor: colors.surface,
              borderRadius: '20px 20px 0 0',
              padding: '24px',
              animation: 'slideUp 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              width: '40px', 
              height: '4px', 
              borderRadius: '2px', 
              backgroundColor: colors.gray300, 
              margin: '0 auto 16px' 
            }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Bell size={24} color={colors.primary} />
                <h2 style={{ color: colors.text, fontSize: '18px', fontWeight: 600 }}>
                  {t('reminders.add_reminder') || 'Add Reminder'}
                </h2>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', padding: '4px' }}>
                <X size={24} color={colors.textMuted} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: colors.textMuted, fontSize: '14px', marginBottom: '6px' }}>
                {t('forms.labels.title') || 'Title'} *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('reminders.title_placeholder') || "e.g., Session with Coach Sarah"}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  fontSize: '16px',
                  color: colors.text
                }}
                data-testid="reminder-title-input"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: colors.textMuted, fontSize: '14px', marginBottom: '6px' }}>
                {t('forms.labels.message') || 'Message'}
              </label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder={t('reminders.message_placeholder') || "Add notes..."}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  fontSize: '16px',
                  color: colors.text,
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: colors.textMuted, fontSize: '14px', marginBottom: '6px' }}>
                {t('reminders.priority') || 'Priority'}
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {['normal', 'high'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setFormData({ ...formData, priority: p })}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor: formData.priority === p 
                        ? (p === 'high' ? colors.errorLight : colors.primaryLight)
                        : colors.background,
                      border: `1px solid ${formData.priority === p 
                        ? (p === 'high' ? colors.error : colors.primary)
                        : colors.border}`,
                      color: formData.priority === p 
                        ? (p === 'high' ? colors.error : colors.primary)
                        : colors.text,
                      fontWeight: formData.priority === p ? 600 : 400
                    }}
                  >
                    {p === 'high' ? (t('reminders.high') || 'High') : (t('reminders.normal') || 'Normal')}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                width: '100%',
                padding: '16px',
                backgroundColor: colors.primary,
                color: '#fff',
                borderRadius: '14px',
                fontSize: '17px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: saving ? 0.7 : 1
              }}
              data-testid="save-reminder-btn"
            >
              {saving ? <Loader2 size={20} className="spinner" /> : <Plus size={20} />}
              {t('reminders.add_reminder') || 'Add Reminder'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
