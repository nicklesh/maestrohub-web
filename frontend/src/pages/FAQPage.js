import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle, ChevronDown, ChevronUp, Search, MessageCircle } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import './FAQPage.css';

const FAQ_CATEGORIES = [
  { id: 'getting_started', labelKey: 'pages.faq.getting_started' },
  { id: 'bookings', labelKey: 'pages.faq.booking_sessions' },
  { id: 'payments', labelKey: 'pages.faq.payments_billing' },
  { id: 'for_coaches', labelKey: 'pages.faq.for_coaches' },
  { id: 'technical', labelKey: 'pages.faq.technical_support' },
];

const FAQ_ITEMS = {
  getting_started: [
    { q: 'pages.faq.questions.how_create_account', a: 'pages.faq.answers.how_create_account' },
    { q: 'pages.faq.questions.how_find_coach', a: 'pages.faq.answers.how_find_coach' },
    { q: 'pages.faq.questions.is_info_secure', a: 'pages.faq.answers.is_info_secure' },
  ],
  bookings: [
    { q: 'pages.faq.questions.how_book_session', a: 'pages.faq.answers.how_book_session' },
    { q: 'pages.faq.questions.can_reschedule', a: 'pages.faq.answers.can_reschedule' },
    { q: 'pages.faq.questions.coach_cancels', a: 'pages.faq.answers.coach_cancels' },
  ],
  payments: [
    { q: 'pages.faq.questions.payment_methods', a: 'pages.faq.answers.payment_methods' },
    { q: 'pages.faq.questions.when_charged', a: 'pages.faq.answers.when_charged' },
    { q: 'pages.faq.questions.view_payment_history', a: 'pages.faq.answers.view_payment_history' },
  ],
  for_coaches: [
    { q: 'pages.faq.questions.become_coach', a: 'pages.faq.answers.become_coach' },
    { q: 'pages.faq.questions.set_availability', a: 'pages.faq.answers.set_availability' },
    { q: 'pages.faq.questions.when_get_paid', a: 'pages.faq.answers.when_get_paid' },
  ],
  technical: [
    { q: 'pages.faq.questions.app_not_working', a: 'pages.faq.answers.app_not_working' },
    { q: 'pages.faq.questions.update_profile', a: 'pages.faq.answers.update_profile' },
    { q: 'pages.faq.questions.contact_support', a: 'pages.faq.answers.contact_support' },
  ],
};

const FAQPage = () => {
  const [activeCategory, setActiveCategory] = useState('getting_started');
  const [expandedItems, setExpandedItems] = useState({});
  const [searchQuery, setSearchQuery] = useState('');

  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const toggleItem = (index) => {
    setExpandedItems((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const filteredFAQs = FAQ_ITEMS[activeCategory] || [];

  return (
    <div className="faq-page" style={{ backgroundColor: colors.background }}>
      <header className="faq-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate(-1)} style={{ color: colors.text }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ color: colors.text }}>{t('pages.faq.title')}</h1>
          <div style={{ width: 40 }} />
        </div>
      </header>

      <main className="faq-main">
        <div className="faq-container">
          {/* Search */}
          <div className="search-bar" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <Search size={20} color={colors.textMuted} />
            <input
              type="text"
              placeholder={t('forms.placeholders.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ color: colors.text }}
            />
          </div>

          {/* Categories */}
          <div className="categories-scroll">
            {FAQ_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  backgroundColor: activeCategory === cat.id ? colors.primary : colors.surface,
                  color: activeCategory === cat.id ? colors.textInverse : colors.text,
                  borderColor: colors.border,
                }}
              >
                {t(cat.labelKey)}
              </button>
            ))}
          </div>

          {/* FAQ Items */}
          <div className="faq-list">
            {filteredFAQs.map((item, index) => (
              <div
                key={index}
                className="faq-item"
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              >
                <button
                  className="faq-question"
                  onClick={() => toggleItem(index)}
                  style={{ color: colors.text }}
                >
                  <span>{t(item.q)}</span>
                  {expandedItems[index] ? (
                    <ChevronUp size={20} color={colors.textMuted} />
                  ) : (
                    <ChevronDown size={20} color={colors.textMuted} />
                  )}
                </button>
                {expandedItems[index] && (
                  <div className="faq-answer" style={{ color: colors.textMuted }}>
                    {t(item.a)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Contact Support */}
          <div className="contact-section" style={{ backgroundColor: colors.primaryLight }}>
            <HelpCircle size={32} color={colors.primary} />
            <h3 style={{ color: colors.text }}>{t('pages.faq.still_need_help')}</h3>
            <p style={{ color: colors.textMuted }}>{t('pages.faq.contact_us_text')}</p>
            <button
              className="contact-btn"
              onClick={() => navigate('/contact')}
              style={{ backgroundColor: colors.primary }}
            >
              <MessageCircle size={18} />
              {t('pages.faq.contact_us')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FAQPage;
