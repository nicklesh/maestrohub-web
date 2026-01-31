import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Home, Search, Calendar, Users, User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import './BottomNav.css';

export default function BottomNav() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const location = useLocation();

  // Consumer navigation items (matching mobile app exactly)
  const consumerNavItems = [
    { 
      to: '/home', 
      icon: Home, 
      label: t('navigation.home'),
      testId: 'nav-item-home'
    },
    { 
      to: '/search', 
      icon: Search, 
      label: t('navigation.search'),
      testId: 'nav-item-search'
    },
    { 
      to: '/bookings', 
      icon: Calendar, 
      label: t('navigation.bookings'),
      testId: 'nav-item-bookings'
    },
    { 
      to: '/kids', 
      icon: Users, 
      label: t('navigation.my_kids'),
      testId: 'nav-item-kids'
    },
    { 
      to: '/profile', 
      icon: User, 
      label: t('navigation.account'),
      testId: 'nav-item-profile'
    },
  ];

  // Tutor navigation items
  const tutorNavItems = [
    { 
      to: '/tutor/dashboard', 
      icon: Home, 
      label: t('navigation.dashboard'),
      testId: 'nav-item-dashboard'
    },
    { 
      to: '/tutor/calendar', 
      icon: Calendar, 
      label: t('navigation.calendar'),
      testId: 'nav-item-calendar'
    },
    { 
      to: '/tutor/bookings', 
      icon: Calendar, 
      label: t('navigation.bookings'),
      testId: 'nav-item-bookings'
    },
    { 
      to: '/tutor/profile', 
      icon: User, 
      label: t('navigation.account'),
      testId: 'nav-item-profile'
    },
  ];

  // Admin navigation items
  const adminNavItems = [
    { 
      to: '/admin/dashboard', 
      icon: Home, 
      label: t('navigation.dashboard'),
      testId: 'nav-item-dashboard'
    },
    { 
      to: '/admin/users', 
      icon: Users, 
      label: t('navigation.users'),
      testId: 'nav-item-users'
    },
    { 
      to: '/admin/profile', 
      icon: User, 
      label: t('navigation.account'),
      testId: 'nav-item-profile'
    },
  ];

  // Select nav items based on user role
  const getNavItems = () => {
    switch (user?.role) {
      case 'tutor':
        return tutorNavItems;
      case 'admin':
        return adminNavItems;
      default:
        return consumerNavItems;
    }
  };

  const navItems = getNavItems();

  return (
    <nav className="bottom-nav" style={{ backgroundColor: colors.surface, borderTopColor: colors.border }}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.to || 
                        (item.to === '/home' && location.pathname === '/') ||
                        (item.to !== '/home' && location.pathname.startsWith(item.to));
        
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`nav-item ${isActive ? 'active' : ''}`}
            data-testid={item.testId}
          >
            <div className="nav-icon-container">
              <Icon 
                size={22} 
                color={isActive ? colors.primary : colors.textMuted}
                strokeWidth={isActive ? 2.5 : 2}
                fill={isActive ? colors.primary : 'none'}
              />
            </div>
            <span 
              className="nav-label"
              style={{ color: isActive ? colors.primary : colors.textMuted }}
            >
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}
