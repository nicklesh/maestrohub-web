import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Download, Calendar, Loader2, AlertCircle, 
  Archive, Mail, ChevronRight 
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import api from '../services/api';

export default function TaxReportsPage() {
  const { colors } = useTheme();
  const { user, token } = useAuth();
  const { t } = useTranslation();
  const { showSuccess, showError, showInfo } = useToast();
  
  const [reports, setReports] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [currentYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [reportsRes, yearsRes] = await Promise.all([
        api.get('/tax-reports').catch(() => ({ data: { reports: [] } })),
        api.get('/tax-reports/available-years').catch(() => ({ 
          data: { years: [currentYear, currentYear - 1, currentYear - 2] } 
        }))
      ]);
      setReports(reportsRes.data.reports || []);
      setAvailableYears(yearsRes.data.years || [currentYear, currentYear - 1, currentYear - 2]);
    } catch (error) {
      console.error('Failed to load tax reports:', error);
    } finally {
      setLoading(false);
    }
  }, [currentYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateReport = async (year, reportType = 'annual') => {
    setGenerating(`${year}-${reportType}`);
    try {
      const response = await api.post(`/tax-reports/generate?year=${year}&report_type=${reportType}`);
      
      if (response.data.success) {
        showSuccess(t('pages.tax_reports.report_generated', { year }) || `Tax report for ${year} generated!`);
        loadData();
      } else {
        showError(response.data.error || 'Failed to generate report');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to generate report';
      showError(errorMessage);
    } finally {
      setGenerating(null);
    }
  };

  const handleDownloadReport = async (report) => {
    setDownloading(report.report_id);
    try {
      const baseUrl = process.env.REACT_APP_BACKEND_URL || '';
      const downloadUrl = `${baseUrl}/api/tax-reports/${report.report_id}/download`;
      
      const response = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Download failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tax_report_${report.report_year}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showSuccess(t('pages.tax_reports.report_downloaded') || 'Report downloaded');
    } catch (error) {
      showError(t('pages.reports.download_failed') || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const handleRequestArchived = async (year) => {
    try {
      await api.post(`/tax-reports/request-archived?year=${year}`);
      showInfo(t('pages.tax_reports.archived_request_sent', { year }) || 
        `Request for ${year} archived report submitted. You'll be notified when ready.`);
    } catch (error) {
      showError(error.response?.data?.detail || 'Failed to request archived report');
    }
  };

  const getReportsForYear = (year) => 
    reports.filter(r => r.report_year === year).sort((a, b) => 
      (b.report_month || 0) - (a.report_month || 0)
    );

  const formatAmount = (cents) => {
    return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const getMonthName = (month) => {
    const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month] || '';
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
        <AppHeader showBack title={t('pages.tax_reports.title') || 'Tax Reports'} showUserName />
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
      <AppHeader showBack title={t('pages.tax_reports.title') || 'Tax Reports'} showUserName />

      <div style={{ 
        maxWidth: '640px', 
        margin: '0 auto', 
        padding: '76px 16px 100px'
      }}>
        {/* Info Banner */}
        <div style={{
          backgroundColor: colors.primaryLight || '#EBF5FF',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          border: `1px solid ${colors.primary}`
        }}>
          <AlertCircle size={24} color={colors.primary} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ color: colors.text, fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
              {user?.role === 'provider' 
                ? (t('pages.tax_reports.provider_tax_documents') || 'Tax Documents')
                : (t('pages.tax_reports.payment_records') || 'Payment Records')}
            </p>
            <p style={{ color: colors.textSecondary || colors.textMuted, fontSize: '13px', lineHeight: 1.4 }}>
              {user?.role === 'provider' 
                ? (t('pages.tax_reports.provider_info') || 'Annual tax documents for your coaching income.')
                : (t('pages.tax_reports.consumer_info') || 'Records of your payments for tutoring services.')}
            </p>
          </div>
        </div>

        {/* Years List */}
        {availableYears.length === 0 ? (
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '12px',
            padding: '48px 24px',
            textAlign: 'center'
          }}>
            <FileText size={64} color={colors.textMuted} style={{ marginBottom: '16px' }} />
            <h3 style={{ color: colors.text, fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              {t('pages.tax_reports.no_tax_years') || 'No Tax Reports'}
            </h3>
            <p style={{ color: colors.textMuted, fontSize: '14px' }}>
              {t('pages.tax_reports.reports_appear_here') || 'Tax reports will appear here once available.'}
            </p>
          </div>
        ) : (
          availableYears.map((year) => {
            const yearReports = getReportsForYear(year);
            const annualReport = yearReports.find(r => r.report_type === 'annual_1099');
            const isGenerating = generating === `${year}-annual`;
            const isArchived = year < (currentYear - 4);

            return (
              <div 
                key={year}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                  padding: '16px',
                  marginBottom: '16px'
                }}
              >
                {/* Year Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Calendar size={24} color={colors.primary} />
                    <span style={{ color: colors.text, fontSize: '22px', fontWeight: 700 }}>
                      {year}
                    </span>
                  </div>
                  {isArchived && (
                    <span style={{
                      backgroundColor: colors.gray200 || '#E5E7EB',
                      color: colors.textMuted,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      {t('pages.tax_reports.archived') || 'Archived'}
                    </span>
                  )}
                </div>

                {/* Reports for this year */}
                {yearReports.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {yearReports.map((report) => {
                      const isDownloadingThis = downloading === report.report_id;
                      
                      return (
                        <div
                          key={report.report_id}
                          style={{
                            border: `1px solid ${colors.border}`,
                            borderRadius: '10px',
                            padding: '12px'
                          }}
                        >
                          {/* Report Header */}
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '10px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <FileText size={16} color={colors.primary} />
                              <span style={{ color: colors.text, fontSize: '14px', fontWeight: 600 }}>
                                {report.report_type === 'annual_1099' 
                                  ? (t('pages.tax_reports.annual_1099') || 'Annual 1099')
                                  : `${getMonthName(report.report_month || 1)} ${t('pages.tax_reports.monthly_summary') || 'Summary'}`}
                              </span>
                            </div>
                            <span style={{ color: colors.textMuted, fontSize: '12px' }}>
                              {formatDate(report.generated_date)}
                            </span>
                          </div>

                          {/* Stats */}
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: '16px', 
                            marginBottom: '12px' 
                          }}>
                            <div>
                              <p style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '2px' }}>
                                {t('pages.tax_reports.transactions') || 'Transactions'}
                              </p>
                              <p style={{ color: colors.text, fontSize: '14px', fontWeight: 600 }}>
                                {report.transaction_count}
                              </p>
                            </div>
                            <div>
                              <p style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '2px' }}>
                                {t('pages.tax_reports.total_amount') || 'Total'}
                              </p>
                              <p style={{ color: colors.text, fontSize: '14px', fontWeight: 600 }}>
                                {formatAmount(report.total_amount_cents)}
                              </p>
                            </div>
                            {report.user_type === 'provider' && report.total_payouts_cents !== undefined && (
                              <div>
                                <p style={{ color: colors.textMuted, fontSize: '11px', marginBottom: '2px' }}>
                                  {t('pages.tax_reports.net_earnings') || 'Net'}
                                </p>
                                <p style={{ color: colors.success, fontSize: '14px', fontWeight: 600 }}>
                                  {formatAmount(report.total_payouts_cents)}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Download Button */}
                          {!report.is_archived ? (
                            <button
                              onClick={() => handleDownloadReport(report)}
                              disabled={isDownloadingThis}
                              style={{
                                width: '100%',
                                backgroundColor: colors.primary,
                                color: '#fff',
                                padding: '8px',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: 'none',
                                opacity: isDownloadingThis ? 0.7 : 1
                              }}
                              data-testid={`download-report-${report.report_id}`}
                            >
                              {isDownloadingThis ? (
                                <Loader2 size={16} className="spinner" />
                              ) : (
                                <Download size={16} />
                              )}
                              {t('pages.tax_reports.download_pdf') || 'Download PDF'}
                            </button>
                          ) : (
                            <div style={{
                              backgroundColor: colors.gray200 || '#E5E7EB',
                              padding: '8px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px'
                            }}>
                              <Archive size={14} color={colors.textMuted} />
                              <span style={{ color: colors.textMuted, fontSize: '13px', fontWeight: 500 }}>
                                {t('pages.tax_reports.archived') || 'Archived'}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <p style={{ color: colors.textMuted, fontSize: '14px', marginBottom: '12px' }}>
                      {t('pages.tax_reports.no_reports_for_year') || 'No reports for this year'}
                    </p>
                    
                    {!isArchived ? (
                      <button
                        onClick={() => handleGenerateReport(year, 'annual')}
                        disabled={isGenerating}
                        style={{
                          backgroundColor: colors.primary,
                          color: '#fff',
                          padding: '12px 20px',
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: 'none',
                          opacity: isGenerating ? 0.7 : 1
                        }}
                        data-testid={`generate-report-${year}`}
                      >
                        {isGenerating ? (
                          <Loader2 size={18} className="spinner" />
                        ) : (
                          <FileText size={18} />
                        )}
                        {t('pages.tax_reports.generate_annual_report') || 'Generate Annual Report'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRequestArchived(year)}
                        style={{
                          backgroundColor: 'transparent',
                          color: colors.primary,
                          padding: '12px 20px',
                          borderRadius: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          border: `1px solid ${colors.primary}`
                        }}
                        data-testid={`request-archived-${year}`}
                      >
                        <Mail size={18} />
                        {t('pages.tax_reports.request_via_inbox') || 'Request via Inbox'}
                      </button>
                    )}
                  </div>
                )}

                {/* Generate more reports button */}
                {yearReports.length > 0 && !annualReport && !isArchived && (
                  <button
                    onClick={() => handleGenerateReport(year, 'annual')}
                    disabled={isGenerating}
                    style={{
                      width: '100%',
                      marginTop: '12px',
                      backgroundColor: 'transparent',
                      color: colors.primary,
                      padding: '10px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: `1px solid ${colors.primary}`,
                      opacity: isGenerating ? 0.7 : 1
                    }}
                  >
                    {isGenerating ? (
                      <Loader2 size={18} className="spinner" />
                    ) : (
                      <>
                        <FileText size={18} />
                        {t('pages.tax_reports.generate_annual_1099') || 'Generate Annual 1099'}
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

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
