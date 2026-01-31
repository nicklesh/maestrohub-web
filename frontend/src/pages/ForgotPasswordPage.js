import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, AlertCircle, Loader, CheckCircle, ArrowLeft, Lock } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './ForgotPasswordPage.css';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

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
      <div className="forgot-page" style={{ backgroundColor: colors.background }}>
        {/* Background */}
        <div className="login-background">
          <img src="/login_background.png" alt="" className="bg-image" />
          <div className="bg-overlay" style={{ backgroundColor: colors.background }} />
        </div>

        <div className="forgot-container">
          <div className="forgot-form-wrapper">
            {/* Logo Section */}
            <div className="forgot-header">
              <img
                src={isDark ? '/mh_logo_dark_trimmed.png' : '/mh_logo_trimmed.png'}
                alt="Maestro Habitat"
                className="forgot-logo"
              />
              <h1 className="app-title" style={{ color: colors.primary }}>
                {t('branding.app_name')}
              </h1>
              <p className="tagline" style={{ color: colors.textMuted }}>
                {t('branding.tagline')}
              </p>
            </div>

            {/* Success Card */}
            <div className="forgot-card" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div className="success-content">
                <div className="icon-circle success" style={{ backgroundColor: colors.successLight }}>
                  <CheckCircle size={32} color={colors.success} />
                </div>
                <h2 style={{ color: colors.text }}>
                  {t('auth.forgot_password.check_email')}
                </h2>
                <p style={{ color: colors.textMuted }}>
                  {t('auth.forgot_password.check_email_message')}
                </p>
                <p className="email-text" style={{ color: colors.primary }}>{email}</p>
                <Link to="/login" style={{ width: '100%' }}>
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
    <div className="forgot-page" style={{ backgroundColor: colors.background }}>
      {/* Background */}
      <div className="login-background">
        <img src="/login_background.png" alt="" className="bg-image" />
        <div className="bg-overlay" style={{ backgroundColor: colors.background }} />
      </div>

      {/* Back button */}
      <button className="back-btn" onClick={() => navigate('/login')} style={{ color: colors.text }}>
        <ArrowLeft size={24} />
      </button>

      <div className="forgot-container">
        <div className="forgot-form-wrapper">
          {/* Logo Section */}
          <div className="forgot-header">
            <img
              src={isDark ? '/mh_logo_dark_trimmed.png' : '/mh_logo_trimmed.png'}
              alt="Maestro Habitat"
              className="forgot-logo"
            />
            <h1 className="app-title" style={{ color: colors.primary }}>
              {t('branding.app_name')}
            </h1>
            <p className="tagline" style={{ color: colors.textMuted }}>
              {t('branding.tagline')}
            </p>
          </div>

          {/* Form Card */}
          <div className="forgot-card" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {/* Lock Icon */}
            <div className="icon-circle" style={{ backgroundColor: colors.primaryLight }}>
              <Lock size={32} color={colors.primary} />
            </div>

            <h2 className="card-title" style={{ color: colors.text }}>
              {t('auth.forgot_password.title')}
            </h2>
            <p className="card-subtitle" style={{ color: colors.textMuted }}>
              {t('auth.forgot_password.subtitle')}
            </p>

            {error && (
              <div className="error-box" style={{ backgroundColor: colors.errorLight, borderColor: colors.error }}>
                <AlertCircle size={18} color={colors.error} />
                <span style={{ color: colors.error }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="input-wrapper" style={{ borderColor: colors.border, backgroundColor: colors.gray100 }}>
                <Mail size={20} color={colors.textMuted} />
                <input
                  type="email"
                  placeholder={t('auth.forgot_password.email_placeholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ color: colors.text }}
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

            <div className="footer-link">
              <span style={{ color: colors.textMuted }}>{t('auth.forgot_password.remember_password')}</span>
              <Link to="/login" style={{ color: colors.primary }}>
                {t('buttons.sign_in')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
