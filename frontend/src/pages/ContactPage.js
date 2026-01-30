import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Loader, CheckCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './ContactPage.css';

const ContactPage = () => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showError } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!subject || !message) {
      showError(t('pages.contact.fill_all_fields'));
      return;
    }

    try {
      setLoading(true);
      await api.post('/contact', { subject, message });
      setSuccess(true);
    } catch (err) {
      showError(t('messages.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="contact-page" style={{ backgroundColor: colors.background }}>
        <div className="success-container">
          <CheckCircle size={64} color={colors.success} />
          <h2 style={{ color: colors.text }}>{t('pages.contact.success_title')}</h2>
          <p style={{ color: colors.textMuted }}>{t('pages.contact.success_message')}</p>
          <button
            className="back-home-btn"
            onClick={() => navigate('/home')}
            style={{ backgroundColor: colors.primary }}
          >
            {t('navigation.home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="contact-page" style={{ backgroundColor: colors.background }}>
      <header className="contact-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate(-1)} style={{ color: colors.text }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ color: colors.text }}>{t('pages.contact.title')}</h1>
          <div style={{ width: 40 }} />
        </div>
      </header>

      <main className="contact-main">
        <div className="contact-container">
          <p className="contact-desc" style={{ color: colors.textMuted }}>
            {t('pages.contact.description')}
          </p>

          <form onSubmit={handleSubmit} className="contact-form" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <div className="form-group">
              <label style={{ color: colors.text }}>{t('pages.contact.subject')}</label>
              <input
                type="text"
                placeholder={t('pages.contact.subject_placeholder')}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                data-testid="contact-subject"
              />
            </div>

            <div className="form-group">
              <label style={{ color: colors.text }}>{t('pages.contact.message')}</label>
              <textarea
                placeholder={t('pages.contact.message_placeholder')}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                data-testid="contact-message"
              />
            </div>

            <button
              type="submit"
              className="submit-btn"
              disabled={loading}
              style={{ backgroundColor: colors.primary }}
              data-testid="contact-submit"
            >
              {loading ? (
                <Loader className="spinner" size={20} color="#fff" />
              ) : (
                <>
                  <Send size={18} />
                  {t('pages.contact.send_message')}
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ContactPage;
