import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Calendar, DollarSign, TrendingUp, Settings, LogOut, Sun, Moon, ChevronRight, Loader, UserCheck, UserX, RefreshCw, Search, Filter, BarChart3 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './AdminDashboardPage.css';

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'coaches', label: 'Coaches', icon: UserCheck },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'bookings', label: 'Bookings', icon: Calendar },
];

const AdminDashboardPage = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({ totalUsers: 0, totalCoaches: 0, totalBookings: 0, revenue: 0 });
  const [coaches, setCoaches] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'overview') {
        const res = await api.get('/admin/stats').catch(() => ({ data: {} }));
        setStats(res.data || { totalUsers: 0, totalCoaches: 0, totalBookings: 0, revenue: 0 });
      } else if (activeTab === 'coaches') {
        const res = await api.get('/admin/coaches').catch(() => ({ data: { coaches: [] } }));
        setCoaches(res.data.coaches || []);
      } else if (activeTab === 'users') {
        const res = await api.get('/admin/users').catch(() => ({ data: { users: [] } }));
        setUsers(res.data.users || []);
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, label, value, color, trend }) => (
    <div className="admin-stat-card" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
      <div className="stat-header">
        <div className="stat-icon" style={{ backgroundColor: color + '20' }}>
          <Icon size={24} color={color} />
        </div>
        {trend && (
          <span className="stat-trend" style={{ color: colors.success }}>
            <TrendingUp size={14} /> {trend}
          </span>
        )}
      </div>
      <div className="stat-value" style={{ color: colors.text }}>{value}</div>
      <div className="stat-label" style={{ color: colors.textMuted }}>{label}</div>
    </div>
  );

  const renderOverview = () => (
    <div className="overview-section">
      <div className="stats-grid">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.totalUsers || 0}
          color={colors.primary}
          trend="+12%"
        />
        <StatCard
          icon={UserCheck}
          label="Active Coaches"
          value={stats.totalCoaches || 0}
          color="#10B981"
          trend="+8%"
        />
        <StatCard
          icon={Calendar}
          label="Total Bookings"
          value={stats.totalBookings || 0}
          color="#8B5CF6"
          trend="+24%"
        />
        <StatCard
          icon={DollarSign}
          label="Total Revenue"
          value={`$${stats.revenue || 0}`}
          color="#F59E0B"
          trend="+18%"
        />
      </div>

      <div className="quick-links">
        <h3 style={{ color: colors.text }}>Quick Actions</h3>
        <div className="links-grid">
          <button
            className="link-card"
            onClick={() => setActiveTab('coaches')}
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <UserCheck size={24} color={colors.primary} />
            <span style={{ color: colors.text }}>Manage Coaches</span>
            <ChevronRight size={18} color={colors.textMuted} />
          </button>
          <button
            className="link-card"
            onClick={() => setActiveTab('users')}
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Users size={24} color="#10B981" />
            <span style={{ color: colors.text }}>View All Users</span>
            <ChevronRight size={18} color={colors.textMuted} />
          </button>
          <button
            className="link-card"
            onClick={() => setActiveTab('bookings')}
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
          >
            <Calendar size={24} color="#8B5CF6" />
            <span style={{ color: colors.text }}>All Bookings</span>
            <ChevronRight size={18} color={colors.textMuted} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderCoaches = () => (
    <div className="list-section">
      <div className="list-header">
        <h3 style={{ color: colors.text }}>Coaches ({coaches.length})</h3>
        <button onClick={fetchData} style={{ color: colors.primary }}>
          <RefreshCw size={18} />
        </button>
      </div>
      
      {coaches.length === 0 ? (
        <div className="empty-state">
          <UserCheck size={48} color={colors.gray300} />
          <p style={{ color: colors.textMuted }}>No coaches found</p>
        </div>
      ) : (
        <div className="user-list">
          {coaches.map((coach) => (
            <div 
              key={coach.user_id} 
              className="user-item"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <div className="user-avatar" style={{ backgroundColor: colors.primaryLight }}>
                <span style={{ color: colors.primary }}>{coach.name?.charAt(0)?.toUpperCase()}</span>
              </div>
              <div className="user-info">
                <h4 style={{ color: colors.text }}>{coach.name}</h4>
                <span style={{ color: colors.textMuted }}>{coach.email}</span>
              </div>
              <span 
                className="user-status"
                style={{ 
                  backgroundColor: coach.is_verified ? colors.successLight : colors.warningLight,
                  color: coach.is_verified ? colors.success : colors.warning,
                }}
              >
                {coach.is_verified ? 'Verified' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderUsers = () => (
    <div className="list-section">
      <div className="list-header">
        <h3 style={{ color: colors.text }}>All Users ({users.length})</h3>
        <button onClick={fetchData} style={{ color: colors.primary }}>
          <RefreshCw size={18} />
        </button>
      </div>
      
      {users.length === 0 ? (
        <div className="empty-state">
          <Users size={48} color={colors.gray300} />
          <p style={{ color: colors.textMuted }}>No users found</p>
        </div>
      ) : (
        <div className="user-list">
          {users.map((u) => (
            <div 
              key={u.user_id} 
              className="user-item"
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            >
              <div className="user-avatar" style={{ backgroundColor: colors.gray100 }}>
                <span style={{ color: colors.textMuted }}>{u.name?.charAt(0)?.toUpperCase()}</span>
              </div>
              <div className="user-info">
                <h4 style={{ color: colors.text }}>{u.name}</h4>
                <span style={{ color: colors.textMuted }}>{u.email}</span>
              </div>
              <span 
                className="user-role"
                style={{ backgroundColor: colors.primaryLight, color: colors.primary }}
              >
                {u.role}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderBookings = () => (
    <div className="list-section">
      <div className="empty-state">
        <Calendar size={48} color={colors.gray300} />
        <p style={{ color: colors.textMuted }}>Booking management coming soon</p>
      </div>
    </div>
  );

  return (
    <div className="admin-dashboard" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <header className="admin-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <div className="header-left">
            <img
              src={isDark ? '/mh_logo_dark_trimmed.png' : '/mh_logo_trimmed.png'}
              alt="Maestro Habitat"
              className="header-logo"
            />
            <span className="admin-badge" style={{ backgroundColor: colors.error + '20', color: colors.error }}>
              Admin
            </span>
          </div>
          <div className="header-right">
            <button className="icon-btn" onClick={toggleTheme} style={{ color: colors.textMuted }}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <Link to="/profile" className="icon-btn" style={{ color: colors.textMuted }}>
              <Settings size={20} />
            </Link>
            <button className="icon-btn" onClick={logout} style={{ color: colors.textMuted }}>
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="admin-tabs" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="tabs-container">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  color: activeTab === tab.id ? colors.primary : colors.textMuted,
                  borderColor: activeTab === tab.id ? colors.primary : 'transparent',
                }}
                data-testid={`admin-tab-${tab.id}`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="admin-main">
        <div className="admin-container">
          {loading ? (
            <div className="loading-state">
              <Loader className="spinner" size={32} color={colors.primary} />
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'coaches' && renderCoaches()}
              {activeTab === 'users' && renderUsers()}
              {activeTab === 'bookings' && renderBookings()}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
