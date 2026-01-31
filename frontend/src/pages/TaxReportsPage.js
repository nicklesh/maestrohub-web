import React from 'react';
import { ArrowLeft, FileText, Download, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';

export default function TaxReportsPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const currentYear = new Date().getFullYear();

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
          {t('navigation.tax_reports')}
        </h1>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Calendar size={24} color={colors.primary} />
            <h3 style={{ color: colors.text, fontSize: '18px', fontWeight: 600 }}>
              {currentYear} {t('tax_reports.tax_year') || 'Tax Year'}
            </h3>
          </div>
          
          <div style={{
            backgroundColor: colors.background,
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FileText size={24} color={colors.textMuted} />
              <div>
                <p style={{ color: colors.text, fontWeight: 500 }}>
                  {t('tax_reports.annual_statement') || 'Annual Statement'}
                </p>
                <p style={{ color: colors.textMuted, fontSize: '13px' }}>
                  {t('tax_reports.pdf_format') || 'PDF Format'}
                </p>
              </div>
            </div>
            <button style={{
              backgroundColor: colors.primaryLight,
              color: colors.primary,
              padding: '8px 16px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px',
              fontWeight: 600
            }}>
              <Download size={16} />
              {t('buttons.download') || 'Download'}
            </button>
          </div>
        </div>

        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'center'
        }}>
          <FileText size={48} color={colors.gray300} style={{ marginBottom: '16px' }} />
          <p style={{ color: colors.textMuted }}>
            {t('tax_reports.no_reports') || 'No tax documents available yet. Complete transactions to generate tax reports.'}
          </p>
        </div>
      </div>
    </div>
  );
}
