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
