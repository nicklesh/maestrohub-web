import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './LoginPage.css';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const { colors, isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const code = searchParams.get('code');
  const token = searchParams.get('token');

  useEffect(() => {
    verifyEmail();
  }, [code, token]);

  const verifyEmail = async () => {
    if (!code || !token) {
      setError(t('auth.verify_email.invalid_link'));
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/verify-email', { code, token });
      localStorage.setItem('auth_token', response.data.token);
      setSuccess(true);
      showSuccess(t('auth.verify_email.success_message'));
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/home');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.detail || t('auth.verify_email.verification_failed'));
      showError(t('auth.verify_email.verification_failed'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="login-page" style={{ backgroundColor: colors.background }}>
        <div className="login-container">
          <div className="login-form-wrapper">
            <div className="login-form" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div style={{ textAlign: 'center' }}>
                <Loader className="spinner-icon" size={64} color={colors.primary} style={{ marginBottom: 24 }} />
                <h2 className="form-title" style={{ color: colors.text }}>
                  {t('auth.verify_email.verifying')}
                </h2>
                <p className="form-subtitle" style={{ color: colors.textMuted }}>
                  {t('auth.verify_email.please_wait')}
                </p>
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
                  {t('auth.verify_email.success_title')}
                </h2>
                <p className="form-subtitle" style={{ color: colors.textMuted }}>
                  {t('auth.verify_email.success_message')}
                </p>
                <p style={{ color: colors.primary, marginTop: 16 }}>
                  {t('auth.verify_email.redirecting')}
                </p>
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
          <div className="login-form" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <div style={{ textAlign: 'center' }}>
              <AlertCircle size={64} color={colors.error} style={{ marginBottom: 16 }} />
              <h2 className="form-title" style={{ color: colors.text }}>
                {t('auth.verify_email.error_title')}
              </h2>
              <p className="form-subtitle" style={{ color: colors.textMuted }}>{error}</p>
              <Link to="/login">
                <button className="primary-btn" style={{ backgroundColor: colors.primary, marginTop: 24 }}>
                  {t('auth.verify_email.back_to_login')}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
