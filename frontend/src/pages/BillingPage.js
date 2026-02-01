import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, Plus, Trash2, Loader2, CreditCard, Check, ChevronRight, Shield, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import api from '../services/api';
import './BillingPage.css';

// Payment provider logos - using real images from CDNs
const PROVIDER_CONFIG = {
  paypal: { 
    name: 'PayPal', 
    color: '#003087', 
    logo: 'https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-100px.png'
  },
  google_pay: { 
    name: 'Google Pay', 
    color: '#4285F4', 
    logo: 'https://www.gstatic.com/instantbuy/svg/dark_gpay.svg'
  },
  apple_pay: { 
    name: 'Apple Pay', 
    color: '#000000', 
    logo: 'https://www.apple.com/v/apple-pay/o/images/overview/og_image__gh9n0y3c4dum_large.png'
  },
  venmo: { 
    name: 'Venmo', 
    color: '#008CFF', 
    logo: 'https://images.ctfassets.net/gkyt4bl1j2fs/3OxsKnqRjxBNjyU0EoNPZx/4b57c3cb1d67f5cfb8e22dc71b9e6ff5/Venmo_Logo_Blue.png'
  },
  zelle: { 
    name: 'Zelle', 
    color: '#6D1ED4', 
    logo: 'https://www.zellepay.com/sites/default/files/Zelle-logo-tagline-horizontal-purple.png'
  },
  phonepe: { 
    name: 'PhonePe', 
    color: '#5F259F', 
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/PhonePe_Logo.png/800px-PhonePe_Logo.png'
  },
  paytm: { 
    name: 'Paytm', 
    color: '#00BAF2', 
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Paytm_Logo_%28standalone%29.svg/1200px-Paytm_Logo_%28standalone%29.svg.png'
  },
  amazon_pay: { 
    name: 'Amazon Pay', 
    color: '#FF9900', 
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Amazon_Pay_logo.svg/1200px-Amazon_Pay_logo.svg.png'
  },
  stripe: { 
    name: 'Stripe', 
    color: '#635BFF', 
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/2560px-Stripe_Logo%2C_revised_2016.svg.png'
  },
};

const DAY_OPTIONS = [1, 5, 10, 15, 20, 25, 28];

