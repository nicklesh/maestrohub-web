import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Check, Loader2, AlertCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import api from '../services/api';

export default function TaxReportsPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [taxReports, setTaxReports] = useState([]);
  const [downloading, setDownloading] = useState(null);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  useEffect(() => {
    fetchTaxReports();
  }, []);

  const fetchTaxReports = async () => {
    try {
      const response = await api.get('/reports/tax').catch(() => ({ 
        data: { reports: [] } 
      }));
      setTaxReports(response.data.reports || []);
    } catch (err) {
      console.error('Failed to fetch tax reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (year, type) => {
    setDownloading(`${year}-${type}`);
    try {
      // Try to download from API
      const response = await api.get(`/reports/tax/download/${year}/${type}`, {
        responseType: 'blob'
      }).catch(() => null);
      
      if (response && response.data) {
        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `tax_report_${year}_${type}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showSuccess(t('tax_reports.download_success') || 'Report downloaded');
      } else {
        // If API doesn't exist, show info message
        showSuccess(t('tax_reports.download_info') || `Tax report for ${year} will be available after filing. Check back later.`);
      }
    } catch (err) {
      showError(t('messages.errors.generic'));
    } finally {
      setDownloading(null);
    }
  };

  const TaxYearCard = ({ year, hasData }) => {
    const reports = [
      { type: 'annual', label: t('tax_reports.annual_statement') || 'Annual Statement', desc: 'Summary of all transactions' },
      { type: '1099', label: t('tax_reports.form_1099') || 'Form 1099-K', desc: 'Payment transactions over $600' },
    ];

    return (
      <div style={{
        backgroundColor: colors.surface,
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            backgroundColor: colors.primaryLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={22} color={colors.primary} />
          </div>
          <div>
            <h3 style={{ color: colors.text, fontSize: '18px', fontWeight: 600 }}>
              {year} {t('tax_reports.tax_year') || 'Tax Year'}
            </h3>
            <p style={{ color: colors.textMuted, fontSize: '13px' }}>
              {hasData ? t('tax_reports.available') || 'Documents available' : t('tax_reports.pending') || 'Not yet available'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {reports.map((report) => (
            <div 
              key={report.type}
              style={{
                backgroundColor: colors.background,
                borderRadius: '12px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileText size={22} color={colors.textMuted} />
                <div>
                  <p style={{ color: colors.text, fontWeight: 500, fontSize: '15px' }}>
                    {report.label}
                  </p>
                  <p style={{ color: colors.textMuted, fontSize: '12px' }}>
                    {report.desc}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDownload(year, report.type)}
                disabled={downloading === `${year}-${report.type}`}
                style={{
                  backgroundColor: colors.primaryLight,
                  color: colors.primary,
                  padding: '8px 14px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  opacity: downloading === `${year}-${report.type}` ? 0.7 : 1
                }}
                data-testid={`download-${year}-${report.type}`}
              >
                {downloading === `${year}-${report.type}` ? (
                  <Loader2 size={16} className="spinner" />
                ) : (
                  <Download size={16} />
                )}
                {t('buttons.download') || 'Download'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: colors.background }}>
      <AppHeader showBack={true} title={t('navigation.tax_reports') || 'Tax Reports'} showUserName={true} />

      <div style={{ padding: '76px 16px 100px', maxWidth: '600px', margin: '0 auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
            <Loader2 size={32} color={colors.primary} className="spinner" />
          </div>
        ) : (
          <>
            {/* Info Banner */}
            <div style={{
              backgroundColor: colors.primaryLight,
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start'
            }}>
              <AlertCircle size={20} color={colors.primary} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ color: colors.primary, fontSize: '14px', fontWeight: 500 }}>
                  {t('tax_reports.info_title') || 'Tax Document Information'}
                </p>
                <p style={{ color: colors.text, fontSize: '13px', marginTop: '4px' }}>
                  {t('tax_reports.info_desc') || 'Tax documents are typically available by January 31st for the previous tax year. Documents will only be generated if you have qualifying transactions.'}
                </p>
              </div>
            </div>

            {/* Tax Year Cards */}
            {years.map((year) => (
              <TaxYearCard 
                key={year} 
                year={year} 
                hasData={taxReports.some(r => r.year === year)}
              />
            ))}

            {/* Help Section */}
            <div style={{
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <h3 style={{ color: colors.text, marginBottom: '8px', fontSize: '16px' }}>
                {t('tax_reports.need_help') || 'Need Help?'}
              </h3>
              <p style={{ color: colors.textMuted, fontSize: '14px', marginBottom: '16px' }}>
                {t('tax_reports.help_desc') || 'Contact our support team for tax-related questions.'}
              </p>
              <button style={{
                backgroundColor: colors.primary,
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '15px'
              }}>
                {t('buttons.contact_support') || 'Contact Support'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
