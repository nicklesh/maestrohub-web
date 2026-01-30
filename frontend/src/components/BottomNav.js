import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Search, Calendar, User, LayoutDashboard, Mail, Users, Globe, BarChart3, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import './BottomNav.css';

// Consumer/Parent Navigation Items
const CONSUMER_NAV = [
  { id: 'home', path: '/home', icon: Home, labelKey: 'navigation.home' },
  { id: 'search', path: '/search', icon: Search, labelKey: 'navigation.search' },
  { id: 'bookings', path: '/bookings', icon: Calendar, labelKey: 'navigation.bookings' },
  { id: 'profile', path: '/profile', icon: User, labelKey: 'navigation.account' },
];

// Tutor Navigation Items
const TUTOR_NAV = [
  { id: 'dashboard', path: '/tutor/dashboard', icon: LayoutDashboard, labelKey: 'navigation.dashboard' },
  { id: 'calendar', path: '/tutor/calendar', icon: Calendar, labelKey: 'navigation.calendar' },
  { id: 'bookings', path: '/bookings', icon: Users, labelKey: 'navigation.students' },
  { id: 'profile', path: '/profile', icon: Settings, labelKey: 'navigation.settings' },
];

// Admin Navigation Items
const ADMIN_NAV = [
  { id: 'dashboard', path: '/admin', icon: LayoutDashboard, labelKey: 'navigation.dashboard' },
  { id: 'inbox', path: '/admin/inbox', icon: Mail, labelKey: 'navigation.inbox' },
  { id: 'coaches', path: '/admin/coaches', icon: Users, labelKey: 'navigation.tutors' },
  { id: 'markets', path: '/admin/markets', icon: Globe, labelKey: 'navigation.markets' },
  { id: 'reports', path: '/admin/reports', icon: BarChart3, labelKey: 'navigation.reports' },
  { id: 'settings', path: '/profile', icon: Settings, labelKey: 'navigation.settings' },
];

const BottomNav = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();

  if (!user) return null;

  // Determine which navigation items to show based on user role
  let navItems = CONSUMER_NAV;
  if (user.role === 'admin') {
    navItems = ADMIN_NAV;
  } else if (user.role === 'tutor') {
    navItems = TUTOR_NAV;
  }

  // Check if current path matches or starts with the nav item path
  const isActive = (path) => {
    if (path === '/home' && location.pathname === '/home') return true;
    if (path === '/admin' && location.pathname === '/admin') return true;
    if (path === '/tutor/dashboard' && location.pathname === '/tutor/dashboard') return true;
    if (path !== '/home' && path !== '/admin' && path !== '/tutor/dashboard') {
      return location.pathname.startsWith(path);
    }
    return false;
  };

  return (
    <nav 
      className="bottom-nav" 
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      data-testid="bottom-nav"
    >
      <div className="bottom-nav-container">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={`nav-item ${active ? 'active' : ''}`}
              data-testid={`nav-item-${item.id}`}
            >
              <div 
                className="nav-icon"
                style={{ 
                  color: active ? colors.primary : colors.textMuted,
                }}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
              </div>
              <span 
                className="nav-label"
                style={{ 
                  color: active ? colors.primary : colors.textMuted,
                  fontWeight: active ? 600 : 400,
                }}
              >
                {t(item.labelKey)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
