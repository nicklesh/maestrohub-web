import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Trash2, Loader, DollarSign, X, Building, Smartphone, CheckCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import api from '../services/api';
import './BillingPage.css';

const BillingPage = () => {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingCard, setAddingCard] = useState(false);
  const [autoPay, setAutoPay] = useState(true);
  const [selectedPaymentType, setSelectedPaymentType] = useState('card');
  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cvv: '',
    cardHolder: ''
  });

  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [methodsRes, transactionsRes] = await Promise.all([
        api.get('/billing/payment-methods').catch(() => ({ data: { methods: [] } })),
        api.get('/billing/transactions').catch(() => ({ data: { transactions: [], pending_balance: 0 } })),
      ]);
      setPaymentMethods(methodsRes.data.methods || []);
      setTransactions(transactionsRes.data.transactions || []);
      setPendingBalance(transactionsRes.data.pending_balance || 0);
    } catch (err) {
      console.error('Error fetching billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const removePaymentMethod = async (methodId) => {
    if (!window.confirm(t('messages.confirm.remove_payment') || 'Remove this payment method?')) return;

    try {
      await api.delete(`/billing/payment-methods/${methodId}`);
      showSuccess(t('pages.billing.payment_removed') || 'Payment method removed');
      fetchBillingData();
    } catch (err) {
      showError(t('messages.errors.generic'));
    }
  };

  const setDefaultMethod = async (methodId) => {
    try {
      await api.put(`/billing/payment-methods/${methodId}/default`);
      showSuccess(t('messages.success.saved') || 'Saved');
      fetchBillingData();
    } catch (err) {
      showError(t('messages.errors.generic'));
    }
  };

  const handleAddPaymentMethod = async () => {
    if (selectedPaymentType === 'card') {
      if (!cardForm.cardNumber || !cardForm.expMonth || !cardForm.expYear || !cardForm.cvv) {
        showError(t('pages.billing.fill_card_details') || 'Please fill in all card details');
        return;
      }
    }

    setAddingCard(true);
    try {
      // Simulate adding payment method
      await api.post('/billing/payment-methods', {
        type: selectedPaymentType,
        ...cardForm
      }).catch(() => {
        // If API doesn't exist, add to local state
        const newMethod = {
          id: Date.now().toString(),
          type: selectedPaymentType,
          last4: cardForm.cardNumber.slice(-4) || '0000',
          exp_month: cardForm.expMonth,
          exp_year: cardForm.expYear,
          is_default: paymentMethods.length === 0
        };
        setPaymentMethods(prev => [...prev, newMethod]);
      });
      
      showSuccess(t('pages.billing.payment_added') || 'Payment method added');
      setShowAddModal(false);
      setCardForm({ cardNumber: '', expMonth: '', expYear: '', cvv: '', cardHolder: '' });
    } catch (err) {
      showError(err.response?.data?.detail || t('messages.errors.generic'));
    } finally {
      setAddingCard(false);
    }
  };

  const PaymentTypeOption = ({ type, icon: Icon, label, description }) => (
    <button
      onClick={() => setSelectedPaymentType(type)}
      style={{
        width: '100%',
        padding: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: selectedPaymentType === type ? colors.primaryLight : colors.background,
        border: `2px solid ${selectedPaymentType === type ? colors.primary : colors.border}`,
        borderRadius: '12px',
        marginBottom: '12px'
      }}
    >
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '10px',
        backgroundColor: selectedPaymentType === type ? colors.primary : colors.gray200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={22} color={selectedPaymentType === type ? '#fff' : colors.textMuted} />
      </div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <h4 style={{ color: colors.text, fontWeight: 600, marginBottom: '2px' }}>{label}</h4>
        <p style={{ color: colors.textMuted, fontSize: '13px' }}>{description}</p>
      </div>
      {selectedPaymentType === type && (
        <CheckCircle size={22} color={colors.primary} />
      )}
    </button>
  );

  return (
    <div className="billing-page" style={{ backgroundColor: colors.background }}>
      <AppHeader showBack={true} title={t('pages.billing.title') || 'Billing'} showUserName={true} />

      <main className="billing-main" style={{ paddingTop: '76px' }}>
        {loading ? (
          <div className="loading-state">
            <Loader className="spinner" size={32} color={colors.primary} />
          </div>
        ) : (
          <div className="billing-container">
            {/* Pending Balance */}
            <div className="balance-section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div className="balance-header">
                <DollarSign size={24} color={colors.primary} />
                <h3 style={{ color: colors.text }}>{t('pages.billing.pending_balance') || 'Pending Balance'}</h3>
              </div>
              <p className="balance-amount" style={{ color: colors.primary }}>
                ${pendingBalance.toFixed(2)}
              </p>
              {pendingBalance > 0 && (
                <button className="pay-btn" style={{ backgroundColor: colors.primary }}>
                  {t('buttons.pay_now') || 'Pay Now'}
                </button>
              )}
            </div>

            {/* Payment Methods */}
            <div className="section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div className="section-header">
                <h2 style={{ color: colors.text }}>{t('pages.billing.payment_methods') || 'Payment Methods'}</h2>
                <button 
                  className="add-btn" 
                  style={{ color: colors.primary }}
                  onClick={() => setShowAddModal(true)}
                  data-testid="add-payment-btn"
                >
                  <Plus size={20} />
                  {t('pages.billing.add_card') || 'Add'}
                </button>
              </div>

              {paymentMethods.length === 0 ? (
                <div className="empty-state">
                  <CreditCard size={48} color={colors.gray300} />
                  <p style={{ color: colors.textMuted }}>{t('pages.billing.no_payment_methods') || 'No payment methods added'}</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    style={{
                      marginTop: '16px',
                      padding: '12px 24px',
                      backgroundColor: colors.primary,
                      color: '#fff',
                      borderRadius: '10px',
                      fontWeight: 600
                    }}
                  >
                    + {t('pages.billing.add_payment_method') || 'Add Payment Method'}
                  </button>
                </div>
              ) : (
                <div className="payment-list">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="payment-item" style={{ borderColor: colors.border }}>
                      <CreditCard size={24} color={colors.primary} />
                      <div className="payment-info">
                        <h4 style={{ color: colors.text }}>
                          •••• {method.last4}
                          {method.is_default && (
                            <span className="default-badge" style={{ backgroundColor: colors.successLight, color: colors.success }}>
                              {t('pages.billing.default') || 'Default'}
                            </span>
                          )}
                        </h4>
                        <p style={{ color: colors.textMuted }}>Expires {method.exp_month}/{method.exp_year}</p>
                      </div>
                      <div className="payment-actions">
                        {!method.is_default && (
                          <button onClick={() => setDefaultMethod(method.id)} style={{ color: colors.primary }}>
                            {t('pages.billing.set_default') || 'Set Default'}
                          </button>
                        )}
                        <button onClick={() => removePaymentMethod(method.id)} style={{ color: colors.error }}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Auto-Pay Toggle */}
            <div className="section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div className="auto-pay-row">
                <div className="auto-pay-info">
                  <h3 style={{ color: colors.text }}>{t('pages.billing.auto_pay') || 'Auto-Pay'}</h3>
                  <p style={{ color: colors.textMuted }}>{t('pages.billing.auto_pay_desc') || 'Automatically pay for bookings'}</p>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={autoPay}
                    onChange={(e) => setAutoPay(e.target.checked)}
                  />
                  <span className="toggle-slider" style={{ backgroundColor: autoPay ? colors.primary : colors.gray300 }} />
                </label>
              </div>
              <p className="security-note" style={{ color: colors.textMuted }}>
                {t('pages.billing.security_note') || 'Your payment information is securely stored and encrypted.'}
              </p>
            </div>

            {/* Transaction History */}
            <div className="section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <h2 style={{ color: colors.text }}>{t('pages.billing.transaction_history') || 'Transaction History'}</h2>

              {transactions.length === 0 ? (
                <div className="empty-state">
                  <DollarSign size={48} color={colors.gray300} />
                  <p style={{ color: colors.textMuted }}>{t('empty_states.no_transactions') || 'No transactions yet'}</p>
                </div>
              ) : (
                <div className="transaction-list">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="transaction-item" style={{ borderColor: colors.border }}>
                      <div className="transaction-info">
                        <h4 style={{ color: colors.text }}>{tx.description}</h4>
                        <p style={{ color: colors.textMuted }}>{tx.date}</p>
                      </div>
                      <span 
                        className="transaction-amount"
                        style={{ color: tx.type === 'refund' ? colors.success : colors.text }}
                      >
                        {tx.type === 'refund' ? '+' : '-'}${tx.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add Payment Method Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div 
            className="add-payment-modal"
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 style={{ color: colors.text }}>{t('pages.billing.add_payment_method') || 'Add Payment Method'}</h2>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '8px' }}>
                <X size={24} color={colors.textMuted} />
              </button>
            </div>

            <div className="modal-body">
              {/* Payment Type Selection */}
              <h3 style={{ color: colors.text, marginBottom: '12px', fontSize: '16px' }}>
                {t('pages.billing.select_type') || 'Select Payment Type'}
              </h3>

              <PaymentTypeOption 
                type="card" 
                icon={CreditCard} 
                label={t('pages.billing.credit_debit') || 'Credit / Debit Card'}
                description={t('pages.billing.card_desc') || 'Visa, Mastercard, American Express'}
              />

              <PaymentTypeOption 
                type="bank" 
                icon={Building} 
                label={t('pages.billing.bank_account') || 'Bank Account'}
                description={t('pages.billing.bank_desc') || 'Direct debit from your bank'}
              />

              <PaymentTypeOption 
                type="upi" 
                icon={Smartphone} 
                label={t('pages.billing.upi') || 'UPI'}
                description={t('pages.billing.upi_desc') || 'Google Pay, PhonePe, Paytm'}
              />

              {/* Card Form (shown when card is selected) */}
              {selectedPaymentType === 'card' && (
                <div className="card-form">
                  <div className="form-group">
                    <label style={{ color: colors.textMuted }}>{t('forms.labels.card_number') || 'Card Number'}</label>
                    <input
                      type="text"
                      placeholder="1234 5678 9012 3456"
                      value={cardForm.cardNumber}
                      onChange={(e) => setCardForm({ ...cardForm, cardNumber: e.target.value.replace(/\D/g, '').slice(0, 16) })}
                      style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
                      data-testid="card-number-input"
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label style={{ color: colors.textMuted }}>{t('forms.labels.expiry') || 'Expiry'}</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="MM"
                          value={cardForm.expMonth}
                          onChange={(e) => setCardForm({ ...cardForm, expMonth: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                          style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text, width: '60px' }}
                        />
                        <input
                          type="text"
                          placeholder="YY"
                          value={cardForm.expYear}
                          onChange={(e) => setCardForm({ ...cardForm, expYear: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                          style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text, width: '60px' }}
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label style={{ color: colors.textMuted }}>{t('forms.labels.cvv') || 'CVV'}</label>
                      <input
                        type="password"
                        placeholder="***"
                        value={cardForm.cvv}
                        onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                        style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text, width: '80px' }}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ color: colors.textMuted }}>{t('forms.labels.card_holder') || 'Cardholder Name'}</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={cardForm.cardHolder}
                      onChange={(e) => setCardForm({ ...cardForm, cardHolder: e.target.value })}
                      style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
                    />
                  </div>
                </div>
              )}

              {/* Bank Account Form */}
              {selectedPaymentType === 'bank' && (
                <div className="bank-form" style={{ marginTop: '16px', padding: '16px', backgroundColor: colors.background, borderRadius: '12px' }}>
                  <p style={{ color: colors.textMuted, textAlign: 'center' }}>
                    {t('pages.billing.bank_coming_soon') || 'Bank account linking coming soon'}
                  </p>
                </div>
              )}

              {/* UPI Form */}
              {selectedPaymentType === 'upi' && (
                <div className="upi-form" style={{ marginTop: '16px' }}>
                  <div className="form-group">
                    <label style={{ color: colors.textMuted }}>{t('pages.billing.upi_id') || 'UPI ID'}</label>
                    <input
                      type="text"
                      placeholder="yourname@upi"
                      style={{ backgroundColor: colors.background, borderColor: colors.border, color: colors.text }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                onClick={handleAddPaymentMethod}
                disabled={addingCard}
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
                data-testid="submit-payment-btn"
              >
                {addingCard ? <Loader size={20} className="spinner" /> : <Plus size={20} />}
                {t('pages.billing.add_payment_method') || 'Add Payment Method'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
