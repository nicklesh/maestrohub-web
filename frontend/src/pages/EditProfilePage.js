import React, { useState } from 'react';
import { User, Mail, Phone, Loader, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import AppHeader from '../components/AppHeader';

export default function EditProfilePage() {
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/profile', formData);
      // Refresh user data in the context
      if (refreshUser) {
        await refreshUser();
      }
      showSuccess(t('messages.success.profile_updated') || 'Profile updated successfully');
      navigate('/profile');
    } catch (err) {
      showError(err.response?.data?.detail || t('messages.errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      <AppHeader showBack={true} title={t('navigation.edit_profile') || 'Edit Profile'} showUserName={true} />

      <div style={{ padding: '76px 16px 100px' }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: '500px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '16px'
        }}>
          <h3 style={{ color: colors.text, marginBottom: '16px', fontSize: '16px' }}>
            {t('pages.profile.profile_info') || 'Profile Information'}
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px', fontSize: '14px' }}>
              {t('forms.labels.name')}
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: colors.background,
              borderRadius: '12px',
              border: `1px solid ${colors.border}`
            }}>
              <User size={20} color={colors.textMuted} />
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: '16px',
                  color: colors.text
                }}
                data-testid="edit-profile-name"
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px', fontSize: '14px' }}>
              {t('forms.labels.email')}
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: colors.gray100,
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              opacity: 0.7
            }}>
              <Mail size={20} color={colors.textMuted} />
              <input
                type="email"
                value={user?.email || ''}
                disabled
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: '16px',
                  color: colors.textMuted
                }}
              />
            </div>
            <p style={{ color: colors.textMuted, fontSize: '12px', marginTop: '4px' }}>
              {t('forms.hints.email_cannot_change') || 'Email cannot be changed'}
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: colors.textMuted, marginBottom: '8px', fontSize: '14px' }}>
              {t('forms.labels.phone')}
            </label>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: colors.background,
              borderRadius: '12px',
              border: `1px solid ${colors.border}`
            }}>
              <Phone size={20} color={colors.textMuted} />
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder={t('forms.placeholders.phone') || 'Enter phone number'}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: '16px',
                  color: colors.text
                }}
                data-testid="edit-profile-phone"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: colors.primary,
            color: '#fff',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          data-testid="edit-profile-submit"
        >
          {saving ? <Loader size={20} className="spinner" /> : <Check size={20} />}
          {t('buttons.save') || 'Save Changes'}
        </button>
      </form>
      </div>
    </div>
  );
}
