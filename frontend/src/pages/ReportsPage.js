import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Calendar, Users, Clock, DollarSign, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import api from '../services/api';

export default function ReportsPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    total_sessions: 0,
    total_spent: 0,
    total_hours: 0,
    coaches_worked: 0,
    this_month_sessions: 0,
    this_month_spent: 0,
    monthly_data: []
  });

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      const response = await api.get('/reports/summary').catch(() => ({ data: {} }));
      setReportData(prev => ({ ...prev, ...response.data }));
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, subValue, color }) => (
    <div style={{
      backgroundColor: colors.surface,
      borderRadius: '16px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '12px',
        backgroundColor: `${color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={24} color={color} />
      </div>
      <div>
        <p style={{ color: colors.text, fontSize: '28px', fontWeight: 700 }}>{value}</p>
        <p style={{ color: colors.textMuted, fontSize: '14px' }}>{label}</p>
        {subValue && (
          <p style={{ color: colors.success, fontSize: '13px', marginTop: '4px' }}>{subValue}</p>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      <AppHeader showBack={true} title={t('navigation.reports') || 'Reports'} showUserName={true} />

      <div style={{ padding: '76px 16px 100px', maxWidth: '600px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader2 size={32} color={colors.primary} className="spinner" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <h2 style={{ color: colors.text, fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              {t('reports.overview') || 'Overview'}
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <StatCard 
                icon={Calendar}
                label={t('reports.total_sessions') || 'Total Sessions'}
                value={reportData.total_sessions}
                color={colors.primary}
              />
              <StatCard 
                icon={DollarSign}
                label={t('reports.total_spent') || 'Total Spent'}
                value={`$${reportData.total_spent.toFixed(0)}`}
                color={colors.success}
              />
              <StatCard 
                icon={Clock}
                label={t('reports.total_hours') || 'Hours Learned'}
                value={`${reportData.total_hours}h`}
                color={colors.warning}
              />
              <StatCard 
                icon={Users}
                label={t('reports.coaches_worked') || 'Coaches'}
                value={reportData.coaches_worked}
                color={colors.error}
              />
            </div>

            {/* This Month */}
            <div style={{
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: '20px',
              marginBottom: '24px'
            }}>
              <h3 style={{ color: colors.text, fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
                {t('reports.this_month') || 'This Month'}
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: colors.primary, fontSize: '24px', fontWeight: 700 }}>
                    {reportData.this_month_sessions}
                  </p>
                  <p style={{ color: colors.textMuted, fontSize: '13px' }}>
                    {t('reports.sessions') || 'Sessions'}
                  </p>
                </div>
                <div style={{ width: '1px', backgroundColor: colors.border }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: colors.success, fontSize: '24px', fontWeight: 700 }}>
                    ${reportData.this_month_spent.toFixed(0)}
                  </p>
                  <p style={{ color: colors.textMuted, fontSize: '13px' }}>
                    {t('reports.spent') || 'Spent'}
                  </p>
                </div>
              </div>
            </div>

            {/* Monthly Chart Placeholder */}
            <div style={{
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center'
            }}>
              <BarChart3 size={48} color={colors.gray300} style={{ marginBottom: '16px' }} />
              <h3 style={{ color: colors.text, marginBottom: '8px' }}>
                {t('reports.monthly_activity') || 'Monthly Activity'}
              </h3>
              <p style={{ color: colors.textMuted, fontSize: '14px' }}>
                {reportData.total_sessions > 0 
                  ? t('reports.chart_coming_soon') || 'Detailed charts coming soon'
                  : t('reports.no_data') || 'Book sessions to see your activity reports'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
