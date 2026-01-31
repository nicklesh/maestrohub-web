import React, { useState } from 'react';
import { Users, Mail, Copy, Check, Send, Loader } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import api from '../services/api';

export default function InviteProviderPage() {
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteLink = `${window.location.origin}/register?ref=coach&role=tutor`;

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      showError(t('forms.validation.email_required') || 'Email is required');
      return;
    }

    setSending(true);
    try {
      await api.post('/invites/provider', { email }).catch(() => {});
      showSuccess(t('messages.success.invite_sent') || 'Invite sent successfully!');
      setEmail('');
    } catch (err) {
      showError(err.response?.data?.detail || t('messages.errors.generic'));
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      showSuccess(t('messages.success.link_copied') || 'Link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showError(t('messages.errors.copy_failed') || 'Failed to copy');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      <AppHeader showBack={true} title={t('navigation.invite_providers') || 'Invite Coaches'} showUserName={true} />

      <div style={{ padding: '76px 16px 100px', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          <Users size={48} color={colors.primary} style={{ marginBottom: '12px' }} />
          <h2 style={{ color: colors.text, fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
            {t('invite.invite_coach_title') || 'Invite a Coach'}
          </h2>
          <p style={{ color: colors.textMuted, fontSize: '14px' }}>
            {t('invite.invite_coach_desc') || 'Know a great coach? Invite them to join our platform and help more students.'}
          </p>
        </div>

        {/* Email Invite Form */}
        <form onSubmit={handleSendInvite}>
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '16px'
          }}>
            <h3 style={{ color: colors.text, fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
              {t('invite.send_email_invite') || 'Send Email Invite'}
            </h3>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              backgroundColor: colors.background,
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              marginBottom: '12px'
            }}>
              <Mail size={20} color={colors.textMuted} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('forms.placeholders.email') || "Enter email address"}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  fontSize: '16px',
                  color: colors.text
                }}
                data-testid="invite-provider-email"
              />
            </div>
            <button
              type="submit"
              disabled={sending}
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
            >
              {sending ? <Loader size={20} className="spinner" /> : <Send size={20} />}
              {t('buttons.send_invite') || 'Send Invite'}
            </button>
          </div>
        </form>

        {/* Share Link */}
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px'
        }}>
          <h3 style={{ color: colors.text, fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
            {t('invite.share_link') || 'Or Share Link'}
          </h3>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px',
            backgroundColor: colors.background,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`
          }}>
            <input
              type="text"
              value={inviteLink}
              readOnly
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontSize: '14px',
                color: colors.textMuted
              }}
            />
            <button
              onClick={handleCopyLink}
              style={{
                backgroundColor: colors.primaryLight,
                color: colors.primary,
                padding: '8px 16px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? t('buttons.copied') || 'Copied!' : t('buttons.copy') || 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
