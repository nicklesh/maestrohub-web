import React, { useState, useEffect } from 'react';
import { ArrowLeft, Diamond, Check, Crown, Star, Loader2, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import api from '../services/api';

export default function SubscriptionPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await api.get('/subscription').catch(() => ({ data: null }));
      setSubscription(response.data);
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      // In real implementation, this would redirect to Stripe checkout
      // For now, show a mock success message
      await api.post('/subscription/upgrade', { plan: 'premium' }).catch(() => {
        // If endpoint doesn't exist, show info message
        showSuccess(t('subscription.upgrade_info') || 'Premium subscription feature coming soon! Contact support for early access.');
      });
      fetchSubscription();
    } catch (err) {
      showSuccess(t('subscription.upgrade_info') || 'Premium subscription feature coming soon!');
    } finally {
      setUpgrading(false);
    }
  };

  const isPremium = subscription?.plan === 'premium' || subscription?.status === 'active';

  const features = [
    { key: 'priority_booking', text: t('subscription.features.priority_booking') || 'Priority booking with top coaches' },
    { key: 'no_fees', text: t('subscription.features.no_fees') || 'No booking fees on sessions' },
    { key: 'premium_support', text: t('subscription.features.premium_support') || '24/7 Premium customer support' },
    { key: 'exclusive_content', text: t('subscription.features.exclusive_content') || 'Access to exclusive learning content' },
    { key: 'family_accounts', text: t('subscription.features.family_accounts') || 'Multiple family member accounts' },
    { key: 'session_recording', text: t('subscription.features.session_recording') || 'Session recording & playback' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, paddingBottom: '100px' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '16px',
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', padding: '8px' }}>
          <ArrowLeft size={24} color={colors.text} />
        </button>
        <h1 style={{ color: colors.text, fontSize: '20px', fontWeight: 600, flex: 1 }}>
          {t('subscription.title') || 'Subscription'}
        </h1>
      </header>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader2 size={32} color={colors.primary} className="spinner" />
          </div>
        ) : (
          <>
            {/* Current Plan Card */}
            <div style={{
              backgroundColor: isPremium ? colors.primary : colors.surface,
              borderRadius: '20px',
              padding: '24px',
              marginBottom: '16px',
              textAlign: 'center',
              border: isPremium ? 'none' : `1px solid ${colors.border}`
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '32px',
                backgroundColor: isPremium ? 'rgba(255,255,255,0.2)' : colors.warningLight,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                {isPremium ? (
                  <Crown size={32} color="#fff" />
                ) : (
                  <Diamond size={32} color={colors.warning} />
                )}
              </div>
              <h2 style={{ 
                color: isPremium ? '#fff' : colors.text, 
                fontSize: '24px', 
                fontWeight: 700, 
                marginBottom: '8px' 
              }}>
                {isPremium 
                  ? (t('subscription.premium') || 'Premium') 
                  : (t('subscription.free_plan') || 'Free Plan')}
              </h2>
              <p style={{ color: isPremium ? 'rgba(255,255,255,0.9)' : colors.textMuted }}>
                {isPremium 
                  ? (t('subscription.premium_member') || 'You are a premium member')
                  : (t('subscription.current_plan') || 'You are currently on the free plan')}
              </p>
              {isPremium && subscription?.expires_at && (
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', marginTop: '8px' }}>
                  {t('subscription.renews') || 'Renews'}: {new Date(subscription.expires_at).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Premium Features Card */}
            {!isPremium && (
              <div style={{
                backgroundColor: colors.surface,
                borderRadius: '20px',
                padding: '24px',
                border: `2px solid ${colors.primary}`,
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                  <Crown size={24} color={colors.primary} />
                  <h3 style={{ color: colors.primary, fontSize: '18px', fontWeight: 700 }}>
                    {t('subscription.upgrade_to_premium') || 'Upgrade to Premium'}
                  </h3>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                  <span style={{ color: colors.primary, fontSize: '32px', fontWeight: 700 }}>
                    $9.99
                  </span>
                  <span style={{ color: colors.textMuted, fontSize: '16px' }}>
                    /{t('subscription.per_month') || 'month'}
                  </span>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  {features.map((feature, idx) => (
                    <div key={feature.key} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      marginBottom: idx < features.length - 1 ? '12px' : 0 
                    }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '10px',
                        backgroundColor: colors.successLight,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <Check size={12} color={colors.success} strokeWidth={3} />
                      </div>
                      <span style={{ color: colors.text, fontSize: '15px' }}>{feature.text}</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  style={{
                    width: '100%',
                    padding: '16px',
                    backgroundColor: colors.primary,
                    color: '#fff',
                    borderRadius: '14px',
                    fontSize: '17px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: upgrading ? 'not-allowed' : 'pointer',
                    opacity: upgrading ? 0.7 : 1
                  }}
                  data-testid="upgrade-btn"
                >
                  {upgrading ? (
                    <Loader2 size={22} className="spinner" />
                  ) : (
                    <>
                      <Star size={22} />
                      {t('subscription.upgrade') || 'Upgrade Now'}
                    </>
                  )}
                </button>

                <p style={{ 
                  color: colors.textMuted, 
                  fontSize: '13px', 
                  textAlign: 'center', 
                  marginTop: '12px' 
                }}>
                  {t('subscription.cancel_anytime') || 'Cancel anytime. No commitments.'}
                </p>
              </div>
            )}

            {/* Manage Subscription (if premium) */}
            {isPremium && (
              <div style={{
                backgroundColor: colors.surface,
                borderRadius: '16px',
                padding: '20px',
                border: `1px solid ${colors.border}`
              }}>
                <h3 style={{ color: colors.text, fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
                  {t('subscription.manage') || 'Manage Subscription'}
                </h3>
                
                <button style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: colors.background,
                  color: colors.text,
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                  border: `1px solid ${colors.border}`
                }}>
                  <CreditCard size={20} color={colors.textMuted} />
                  {t('subscription.update_payment') || 'Update Payment Method'}
                </button>

                <button style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: colors.errorLight,
                  color: colors.error,
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 500
                }}>
                  {t('subscription.cancel') || 'Cancel Subscription'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
