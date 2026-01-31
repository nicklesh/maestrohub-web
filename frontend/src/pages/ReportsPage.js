import React from 'react';
import { ArrowLeft, BarChart3, TrendingUp, Calendar, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';

export default function ReportsPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const stats = [
    { label: t('reports.total_sessions') || 'Total Sessions', value: '0', icon: Calendar, color: colors.primary },
    { label: t('reports.total_spent') || 'Total Spent', value: '$0', icon: TrendingUp, color: colors.success },
    { label: t('reports.coaches_worked') || 'Coaches Worked With', value: '0', icon: Users, color: colors.warning },
  ];

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
          {t('navigation.reports')}
        </h1>
      </header>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '12px',
          marginBottom: '24px'
        }}>
          {stats.map((stat, idx) => (
            <div key={idx} style={{
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: '20px',
              textAlign: 'center'
            }}>
              <stat.icon size={32} color={stat.color} style={{ marginBottom: '8px' }} />
              <p style={{ color: colors.text, fontSize: '24px', fontWeight: 700 }}>{stat.value}</p>
              <p style={{ color: colors.textMuted, fontSize: '14px' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          textAlign: 'center'
        }}>
          <BarChart3 size={48} color={colors.gray300} style={{ marginBottom: '16px' }} />
          <p style={{ color: colors.textMuted }}>
            {t('reports.no_data') || 'No report data available yet. Book sessions to see your activity reports.'}
          </p>
        </div>
      </div>
    </div>
  );
}
