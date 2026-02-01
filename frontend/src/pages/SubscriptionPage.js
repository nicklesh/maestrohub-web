import React, { useState, useEffect } from 'react';
import { 
  Star, Check, Crown, Loader2, CreditCard, 
  X, CheckCircle, AlertTriangle, Infinity, Users, Video,
  BarChart3, Receipt, Bell, AlarmClock, Ban
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import api from '../services/api';

const PLANS = [
  {
    id: 'yearly',
    interval: 'year',
    name: 'Annual Plan',
    price: 99.99,
    price_display: '$99.99/year',
    savings: 'Save 17%',
    best_value: true
  },
  {
    id: 'monthly',
    interval: 'month',
    name: 'Monthly Plan',
    price: 9.99,
    price_display: '$9.99/month',
    savings: null,
    best_value: false
  }
];

const PAYMENT_METHODS = [
  { id: 'paypal', name: 'PayPal', icon: 'paypal' },
  { id: 'google_pay', name: 'Google Pay', icon: 'google' },
  { id: 'apple_pay', name: 'Apple Pay', icon: 'apple' },
  { id: 'venmo', name: 'Venmo', icon: 'wallet' },
  { id: 'card', name: 'Credit Card', icon: 'credit-card' },
];

const PREMIUM_FEATURES = [
  { icon: Infinity, text: 'Unlimited bookings' },
  { icon: Users, text: 'Access to all coaches' },
  { icon: Video, text: 'Session recordings' },
  { icon: BarChart3, text: 'Progress reports' },
  { icon: Receipt, text: 'Detailed billing' },
  { icon: Bell, text: 'Priority notifications' },
  { icon: AlarmClock, text: 'Custom reminders' },
  { icon: Star, text: 'Leave reviews' },
  { icon: Ban, text: 'Ad-free experience' },
];

export default function SubscriptionPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('paypal');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ title: '', message: '' });

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await api.get('/subscription/status').catch(() => ({ data: null }));
      setSubscription(response.data);
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const isPremium = subscription?.status === 'active' || subscription?.status === 'trialing';
  const isTrialActive = subscription?.status === 'trialing';
  const isCancelled = subscription?.cancel_at_period_end;

  const trialDaysRemaining = isTrialActive && subscription?.trial_end 
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end) - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  const showSuccessMessage = (title, message) => {
    setSuccessMessage({ title, message });
    setShowSuccessModal(true);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    
    setProcessing(true);
    try {
      const response = await api.post('/subscription/subscribe', {
        plan_id: selectedPlan,
        payment_method: selectedPaymentMethod
      });
      
      if (response.data.success) {
        showSuccessMessage(
          t('subscription.success_title') || 'Subscription Active!',
          t('subscription.success_message') || 'Welcome to Premium! Enjoy unlimited access.'
        );
        fetchSubscription();
      } else {
        showError(response.data.message || 'Failed to subscribe');
      }
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to process subscription');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    setShowCancelModal(false);
    setProcessing(true);
    try {
      const response = await api.post('/subscription/cancel');
      
      if (response.data.success) {
        showSuccessMessage(
          t('subscription.cancelled_title') || 'Subscription Cancelled',
          t('subscription.cancelled_message') || 'Your subscription will remain active until the end of the billing period.'
        );
        fetchSubscription();
      } else {
        showError(response.data.message || 'Failed to cancel subscription');
      }
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to cancel subscription');
    } finally {
      setProcessing(false);
    }
  };

  const handleReactivate = async () => {
    setProcessing(true);
    try {
      const response = await api.post('/subscription/reactivate');
      
      if (response.data.success) {
        showSuccessMessage(
          t('subscription.reactivated_title') || 'Subscription Reactivated!',
          t('subscription.reactivated_message') || 'Your subscription has been reactivated.'
        );
        fetchSubscription();
      } else {
        showError(response.data.message || 'Failed to reactivate');
      }
    } catch (err) {
      showError(err.response?.data?.detail || 'Failed to reactivate subscription');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
        <AppHeader showBack title={t('subscription.title') || 'Subscription'} showUserName />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: 'calc(100vh - 140px)',
          paddingTop: '60px'
        }}>
          <Loader2 size={32} color={colors.primary} className="spinner" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      <AppHeader showBack title={t('subscription.title') || 'Subscription'} showUserName />

      <div style={{ 
        maxWidth: '560px', 
        margin: '0 auto', 
        padding: '76px 16px 100px'
      }}>
        {/* Current Status Card */}
        {subscription && (
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            padding: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isPremium ? (
                <Star size={24} color={colors.warning} fill={colors.warning} />
              ) : (
                <Crown size={24} color={colors.textMuted} />
              )}
              <span style={{ color: colors.text, fontSize: '18px', fontWeight: 600 }}>
                {isPremium 
                  ? (isTrialActive 
                      ? (t('subscription.trial_active') || 'Trial Active')
                      : (t('subscription.premium_active') || 'Premium Active'))
                  : (t('subscription.free_plan') || 'Free Plan')}
              </span>
            </div>

            {isTrialActive && trialDaysRemaining !== null && (
              <p style={{ color: colors.warning, fontSize: '14px', marginTop: '8px' }}>
                {t('subscription.trial_days_remaining', { days: trialDaysRemaining }) || 
                  `${trialDaysRemaining} days remaining in trial`}
              </p>
            )}

            {subscription.current_period_end && !isTrialActive && isPremium && (
              <p style={{ color: colors.textMuted, fontSize: '14px', marginTop: '8px' }}>
                {isCancelled
                  ? (t('subscription.cancels_on', { 
                      date: new Date(subscription.current_period_end).toLocaleDateString() 
                    }) || `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`)
                  : (t('subscription.renews_on', { 
                      date: new Date(subscription.current_period_end).toLocaleDateString() 
                    }) || `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`)}
              </p>
            )}

            {isCancelled && (
              <button
                onClick={handleReactivate}
                disabled={processing}
                style={{
                  marginTop: '16px',
                  width: '100%',
                  backgroundColor: colors.primary,
                  color: '#fff',
                  padding: '12px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  opacity: processing ? 0.7 : 1
                }}
                data-testid="reactivate-btn"
              >
                {processing ? <Loader2 size={18} className="spinner" /> : (t('subscription.reactivate') || 'Reactivate')}
              </button>
            )}
          </div>
        )}

        {/* Plan Selection (for non-premium or trial users) */}
        {(!isPremium || isTrialActive) && (
          <>
            <h3 style={{ color: colors.text, fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              {t('subscription.choose_plan') || 'Choose Your Plan'}
            </h3>

            {PLANS.map((plan) => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                style={{
                  width: '100%',
                  backgroundColor: colors.surface,
                  borderRadius: '12px',
                  border: `${selectedPlan === plan.id ? '2px' : '1px'} solid ${
                    selectedPlan === plan.id ? colors.primary : colors.border
                  }`,
                  padding: '16px',
                  marginBottom: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                data-testid={`plan-${plan.id}`}
              >
                {plan.best_value && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    backgroundColor: colors.primary,
                    color: '#fff',
                    padding: '4px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderBottomLeftRadius: '8px'
                  }}>
                    {t('subscription.best_value') || 'Best Value'}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: colors.text, fontSize: '16px', fontWeight: 600 }}>
                    {plan.name}
                  </span>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '12px',
                    border: '2px solid #ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {selectedPlan === plan.id && (
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '7px',
                        backgroundColor: colors.primary
                      }} />
                    )}
                  </div>
                </div>

                <p style={{ color: colors.text, fontSize: '24px', fontWeight: 700, marginTop: '8px' }}>
                  {plan.price_display}
                </p>

                {plan.savings && (
                  <p style={{ color: colors.success, fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
                    {plan.savings}
                  </p>
                )}
              </button>
            ))}

            {/* Payment Method Selection */}
            <h3 style={{ 
              color: colors.text, 
              fontSize: '18px', 
              fontWeight: 600, 
              marginBottom: '16px',
              marginTop: '24px' 
            }}>
              {t('subscription.payment_method') || 'Payment Method'}
            </h3>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedPaymentMethod(method.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: colors.surface,
                    border: `${selectedPaymentMethod === method.id ? '2px' : '1px'} solid ${
                      selectedPaymentMethod === method.id ? colors.primary : colors.border
                    }`,
                    cursor: 'pointer'
                  }}
                  data-testid={`payment-${method.id}`}
                >
                  <CreditCard size={20} color={colors.text} />
                  <span style={{ color: colors.text, fontSize: '14px', fontWeight: 500 }}>
                    {method.name}
                  </span>
                </button>
              ))}
            </div>

            {/* Subscribe Button */}
            <button
              onClick={handleSubscribe}
              disabled={processing}
              style={{
                width: '100%',
                backgroundColor: colors.primary,
                color: '#fff',
                padding: '16px',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                opacity: processing ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              data-testid="subscribe-btn"
            >
              {processing ? (
                <Loader2 size={20} className="spinner" />
              ) : (
                t('subscription.subscribe_now') || 'Subscribe Now'
              )}
            </button>
          </>
        )}

        {/* Premium Features */}
        <h3 style={{ 
          color: colors.text, 
          fontSize: '18px', 
          fontWeight: 600, 
          marginBottom: '16px',
          marginTop: '24px' 
        }}>
          {t('subscription.premium_features') || 'Premium Features'}
        </h3>

        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          padding: '16px'
        }}>
          {PREMIUM_FEATURES.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div 
                key={index}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  padding: '12px 0',
                  borderBottom: index < PREMIUM_FEATURES.length - 1 ? `1px solid ${colors.border}` : 'none'
                }}
              >
                <IconComponent size={20} color={colors.primary} />
                <span style={{ color: colors.text, fontSize: '15px', flex: 1 }}>
                  {t(`subscription.feature_${feature.text.toLowerCase().replace(/\s+/g, '_')}`) || feature.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Cancel Subscription (for active premium users) */}
        {isPremium && !isTrialActive && !isCancelled && (
          <button
            onClick={() => setShowCancelModal(true)}
            disabled={processing}
            style={{
              width: '100%',
              marginTop: '24px',
              backgroundColor: 'transparent',
              color: colors.error,
              padding: '16px',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              border: `1px solid ${colors.error}`
            }}
            data-testid="cancel-subscription-btn"
          >
            {t('subscription.cancel_subscription') || 'Cancel Subscription'}
          </button>
        )}

        {/* Free Tier Info */}
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          padding: '16px',
          marginTop: '24px',
          marginBottom: '32px'
        }}>
          <h4 style={{ color: colors.text, fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            {t('subscription.free_tier_info') || 'Free Tier Includes'}
          </h4>
          <p style={{ color: colors.textMuted, fontSize: '14px', marginTop: '4px' }}>
            • {t('subscription.free_bookings_limit', { count: 3 }) || '3 bookings per month'}
          </p>
          <p style={{ color: colors.textMuted, fontSize: '14px', marginTop: '4px' }}>
            • {t('subscription.free_coaches_limit', { count: 10 }) || '10 coaches visible'}
          </p>
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: colors.surface,
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <AlertTriangle size={48} color={colors.warning} />
            </div>
            <h3 style={{ 
              color: colors.text, 
              fontSize: '20px', 
              fontWeight: 600, 
              textAlign: 'center',
              marginBottom: '12px'
            }}>
              {t('subscription.cancel_confirm_title') || 'Cancel Subscription?'}
            </h3>
            <p style={{ 
              color: colors.textMuted, 
              fontSize: '15px', 
              textAlign: 'center',
              marginBottom: '24px',
              lineHeight: 1.4
            }}>
              {t('subscription.cancel_confirm_message') || 
                'Your subscription will remain active until the end of the billing period. You can reactivate anytime.'}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowCancelModal(false)}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: colors.background,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {t('common.cancel') || 'Keep Plan'}
              </button>
              <button
                onClick={handleCancel}
                disabled={processing}
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: colors.error,
                  border: 'none',
                  color: '#fff',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  opacity: processing ? 0.7 : 1
                }}
              >
                {processing ? <Loader2 size={18} className="spinner" /> : (t('subscription.cancel_subscription') || 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          zIndex: 1000
        }}>
          <div style={{
            width: '100%',
            maxWidth: '400px',
            backgroundColor: colors.surface,
            borderRadius: '16px',
            padding: '24px'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <CheckCircle size={64} color={colors.success || colors.primary} />
            </div>
            <h3 style={{ 
              color: colors.text, 
              fontSize: '20px', 
              fontWeight: 600, 
              textAlign: 'center',
              marginBottom: '12px'
            }}>
              {successMessage.title}
            </h3>
            <p style={{ 
              color: colors.textMuted, 
              fontSize: '15px', 
              textAlign: 'center',
              marginBottom: '24px',
              lineHeight: 1.4
            }}>
              {successMessage.message}
            </p>
            <button
              onClick={() => setShowSuccessModal(false)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                backgroundColor: colors.primary,
                border: 'none',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t('common.ok') || 'OK'}
            </button>
          </div>
        </div>
      )}

      <BottomNav />

      <style>{`
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
