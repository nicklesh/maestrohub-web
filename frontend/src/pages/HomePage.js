import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Calendar, Users, User, Lightbulb, ChevronRight, LogOut, Sun, Moon, Menu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import './HomePage.css';

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

const HomePage = () => {
  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const firstName = user?.name?.split(' ')[0] || '';

  return (
    <div className="home-page" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <header className="home-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <div className="header-left">
            <img
              src={isDark ? '/mh_logo_dark_trimmed.png' : '/mh_logo_trimmed.png'}
              alt="Maestro Habitat"
              className="header-logo"
            />
          </div>
          <div className="header-right">
            <button 
              className="icon-btn" 
              onClick={toggleTheme}
              style={{ color: colors.textMuted }}
              data-testid="theme-toggle-btn"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button 
              className="icon-btn" 
              onClick={logout}
              style={{ color: colors.textMuted }}
              data-testid="logout-btn"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="home-main">
        <div className="home-container">
          {/* Welcome Section */}
          <div className="welcome-section">
            <h1 className="welcome-text" style={{ color: colors.text }}>
              {t('pages.home.welcome_back')}{firstName ? `, ${firstName}` : ''}! 👋
            </h1>
            <p className="welcome-subtext" style={{ color: colors.textMuted }}>
              {t('pages.home.what_would_you_like')}
            </p>
          </div>

          {/* Navigation Cards */}
          <div className="nav-grid">
            {NAV_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.id}
                  to={card.route}
                  className="nav-card"
                  style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                  data-testid={`nav-card-${card.id}`}
                >
                  <div 
                    className="nav-card-icon" 
                    style={{ backgroundColor: `${card.gradient[0]}20` }}
                  >
                    <Icon size={28} color={isDark ? colors.primary : card.gradient[0]} />
                  </div>
                  <h3 className="nav-card-title" style={{ color: colors.text }}>
                    {t(card.titleKey)}
                  </h3>
                  <p className="nav-card-desc" style={{ color: colors.textMuted }}>
                    {t(card.descriptionKey)}
                  </p>
                  <div className="nav-card-arrow" style={{ backgroundColor: colors.gray100 }}>
                    <ChevronRight size={18} color={colors.textMuted} />
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Quick Tip Section */}
          <div className="info-section">
            <div className="info-card" style={{ backgroundColor: colors.primaryLight }}>
              <Lightbulb size={24} color={colors.primary} />
              <div className="info-text">
                <h4 style={{ color: colors.text }}>{t('pages.home.quick_tip_title')}</h4>
                <p style={{ color: colors.textMuted }}>{t('pages.home.quick_tip_text')}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HomePage;
