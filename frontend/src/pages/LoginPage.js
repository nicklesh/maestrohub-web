import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import './LoginPage.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, loginWithGoogle } = useAuth();
  const { colors, isDark } = useTheme();
  const { showError } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError(t('forms.validation.fill_all_fields'));
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);
      // Redirect based on role
      if (result.role === 'admin') {
        navigate('/admin');
      } else if (result.role === 'tutor') {
        navigate('/tutor/dashboard');
      } else {
        navigate('/home');
      }
    } catch (err) {
      const message = err.response?.data?.detail || t('messages.errors.invalid_credentials');
      setError(message);
      showError(message, t('messages.errors.login_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ backgroundColor: colors.background }}>
      <div className="login-background">
        <img src="/login_background.png" alt="" className="bg-image" />
        <div className="bg-overlay" style={{ backgroundColor: colors.background }} />
      </div>

      <div className="login-container">
        <div className="login-form-wrapper">
          {/* Logo */}
          <div className="login-header">
            <img
              src={isDark ? '/mh_logo_dark_trimmed.png' : '/mh_logo_trimmed.png'}
              alt="Maestro Habitat"
              className="login-logo"
            />
            <h1 className="app-title" style={{ color: colors.primary }}>
              {t('branding.app_name')}
            </h1>
            <p className="tagline" style={{ color: colors.textMuted }}>
              {t('branding.tagline')}
            </p>
          </div>

          {/* Form */}
          <div className="login-form" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <h2 className="form-title" style={{ color: colors.text }}>
              {t('pages.login.title')}
            </h2>
            <p className="form-subtitle" style={{ color: colors.textMuted }}>
              {t('pages.login.subtitle')}
            </p>

            {error && (
              <div className="error-box" style={{ backgroundColor: colors.errorLight, borderColor: colors.error }}>
                <AlertCircle size={18} color={colors.error} />
                <span style={{ color: colors.error }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="input-wrapper">
                <Mail size={20} color={colors.textMuted} />
                <input
                  type="email"
                  placeholder={t('forms.labels.email_address')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ 
                    backgroundColor: colors.gray100, 
                    color: colors.text,
                    borderColor: colors.border 
                  }}
                  data-testid="login-email-input"
                />
              </div>

              <div className="input-wrapper">
                <Lock size={20} color={colors.textMuted} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('forms.labels.password')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ 
                    backgroundColor: colors.gray100, 
                    color: colors.text,
                    borderColor: colors.border 
                  }}
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={colors.textMuted} />
                  ) : (
                    <Eye size={20} color={colors.textMuted} />
                  )}
                </button>
              </div>

              <button
                type="submit"
                className="primary-btn"
                disabled={loading}
                style={{ backgroundColor: colors.primary }}
                data-testid="login-submit-btn"
              >
                {loading ? (
                  <Loader className="spinner-icon" size={20} color="#fff" />
                ) : (
                  t('buttons.sign_in')
                )}
              </button>
            </form>

            <Link to="/forgot-password" className="forgot-link" style={{ color: colors.primary }}>
              {t('pages.login.forgot_password')}
            </Link>

            <div className="divider">
              <span style={{ backgroundColor: colors.surface, color: colors.textMuted }}>
                {t('pages.login.or_continue_with')}
              </span>
            </div>

            <button
              type="button"
              className="google-btn"
              onClick={loginWithGoogle}
              style={{ 
                backgroundColor: colors.gray100, 
                color: colors.text,
                borderColor: colors.border 
              }}
              data-testid="google-login-btn"
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
              <span style={{ color: colors.textMuted }}>{t('pages.login.no_account')}</span>
              <Link to="/register" style={{ color: colors.primary }}>
                {t('pages.login.sign_up_link')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
