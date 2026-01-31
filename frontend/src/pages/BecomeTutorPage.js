import React from 'react';
import { ArrowLeft, GraduationCap, Check, Rocket, Clock, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';

export default function BecomeTutorPage() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const benefits = [
    { icon: DollarSign, text: t('become_coach.benefit_earnings') || 'Set your own rates and earn money doing what you love' },
    { icon: Clock, text: t('become_coach.benefit_flexible') || 'Flexible schedule - work when it suits you' },
    { icon: Rocket, text: t('become_coach.benefit_grow') || 'Grow your coaching business with our platform' },
  ];

  const requirements = [
    t('become_coach.req_expertise') || 'Expertise in your subject area',
    t('become_coach.req_availability') || 'Regular availability for sessions',
    t('become_coach.req_communication') || 'Excellent communication skills',
    t('become_coach.req_passion') || 'Passion for helping others learn',
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
          {t('navigation.become_coach')}
        </h1>
      </header>

      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {/* Hero */}
        <div style={{
          backgroundColor: colors.primary,
          borderRadius: '20px',
          padding: '32px 24px',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          <GraduationCap size={56} color="#fff" style={{ marginBottom: '16px' }} />
          <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            {t('become_coach.title') || 'Become a Coach'}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '15px' }}>
            {t('become_coach.subtitle') || 'Share your knowledge and help students achieve their goals'}
          </p>
        </div>

        {/* Benefits */}
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '16px'
        }}>
          <h3 style={{ color: colors.text, fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
            {t('become_coach.why_join') || 'Why Join Us?'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {benefits.map((benefit, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  backgroundColor: colors.primaryLight,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <benefit.icon size={20} color={colors.primary} />
                </div>
                <p style={{ color: colors.text, fontSize: '15px', lineHeight: 1.4 }}>{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Requirements */}
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h3 style={{ color: colors.text, fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
            {t('become_coach.requirements') || 'Requirements'}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {requirements.map((req, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Check size={18} color={colors.success} />
                <span style={{ color: colors.text, fontSize: '15px' }}>{req}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <button style={{
          width: '100%',
          padding: '16px',
          backgroundColor: colors.primary,
          color: '#fff',
          borderRadius: '14px',
          fontSize: '17px',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          <Rocket size={22} />
          {t('become_coach.apply_now') || 'Apply Now'}
        </button>
      </div>
    </div>
  );
}
