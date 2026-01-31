import React from 'react';
import { ArrowLeft, Diamond, Check, Crown, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';

export default function SubscriptionPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background, padding: '16px' }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '24px',
        paddingTop: '8px'
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', padding: '8px' }}>
          <ArrowLeft size={24} color={colors.text} />
        </button>
        <h1 style={{ color: colors.text, fontSize: '20px', fontWeight: 600 }}>
          {t('subscription.title') || 'Subscription'}
        </h1>
      </header>

      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {/* Current Plan */}
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          <Diamond size={48} color={colors.warning} style={{ marginBottom: '12px' }} />
          <h2 style={{ color: colors.text, fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            {t('subscription.free_plan') || 'Free Plan'}
          </h2>
          <p style={{ color: colors.textMuted }}>
            {t('subscription.current_plan') || 'You are currently on the free plan'}
          </p>
        </div>

        {/* Premium Plan */}
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          border: `2px solid ${colors.primary}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Crown size={24} color={colors.primary} />
            <h3 style={{ color: colors.primary, fontSize: '18px', fontWeight: 700 }}>
              {t('subscription.premium') || 'Premium'}
            </h3>
          </div>
          
          <div style={{ marginBottom: '24px' }}>
            {[
              t('subscription.features.priority_booking') || 'Priority booking with coaches',
              t('subscription.features.no_fees') || 'No booking fees',
              t('subscription.features.premium_support') || 'Premium customer support',
              t('subscription.features.exclusive_content') || 'Access to exclusive content',
            ].map((feature, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Check size={16} color={colors.success} />
                <span style={{ color: colors.text, fontSize: '14px' }}>{feature}</span>
              </div>
            ))}
          </div>

          <button style={{
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
          }}>
            <Star size={20} />
            {t('subscription.upgrade') || 'Upgrade to Premium'}
          </button>
        </div>
      </div>
    </div>
  );
}
