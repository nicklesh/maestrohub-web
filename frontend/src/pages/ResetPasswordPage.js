import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, Loader, CheckCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './LoginPage.css';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);

  const { colors, isDark } = useTheme();
  const { showError, showSuccess } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const code = searchParams.get('code');
  const token = searchParams.get('token');

  useEffect(() => {
    validateToken();
  }, [code, token]);

  const validateToken = async () => {
    if (!code || !token) {
      setError(t('auth.reset_password.invalid_link'));
      setValidating(false);
      return;
    }

    try {
      await api.post('/auth/validate-reset-token', { code, token });
      setTokenValid(true);
    } catch (err) {
      setError(err.response?.data?.detail || t('auth.reset_password.invalid_link'));
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError(t('auth.reset_password.enter_password'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth.reset_password.password_too_short'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.reset_password.passwords_mismatch'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { code, token, new_password: password });
      setSuccess(true);
      showSuccess(t('auth.reset_password.success'));
    } catch (err) {
      const message = err.response?.data?.detail || t('auth.reset_password.failed');
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="login-page" style={{ backgroundColor: colors.background }}>
        <div className="login-container">
          <div style={{ textAlign: 'center' }}>
            <Loader className="spinner-icon" size={48} color={colors.primary} />
            <p style={{ color: colors.textMuted, marginTop: 16 }}>{t('auth.reset_password.validating')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenValid && !success) {
    return (
      <div className="login-page" style={{ backgroundColor: colors.background }}>
        <div className="login-container">
          <div className="login-form-wrapper">
            <div className="login-form" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div style={{ textAlign: 'center' }}>
                <AlertCircle size={64} color={colors.error} style={{ marginBottom: 16 }} />
                <h2 className="form-title" style={{ color: colors.text }}>
                  {t('auth.reset_password.error_title')}
                </h2>
                <p className="form-subtitle" style={{ color: colors.textMuted }}>{error}</p>
                <Link to="/forgot-password">
                  <button className="primary-btn" style={{ backgroundColor: colors.primary, marginTop: 24 }}>
                    {t('auth.reset_password.request_new_link')}
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="login-page" style={{ backgroundColor: colors.background }}>
        <div className="login-container">
          <div className="login-form-wrapper">
            <div className="login-form" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div style={{ textAlign: 'center' }}>
                <CheckCircle size={64} color={colors.success} style={{ marginBottom: 16 }} />
                <h2 className="form-title" style={{ color: colors.text }}>
                  {t('auth.reset_password.success_title')}
                </h2>
                <p className="form-subtitle" style={{ color: colors.textMuted }}>
                  {t('auth.reset_password.success_message')}
                </p>
                <Link to="/login">
                  <button className="primary-btn" style={{ backgroundColor: colors.primary, marginTop: 24 }}>
                    {t('auth.reset_password.go_to_login')}
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
            <h2 className="form-title" style={{ color: colors.text }}>
              {t('auth.reset_password.title')}
            </h2>
            <p className="form-subtitle" style={{ color: colors.textMuted }}>
              {t('auth.reset_password.subtitle')}
            </p>

            {error && (
              <div className="error-box" style={{ backgroundColor: colors.errorLight, borderColor: colors.error }}>
                <AlertCircle size={18} color={colors.error} />
                <span style={{ color: colors.error }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="input-wrapper">
                <Lock size={20} color={colors.textMuted} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.reset_password.new_password_placeholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="reset-password-input"
                />
                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={20} color={colors.textMuted} /> : <Eye size={20} color={colors.textMuted} />}
                </button>
              </div>

              <div className="input-wrapper">
                <Lock size={20} color={colors.textMuted} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.reset_password.confirm_password_placeholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="reset-confirm-password-input"
                />
              </div>

              <p style={{ color: colors.textMuted, fontSize: 13, marginBottom: 16 }}>
                {t('auth.reset_password.password_requirements')}
              </p>

              <button 
                type="submit" 
                className="primary-btn" 
                disabled={loading} 
                style={{ backgroundColor: colors.primary }}
                data-testid="reset-submit-btn"
              >
                {loading ? <Loader className="spinner-icon" size={20} color="#fff" /> : t('auth.reset_password.reset_button')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
