import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Plus, Trash2, CheckCircle, Loader, DollarSign } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './BillingPage.css';

const BillingPage = () => {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingBalance, setPendingBalance] = useState(0);

  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

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
    if (!window.confirm(t('messages.confirm.remove_payment'))) return;

    try {
      await api.delete(`/billing/payment-methods/${methodId}`);
      showSuccess(t('pages.billing.payment_removed'));
      fetchBillingData();
    } catch (err) {
      showError(t('messages.errors.generic'));
    }
  };

  const setDefaultMethod = async (methodId) => {
    try {
      await api.put(`/billing/payment-methods/${methodId}/default`);
      showSuccess(t('messages.success.saved'));
      fetchBillingData();
    } catch (err) {
      showError(t('messages.errors.generic'));
    }
  };

  return (
    <div className="billing-page" style={{ backgroundColor: colors.background }}>
      <header className="billing-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate(-1)} style={{ color: colors.text }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ color: colors.text }}>{t('pages.billing.title')}</h1>
          <div style={{ width: 40 }} />
        </div>
      </header>

      <main className="billing-main">
        {loading ? (
          <div className="loading-state">
            <Loader className="spinner" size={32} color={colors.primary} />
          </div>
        ) : (
          <div className="billing-container">
            {/* Pending Balance */}
            {pendingBalance > 0 && (
              <div className="pending-section" style={{ backgroundColor: colors.warningLight, borderColor: colors.warning }}>
                <DollarSign size={24} color={colors.warning} />
                <div className="pending-info">
                  <h3 style={{ color: colors.text }}>{t('pages.billing.pending_balance')}</h3>
                  <p style={{ color: colors.textMuted }}>${pendingBalance.toFixed(2)}</p>
                </div>
                <button className="pay-btn" style={{ backgroundColor: colors.primary }}>
                  {t('buttons.pay_now')}
                </button>
              </div>
            )}

            {/* Payment Methods */}
            <div className="section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <div className="section-header">
                <h2 style={{ color: colors.text }}>{t('pages.billing.payment_methods')}</h2>
                <button className="add-btn" style={{ color: colors.primary }}>
                  <Plus size={20} />
                  {t('pages.billing.add_card')}
                </button>
              </div>

              {paymentMethods.length === 0 ? (
                <div className="empty-state">
                  <CreditCard size={48} color={colors.gray300} />
                  <p style={{ color: colors.textMuted }}>{t('pages.billing.no_payment_methods')}</p>
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
                              {t('pages.billing.default')}
                            </span>
                          )}
                        </h4>
                        <p style={{ color: colors.textMuted }}>Expires {method.exp_month}/{method.exp_year}</p>
                      </div>
                      <div className="payment-actions">
                        {!method.is_default && (
                          <button onClick={() => setDefaultMethod(method.id)} style={{ color: colors.primary }}>
                            {t('pages.billing.set_default')}
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

            {/* Transaction History */}
            <div className="section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <h2 style={{ color: colors.text }}>{t('pages.billing.transaction_history')}</h2>

              {transactions.length === 0 ? (
                <div className="empty-state">
                  <DollarSign size={48} color={colors.gray300} />
                  <p style={{ color: colors.textMuted }}>{t('empty_states.no_transactions')}</p>
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
    </div>
  );
};

export default BillingPage;
