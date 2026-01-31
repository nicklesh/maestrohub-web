import React, { useState, useEffect } from 'react';
import { Gift, Copy, Share2, CheckCircle, Loader, Users, Trophy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import api from '../services/api';
import './ReferralsPage.css';

const ReferralsPage = () => {
  const [referralCode, setReferralCode] = useState('');
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, rewarded: 0 });
  const [loading, setLoading] = useState(true);
  const [inputCode, setInputCode] = useState('');
  const [applying, setApplying] = useState(false);

  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/referrals');
      setReferralCode(response.data.referral_code || `MH${user?.user_id?.slice(-6)?.toUpperCase()}`);
      setReferrals(response.data.referrals || []);
      setStats(response.data.stats || { total: 0, pending: 0, rewarded: 0 });
    } catch (err) {
      // Generate placeholder code
      setReferralCode(`MH${Math.random().toString(36).substring(2, 8).toUpperCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    showSuccess(t('pages.referrals.code_copied'));
  };

  const shareCode = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: t('pages.referrals.share_message'),
          text: `${t('pages.referrals.share_message')} Use my referral code: ${referralCode}`,
          url: window.location.origin,
        });
      } catch (err) {
        copyCode();
      }
    } else {
      copyCode();
    }
  };

  const applyCode = async () => {
    if (!inputCode.trim()) {
      showError(t('forms.validation.enter_referral_code'));
      return;
    }

    try {
      setApplying(true);
      await api.post('/referrals/apply', { code: inputCode });
      showSuccess(t('pages.referrals.code_applied_success'));
      setInputCode('');
    } catch (err) {
      showError(err.response?.data?.detail || t('pages.referrals.code_apply_failed'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="referrals-page" style={{ backgroundColor: colors.background }}>
      <header className="referrals-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate(-1)} style={{ color: colors.text }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ color: colors.text }}>{t('pages.referrals.title')}</h1>
          <div style={{ width: 40 }} />
        </div>
      </header>

      <main className="referrals-main">
        {loading ? (
          <div className="loading-state">
            <Loader className="spinner" size={32} color={colors.primary} />
          </div>
        ) : (
          <div className="referrals-container">
            {/* Reward Info */}
            <div className="reward-card" style={{ backgroundColor: colors.primaryLight }}>
              <Gift size={40} color={colors.primary} />
              <h2 style={{ color: colors.text }}>{t('pages.referrals.your_rewards')}</h2>
              <p style={{ color: colors.textMuted }}>
                {user?.role === 'tutor' 
                  ? t('pages.referrals.reward_provider')
                  : t('pages.referrals.reward_consumer')
                }
              </p>
            </div>

            {/* Your Code */}
            <div className="section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <h3 style={{ color: colors.text }}>{t('pages.referrals.your_referral_code')}</h3>
              <div className="code-display">
                <span className="code" style={{ color: colors.primary, backgroundColor: colors.gray100 }}>
                  {referralCode}
                </span>
                <div className="code-actions">
                  <button onClick={copyCode} style={{ color: colors.primary }}>
                    <Copy size={18} />
                  </button>
                  <button onClick={shareCode} style={{ color: colors.primary }}>
                    <Share2 size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Apply Code */}
            <div className="section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <h3 style={{ color: colors.text }}>{t('pages.referrals.have_code')}</h3>
              <div className="apply-form">
                <input
                  type="text"
                  placeholder={t('pages.referrals.enter_code')}
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                />
                <button
                  onClick={applyCode}
                  disabled={applying}
                  style={{ backgroundColor: colors.primary }}
                >
                  {applying ? <Loader className="spinner" size={18} /> : t('pages.referrals.apply')}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="stats-grid">
              <div className="stat-card" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <Users size={24} color={colors.primary} />
                <span className="stat-value" style={{ color: colors.text }}>{stats.total}</span>
                <span className="stat-label" style={{ color: colors.textMuted }}>{t('pages.referrals.total')}</span>
              </div>
              <div className="stat-card" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <CheckCircle size={24} color={colors.warning} />
                <span className="stat-value" style={{ color: colors.text }}>{stats.pending}</span>
                <span className="stat-label" style={{ color: colors.textMuted }}>{t('pages.referrals.pending')}</span>
              </div>
              <div className="stat-card" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <Trophy size={24} color={colors.success} />
                <span className="stat-value" style={{ color: colors.text }}>{stats.rewarded}</span>
                <span className="stat-label" style={{ color: colors.textMuted }}>{t('pages.referrals.rewarded')}</span>
              </div>
            </div>

            {/* Referral List */}
            {referrals.length > 0 && (
              <div className="section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
                <h3 style={{ color: colors.text }}>{t('pages.referrals.your_referrals')}</h3>
                <div className="referral-list">
                  {referrals.map((ref, index) => (
                    <div key={index} className="referral-item" style={{ borderColor: colors.border }}>
                      <div className="referral-avatar" style={{ backgroundColor: colors.primaryLight }}>
                        <span style={{ color: colors.primary }}>{ref.name?.charAt(0)}</span>
                      </div>
                      <div className="referral-info">
                        <h4 style={{ color: colors.text }}>{ref.name}</h4>
                        <p style={{ color: colors.textMuted }}>{ref.date}</p>
                      </div>
                      <span 
                        className="referral-status"
                        style={{ 
                          backgroundColor: ref.status === 'rewarded' ? colors.successLight : colors.warningLight,
                          color: ref.status === 'rewarded' ? colors.success : colors.warning
                        }}
                      >
                        {ref.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ReferralsPage;
