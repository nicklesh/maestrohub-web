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
