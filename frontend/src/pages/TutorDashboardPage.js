import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calendar, Users, DollarSign, Clock, Settings, LogOut, Sun, Moon, Plus, ChevronRight, Loader, User, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import { format, parseISO } from 'date-fns';
import './TutorDashboardPage.css';

const TutorDashboardPage = () => {
  const [stats, setStats] = useState({ bookings: 0, students: 0, earnings: 0 });
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, sessionsRes] = await Promise.all([
        api.get('/tutor/stats').catch(() => ({ data: {} })),
        api.get('/tutor/sessions/upcoming').catch(() => ({ data: { sessions: [] } })),
      ]);
      setStats(statsRes.data || { bookings: 0, students: 0, earnings: 0 });
      setUpcomingSessions(sessionsRes.data.sessions || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr) => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'MMM d, h:mm a');
    } catch {
      return dateStr;
    }
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="stat-card" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <div className="stat-icon" style={{ backgroundColor: color + '20' }}>
        <Icon size={22} color={color} />
      </div>
      <div className="stat-info">
        <span className="stat-value" style={{ color: colors.text }}>{value}</span>
        <span className="stat-label" style={{ color: colors.textMuted }}>{label}</span>
      </div>
    </div>
  );

  return (
    <div className="tutor-dashboard" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <header className="dashboard-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <div className="header-left">
            <img
              src={isDark ? '/mh_logo_dark_trimmed.png' : '/mh_logo_trimmed.png'}
              alt="Maestro Habitat"
              className="header-logo"
            />
          </div>
          <div className="header-right">
            <button className="icon-btn" onClick={toggleTheme} style={{ color: colors.textMuted }}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="icon-btn" onClick={logout} style={{ color: colors.textMuted }}>
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Welcome Section */}
          <div className="welcome-section">
            <h1 style={{ color: colors.text }}>
              {t('pages.tutor_dashboard.welcome')}, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p style={{ color: colors.textMuted }}>{t('pages.tutor_dashboard.subtitle')}</p>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <StatCard
              icon={Calendar}
              label={t('pages.tutor_dashboard.total_bookings')}
              value={stats.bookings || 0}
              color={colors.primary}
            />
            <StatCard
              icon={Users}
              label={t('pages.tutor_dashboard.total_students')}
              value={stats.students || 0}
              color="#10B981"
            />
            <StatCard
              icon={DollarSign}
              label={t('pages.tutor_dashboard.total_earnings')}
              value={`$${stats.earnings || 0}`}
              color="#F59E0B"
            />
          </div>

          {/* Quick Actions */}
          <div className="quick-actions">
            <h2 style={{ color: colors.text }}>{t('pages.tutor_dashboard.quick_actions')}</h2>
            <div className="actions-grid">
              <Link 
                to="/tutor/calendar" 
                className="action-card" 
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                data-testid="manage-calendar-btn"
              >
                <div className="action-icon" style={{ backgroundColor: colors.primaryLight }}>
                  <Calendar size={24} color={colors.primary} />
                </div>
                <span style={{ color: colors.text }}>{t('pages.tutor_dashboard.manage_calendar')}</span>
                <ChevronRight size={18} color={colors.textMuted} />
              </Link>
              <Link 
                to="/bookings" 
                className="action-card" 
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                data-testid="view-bookings-btn"
              >
                <div className="action-icon" style={{ backgroundColor: '#10B98120' }}>
                  <Users size={24} color="#10B981" />
                </div>
                <span style={{ color: colors.text }}>{t('pages.tutor_dashboard.view_bookings')}</span>
                <ChevronRight size={18} color={colors.textMuted} />
              </Link>
              <Link 
                to="/profile" 
                className="action-card" 
                style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                data-testid="edit-profile-btn"
              >
                <div className="action-icon" style={{ backgroundColor: '#F59E0B20' }}>
                  <Settings size={24} color="#F59E0B" />
                </div>
                <span style={{ color: colors.text }}>{t('pages.tutor_dashboard.edit_profile')}</span>
                <ChevronRight size={18} color={colors.textMuted} />
              </Link>
            </div>
          </div>

          {/* Upcoming Sessions */}
          <div className="sessions-section" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <div className="section-header">
              <h2 style={{ color: colors.text }}>
                <Clock size={20} /> {t('pages.tutor_dashboard.upcoming_sessions')}
              </h2>
              <button onClick={fetchDashboardData} style={{ color: colors.primary }}>
                <RefreshCw size={18} />
              </button>
            </div>

            {loading ? (
              <div className="loading-state">
                <Loader className="spinner" size={24} color={colors.primary} />
              </div>
            ) : upcomingSessions.length === 0 ? (
              <div className="empty-sessions">
                <Calendar size={40} color={colors.gray300} />
                <p style={{ color: colors.textMuted }}>{t('pages.tutor_dashboard.no_upcoming')}</p>
              </div>
            ) : (
              <div className="sessions-list">
                {upcomingSessions.slice(0, 5).map((session) => (
                  <div 
                    key={session.booking_id} 
                    className="session-item"
                    style={{ borderColor: colors.border }}
                  >
                    <div className="session-avatar" style={{ backgroundColor: colors.primaryLight }}>
                      <User size={18} color={colors.primary} />
                    </div>
                    <div className="session-info">
                      <h4 style={{ color: colors.text }}>{session.student_name || 'Student'}</h4>
                      <span style={{ color: colors.textMuted }}>{session.topic}</span>
                    </div>
                    <div className="session-time" style={{ color: colors.primary }}>
                      {formatDateTime(session.start_time)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default TutorDashboardPage;
