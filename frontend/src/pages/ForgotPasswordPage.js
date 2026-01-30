import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, Loader, CheckCircle, ArrowLeft } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './LoginPage.css';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const { t } = useTranslation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t('auth.forgot_password.enter_email'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
      showSuccess(t('auth.forgot_password.email_sent'));
    } catch (err) {
      // Still show success to prevent email enumeration
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-page" style={{ backgroundColor: colors.background }}>
        <div className="login-container">
          <div className="login-form-wrapper">
            <div className="login-header">
              <img
                src={isDark ? '/mh_logo_dark_trimmed.png' : '/mh_logo_trimmed.png'}
                alt="Maestro Habitat"
                className="login-logo"
              />
            </div>

            <div className="login-form" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div style={{ textAlign: 'center' }}>
                <CheckCircle size={64} color={colors.success} style={{ marginBottom: 16 }} />
                <h2 className="form-title" style={{ color: colors.text }}>
                  {t('auth.forgot_password.check_email')}
                </h2>
                <p className="form-subtitle" style={{ color: colors.textMuted, marginBottom: 8 }}>
                  {t('auth.forgot_password.check_email_message')}
                </p>
                <p style={{ color: colors.primary, fontWeight: 600, marginBottom: 24 }}>{email}</p>
                <Link to="/login">
                  <button className="primary-btn" style={{ backgroundColor: colors.primary }}>
                    {t('auth.forgot_password.back_to_login')}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page" style={{ backgroundColor: colors.background }}>
      <div className="login-container">
        <div className="login-form-wrapper">
          <div className="login-header">
            <img
              src={isDark ? '/mh_logo_dark_trimmed.png' : '/mh_logo_trimmed.png'}
              alt="Maestro Habitat"
              className="login-logo"
            />
          </div>

          <div className="login-form" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.primary, marginBottom: 24 }}>
              <ArrowLeft size={20} />
              <span>{t('auth.forgot_password.back_to_login')}</span>
            </Link>

            <h2 className="form-title" style={{ color: colors.text }}>
              {t('auth.forgot_password.title')}
            </h2>
            <p className="form-subtitle" style={{ color: colors.textMuted }}>
              {t('auth.forgot_password.subtitle')}
            </p>

            {error && (
              <div className="error-box" style={{ backgroundColor: colors.errorLight, borderColor: colors.error }}>
                <AlertCircle size={18} color={colors.error} />
                <span style={{ color: colors.error }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="input-wrapper">
                <Mail size={20} color={colors.textMuted} />
                <input
                  type="email"
                  placeholder={t('auth.forgot_password.email_placeholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="forgot-email-input"
                />
              </div>

              <button 
                type="submit" 
                className="primary-btn" 
                disabled={loading} 
                style={{ backgroundColor: colors.primary }}
                data-testid="forgot-submit-btn"
              >
                {loading ? <Loader className="spinner-icon" size={20} color="#fff" /> : t('auth.forgot_password.send_reset_link')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
