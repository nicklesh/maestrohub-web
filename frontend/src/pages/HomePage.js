import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, Users, User, Lightbulb, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import './HomePage.css';

// Navigation card configuration matching mobile app exactly
const NAV_CARDS = [
  {
    id: 'search',
    titleKey: 'pages.home.card_search_coach',
    descriptionKey: 'pages.home.card_search_coach_desc',
    icon: Search,
    route: '/search',
    gradient: ['#3B82F6', '#2563EB'],
  },
  {
    id: 'bookings',
    titleKey: 'pages.home.card_your_bookings',
    descriptionKey: 'pages.home.card_your_bookings_desc',
    icon: Calendar,
    route: '/bookings',
    gradient: ['#10B981', '#059669'],
  },
  {
    id: 'kids',
    titleKey: 'pages.home.card_my_kids_sessions',
    descriptionKey: 'pages.home.card_my_kids_sessions_desc',
    icon: Users,
    route: '/kids',
    gradient: ['#8B5CF6', '#7C3AED'],
  },
  {
    id: 'account',
    titleKey: 'pages.home.card_view_account',
    descriptionKey: 'pages.home.card_view_account_desc',
    icon: User,
    route: '/profile',
    gradient: ['#F59E0B', '#D97706'],
  },
];

export default function HomePage() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleCardPress = (route) => {
    navigate(route);
  };

  const renderNavigationCard = (card) => {
    const Icon = card.icon;
    
    return (
      <button
        key={card.id}
        className="nav-card"
        style={{ 
          backgroundColor: colors.surface, 
          borderColor: colors.border 
        }}
        onClick={() => handleCardPress(card.route)}
        data-testid={`home-card-${card.id}`}
      >
        <div 
          className="nav-card-icon-container" 
          style={{ backgroundColor: card.gradient[0] + '20' }}
        >
          <Icon
            size={32}
            color={isDark ? colors.primary : card.gradient[0]}
          />
        </div>
        <h3 className="nav-card-title" style={{ color: colors.text }}>
          {t(card.titleKey)}
        </h3>
        <p className="nav-card-description" style={{ color: colors.textMuted }}>
          {t(card.descriptionKey)}
        </p>
        <div className="nav-card-arrow" style={{ backgroundColor: colors.gray100 }}>
          <ArrowRight size={18} color={colors.textMuted} />
        </div>
      </button>
    );
  };

  return (
    <div className="home-page" style={{ backgroundColor: colors.background }}>
      <AppHeader />
      
      <main className="home-content">
        <div className="content-wrapper">
          {/* Welcome Section */}
          <div className="welcome-section">
            <h1 className="welcome-text" style={{ color: colors.text }}>
              {t('pages.home.welcome_back')}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
            </h1>
            <p className="welcome-subtext" style={{ color: colors.textMuted }}>
              {t('pages.home.what_would_you_like')}
            </p>
          </div>

          {/* 2x2 Navigation Grid */}
          <div className="nav-grid">
            {NAV_CARDS.map(renderNavigationCard)}
          </div>

          {/* Quick Tips Section */}
          <div className="info-section">
            <div 
              className="info-card" 
              style={{ backgroundColor: isDark ? colors.primaryLight : colors.primaryLight }}
            >
              <Lightbulb size={24} color={colors.primary} />
              <div className="info-text-container">
                <h4 className="info-title" style={{ color: colors.text }}>
                  {t('pages.home.quick_tip_title')}
                </h4>
                <p className="info-text" style={{ color: colors.textMuted }}>
                  {t('pages.home.quick_tip_text')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