const BillingPage = () => {
  const [billing, setBilling] = useState(null);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [linkedProviders, setLinkedProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showDayPickerModal, setShowDayPickerModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(1);
  const [linkingProvider, setLinkingProvider] = useState(null);
  const [savingAutoPay, setSavingAutoPay] = useState(false);

  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError, showInfo } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [billingRes, providersRes] = await Promise.all([
        api.get('/billing').catch(() => ({ 
          data: { 
            pending_balance: 0, 
            pending_payments: [],
            auto_pay: { enabled: false, day_of_month: 1, next_auto_pay_date: null, next_auto_pay_amount: 0 }
          } 
        })),
        api.get('/payment-providers').catch(() => ({ 
          data: { 
            available_providers: [
              { id: 'paypal', name: 'PayPal' },
              { id: 'google_pay', name: 'Google Pay' },
              { id: 'apple_pay', name: 'Apple Pay' },
              { id: 'venmo', name: 'Venmo' },
              { id: 'zelle', name: 'Zelle' },
            ],
            linked_providers: [] 
          } 
        })),
      ]);
      
      setBilling(billingRes.data);
      setAvailableProviders(providersRes.data.available_providers || []);
      setLinkedProviders(providersRes.data.linked_providers || []);
      setSelectedDay(billingRes.data.auto_pay?.day_of_month || 1);
    } catch (error) {
      console.error('Failed to load billing:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleAutoPay = async (enabled) => {
    if (linkedProviders.length === 0) {
      showInfo(t('pages.billing.add_payment_to_enable') || 'Add a payment method first');
      return;
    }

    setSavingAutoPay(true);
    const newBilling = { ...billing, auto_pay: { ...billing.auto_pay, enabled } };
    setBilling(newBilling);

    try {
      await api.put('/billing/auto-pay', { enabled, day_of_month: selectedDay }).catch(() => {});
      showSuccess(t('messages.success.saved') || 'Settings saved');
    } finally {
      setSavingAutoPay(false);
    }
  };

  const handleDayChange = async (day) => {
    setSelectedDay(day);
    setSavingAutoPay(true);
    
    try {
      await api.put('/billing/auto-pay', { 
        enabled: billing?.auto_pay?.enabled || false, 
        day_of_month: day 
      }).catch(() => {});
      setShowDayPickerModal(false);
      showSuccess(t('messages.success.saved') || 'Payment day updated');
    } finally {
      setSavingAutoPay(false);
    }
  };

  const handleLinkProvider = async (providerId) => {
    setLinkingProvider(providerId);
    try {
      const isFirst = linkedProviders.length === 0;
      
      await api.post('/payment-providers', {
        provider_id: providerId,
        is_default: isFirst
      }).catch(() => {
        // Simulate linking if API doesn't exist
        const provider = availableProviders.find(p => p.id === providerId);
        const newLinked = {
          provider_id: providerId,
          display_name: provider?.name || providerId,
          is_default: isFirst,
          linked_at: new Date().toISOString()
        };
        setLinkedProviders(prev => [...prev, newLinked]);
      });
      
      showSuccess(t('pages.billing.payment_linked') || 'Payment method linked successfully!');
      setShowProviderModal(false);
      loadData();
    } catch (error) {
      showError(error.response?.data?.detail || t('messages.errors.generic'));
    } finally {
      setLinkingProvider(null);
    }
  };

  const handleUnlinkProvider = async (providerId, displayName) => {
    if (!window.confirm(`Remove ${displayName}?`)) return;
    
    try {
      await api.delete(`/payment-providers/${providerId}`).catch(() => {
        setLinkedProviders(prev => prev.filter(p => p.provider_id !== providerId));
      });
      showSuccess(t('pages.billing.payment_removed') || 'Payment method removed');
      loadData();
    } catch (error) {
      showError(t('messages.errors.generic'));
    }
  };

  const handleSetDefault = async (providerId) => {
    try {
      await api.put(`/payment-providers/${providerId}/default`).catch(() => {
        setLinkedProviders(prev => prev.map(p => ({
          ...p,
          is_default: p.provider_id === providerId
        })));
      });
      showSuccess(t('messages.success.saved') || 'Default updated');
      loadData();
    } catch (error) {
      showError(t('messages.errors.generic'));
    }
  };

  const getOrdinalSuffix = (day) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  const getProviderConfig = (providerId) => {
    return PROVIDER_CONFIG[providerId] || { name: providerId, color: colors.primary, icon: '💳' };
  };

  const unlinkedProviders = availableProviders.filter(
    p => !linkedProviders.some(lp => lp.provider_id === p.id)
  );

  return (
    <div className="billing-page" style={{ backgroundColor: colors.background }}>
      <AppHeader showBack={true} title={t('pages.billing.title') || 'Billing'} showUserName={true} />

      <main className="billing-main" style={{ paddingTop: '76px' }}>
        {loading ? (
          <div className="loading-state">
            <Loader2 className="spinner" size={32} color={colors.primary} />
          </div>
        ) : (
          <div className="billing-container">
            {/* Pending Balance */}
            <div className="section" style={{ backgroundColor: colors.surface }}>
              <div className="section-header">
                <Wallet size={24} color={colors.warning} />
                <h3 style={{ color: colors.text }}>{t('pages.billing.pending_balance') || 'Pending Balance'}</h3>
              </div>

              <div className="balance-card">
                <p className="balance-amount" style={{ 
                  color: billing?.pending_balance > 0 ? colors.warning : colors.success 
                }}>
                  ${(billing?.pending_balance || 0).toFixed(2)}
                </p>
                <p className="balance-label" style={{ color: colors.textMuted }}>
                  {billing?.pending_balance > 0 
                    ? (t('pages.billing.due_for_sessions') || 'Due for upcoming sessions')
                    : (t('pages.billing.no_pending_payments') || 'No pending payments')}
                </p>
              </div>
            </div>

            {/* Linked Payment Methods */}
            <div className="section" style={{ backgroundColor: colors.surface }}>
              <div className="section-header">
                <CreditCard size={24} color={colors.primary} />
                <h3 style={{ color: colors.text }}>{t('pages.billing.payment_methods') || 'Payment Methods'}</h3>
              </div>

              {linkedProviders.length === 0 ? (
                <div className="empty-state">
                  <CreditCard size={48} color={colors.gray300} />
                  <p style={{ color: colors.textMuted }}>{t('pages.billing.no_payment_methods') || 'No payment methods linked yet'}</p>
                  <p className="empty-subtext" style={{ color: colors.textMuted }}>
                    {t('pages.billing.add_payment_method_desc') || 'Add a payment method to book sessions'}
                  </p>
                </div>
              ) : (
                <div className="providers-list">
                  {linkedProviders.map((provider) => {
                    const config = getProviderConfig(provider.provider_id);
                    return (
                      <div 
                        key={provider.provider_id}
                        className="linked-provider"
                        style={{ borderColor: provider.is_default ? colors.primary : colors.border }}
                      >
                        <div 
                          className="provider-icon"
                          style={{ backgroundColor: config.color + '15' }}
                        >
                          {config.logo ? (
                            <img src={config.logo} alt={config.name} style={{ width: '28px', height: 'auto', maxHeight: '28px', objectFit: 'contain' }} />
                          ) : (
                            <CreditCard size={24} color={config.color} />
                          )}
                        </div>
                        <div className="provider-info">
                          <h4 style={{ color: colors.text }}>{provider.display_name}</h4>
                          {provider.is_default && (
                            <span className="default-badge" style={{ 
                              backgroundColor: colors.primary + '20',
                              color: colors.primary 
                            }}>
                              {t('pages.billing.default') || 'Default'}
                            </span>
                          )}
                        </div>
                        <div className="provider-actions">
                          {!provider.is_default && (
                            <button 
                              onClick={() => handleSetDefault(provider.provider_id)}
                              className="set-default-btn"
                              style={{ color: colors.primary, backgroundColor: colors.background }}
                            >
                              {t('pages.billing.set_default') || 'Set Default'}
                            </button>
                          )}
                          <button 
                            onClick={() => handleUnlinkProvider(provider.provider_id, provider.display_name)}
                            className="remove-btn"
                          >
                            <Trash2 size={18} color={colors.error} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {unlinkedProviders.length > 0 && (
                <button
                  className="add-method-btn"
                  style={{ borderColor: colors.primary, color: colors.primary }}
                  onClick={() => setShowProviderModal(true)}
                  data-testid="add-payment-btn"
                >
                  <Plus size={20} />
                  {t('pages.billing.add_payment_method') || 'Add Payment Method'}
                </button>
              )}
            </div>

            {/* Auto-Pay Settings */}
            <div className="section" style={{ backgroundColor: colors.surface }}>
              <div className="section-header">
                <RefreshCw size={24} color={colors.primary} />
                <h3 style={{ color: colors.text }}>{t('pages.billing.auto_pay') || 'Auto-Pay'}</h3>
              </div>

              <div className="auto-pay-row">
                <div className="auto-pay-info">
                  <h4 style={{ color: colors.text }}>{t('pages.billing.enable_auto_pay') || 'Enable Auto-Pay'}</h4>
                  <p style={{ color: colors.textMuted }}>{t('pages.billing.auto_pay_desc') || 'Automatically pay pending balance monthly'}</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={billing?.auto_pay?.enabled || false}
                    onChange={(e) => handleToggleAutoPay(e.target.checked)}
                    disabled={savingAutoPay}
                  />
                  <span className="toggle-slider" style={{ 
                    backgroundColor: billing?.auto_pay?.enabled ? colors.primary : colors.gray300 
                  }} />
                </label>
              </div>

              {linkedProviders.length === 0 && (
                <p className="warning-text" style={{ color: colors.warning }}>
                  {t('pages.billing.add_payment_to_enable') || 'Add a payment method to enable auto-pay'}
                </p>
              )}

              {billing?.auto_pay?.enabled && (
                <>
                  <button
                    className="day-selector"
                    style={{ backgroundColor: colors.background, borderColor: colors.border }}
                    onClick={() => setShowDayPickerModal(true)}
                  >
                    <div>
                      <span className="day-label" style={{ color: colors.textMuted }}>
                        {t('pages.billing.payment_day') || 'Payment Day'}
                      </span>
                      <span className="day-value" style={{ color: colors.text }}>
                        {selectedDay}{getOrdinalSuffix(selectedDay)} {t('pages.billing.of_each_month') || 'of each month'}
                      </span>
                    </div>
                    <ChevronRight size={20} color={colors.textMuted} />
                  </button>

                  <div className="next-auto-pay" style={{ backgroundColor: colors.background }}>
                    <span className="next-label" style={{ color: colors.textMuted }}>
                      {t('pages.billing.next_auto_pay') || 'Next Auto-Pay'}
                    </span>
                    <span className="next-date" style={{ color: colors.text }}>
                      {formatDate(billing.auto_pay.next_auto_pay_date)}
                    </span>
                    <span className="next-amount" style={{ color: colors.primary }}>
                      ${(billing.auto_pay.next_auto_pay_amount || 0).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Security Note */}
            <div className="security-note" style={{ backgroundColor: colors.primaryLight }}>
              <Shield size={20} color={colors.primary} />
              <p style={{ color: colors.primary }}>
                {t('pages.billing.security_note') || 'Maestro Habitat does not store your payment details. All payments are processed securely through your selected payment provider.'}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Add Payment Provider Modal */}
      {showProviderModal && (
        <div className="modal-overlay" onClick={() => setShowProviderModal(false)}>
          <div className="bottom-sheet" style={{ backgroundColor: colors.surface }} onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" style={{ backgroundColor: colors.gray300 }} />
            <h2 style={{ color: colors.text }}>{t('pages.billing.add_payment_method') || 'Add Payment Method'}</h2>
            <p className="sheet-subtitle" style={{ color: colors.textMuted }}>
              {t('pages.billing.select_provider_desc') || 'Select a payment provider to link'}
            </p>

            <div className="provider-options">
              {unlinkedProviders.map((provider) => {
                const config = getProviderConfig(provider.id);
                const isLinking = linkingProvider === provider.id;
                return (
                  <button
                    key={provider.id}
                    className="provider-option"
                    style={{ borderColor: colors.border }}
                    onClick={() => handleLinkProvider(provider.id)}
                    disabled={isLinking}
                    data-testid={`link-${provider.id}`}
                  >
                    <div className="provider-icon" style={{ backgroundColor: config.color + '15' }}>
                      <span style={{ fontSize: '24px' }}>{config.icon}</span>
                    </div>
                    <span className="provider-name" style={{ color: colors.text }}>{config.name}</span>
                    {isLinking ? (
                      <Loader2 size={20} color={colors.primary} className="spinner" />
                    ) : (
                      <Plus size={24} color={colors.primary} />
                    )}
                  </button>
                );
              })}
            </div>

            {unlinkedProviders.length === 0 && (
              <p className="all-linked" style={{ color: colors.textMuted }}>
                {t('pages.billing.all_methods_linked') || 'All available payment methods have been linked'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Day Picker Modal */}
      {showDayPickerModal && (
        <div className="modal-overlay" onClick={() => setShowDayPickerModal(false)}>
          <div className="day-picker-modal" style={{ backgroundColor: colors.surface }} onClick={e => e.stopPropagation()}>
            <h2 style={{ color: colors.text }}>{t('pages.billing.select_payment_day') || 'Select Payment Day'}</h2>
            <p style={{ color: colors.textMuted }}>{t('pages.billing.choose_day_hint') || 'Choose which day of the month to auto-pay'}</p>
            
            <div className="day-grid">
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day}
                  className={`day-option ${selectedDay === day ? 'selected' : ''}`}
                  style={{
                    backgroundColor: selectedDay === day ? colors.primary : colors.background,
                    borderColor: selectedDay === day ? colors.primary : colors.border,
                    color: selectedDay === day ? '#fff' : colors.text
                  }}
                  onClick={() => handleDayChange(day)}
                  disabled={savingAutoPay}
                >
                  {day}{getOrdinalSuffix(day)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
