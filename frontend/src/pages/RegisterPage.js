import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, AlertCircle, Loader, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import './LoginPage.css';

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { register, loginWithGoogle } = useAuth();
  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password) {
      setError(t('forms.validation.fill_all_fields'));
      return;
    }

    if (password.length < 8) {
      setError(t('forms.validation.password_min_length'));
      return;
    }

    setLoading(true);
    try {
      await register(email, password, name, 'consumer');
      setSuccess(true);
      showSuccess(t('auth.register.verification_email_sent'));
    } catch (err) {
      const message = err.response?.data?.detail || t('messages.errors.generic');
      setError(message);
      showError(message);
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
                  {t('auth.register.check_email_title')}
                </h2>
                <p className="form-subtitle" style={{ color: colors.textMuted, marginBottom: 8 }}>
                  {t('auth.register.check_email_message')}
                </p>
                <p style={{ color: colors.primary, fontWeight: 600, marginBottom: 16 }}>{email}</p>
                <p style={{ color: colors.textMuted, fontSize: 14, marginBottom: 24 }}>
                  {t('auth.register.link_expires_24h')}
                </p>
                <Link to="/login">
                  <button 
                    className="primary-btn" 
                    style={{ backgroundColor: colors.primary }}
                    data-testid="go-to-login-btn"
                  >
                    {t('auth.register.go_to_login')}
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
      <div className="login-background">
        <img src="/login_background.png" alt="" className="bg-image" />
        <div className="bg-overlay" style={{ backgroundColor: colors.background }} />
      </div>

      <div className="login-container">
        <div className="login-form-wrapper">
          <div className="login-header">
            <img
              src={isDark ? '/mh_logo_dark_trimmed.png' : '/mh_logo_trimmed.png'}
              alt="Maestro Habitat"
              className="login-logo"
            />
            <h1 className="app-title" style={{ color: colors.primary }}>
              {t('branding.app_name')}
            </h1>
          </div>

          <div className="login-form" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <h2 className="form-title" style={{ color: colors.text }}>
              {t('pages.register.title')}
            </h2>
            <p className="form-subtitle" style={{ color: colors.textMuted }}>
              {t('pages.register.subtitle')}
            </p>

            {error && (
              <div className="error-box" style={{ backgroundColor: colors.errorLight, borderColor: colors.error }}>
                <AlertCircle size={18} color={colors.error} />
                <span style={{ color: colors.error }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister}>
              <div className="input-wrapper">
                <User size={20} color={colors.textMuted} />
                <input
                  type="text"
                  placeholder={t('forms.labels.full_name')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="register-name-input"
                />
              </div>

              <div className="input-wrapper">
                <Mail size={20} color={colors.textMuted} />
                <input
                  type="email"
                  placeholder={t('forms.labels.email_address')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="register-email-input"
                />
              </div>

              <div className="input-wrapper">
                <Lock size={20} color={colors.textMuted} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('forms.labels.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="register-password-input"
                />
                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
                </button>
              </div>

              <button 
                type="submit" 
                className="primary-btn" 
                disabled={loading} 
                style={{ backgroundColor: colors.primary }}
                data-testid="register-submit-btn"
              >
                {loading ? <Loader className="spinner-icon" size={20} color="#fff" /> : t('buttons.sign_up')}
              </button>
            </form>

            <div className="divider">
              <span style={{ backgroundColor: colors.surface, color: colors.textMuted }}>
                {t('pages.login.or_continue_with')}
              </span>
            </div>

            <button
              type="button"
              className="google-btn"
              onClick={loginWithGoogle}
              style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
              data-testid="google-register-btn"
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t('pages.login.continue_with_google')}
            </button>

            <div className="footer-text">
              <span style={{ color: colors.textMuted }}>{t('pages.register.have_account')}</span>
              <Link to="/login" style={{ color: colors.primary }}>{t('pages.register.sign_in_link')}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
