import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, MapPin, Edit2, Camera, Save, Loader, Sun, Moon, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './ProfilePage.css';

const ProfilePage = () => {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    bio: '',
    location: '',
  });

  const { user, logout, refreshUser } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.bio || '',
        location: user.location || '',
      });
    }
  }, [user]);

  const handleSave = async () => {
    try {
      setLoading(true);
      await api.put('/auth/profile', {
        name: profile.name,
        phone: profile.phone,
        bio: profile.bio,
        location: profile.location,
      });
      await refreshUser();
      setEditing(false);
      showSuccess(t('pages.profile.update_success'));
    } catch (err) {
      showError(t('messages.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const getHomeRoute = () => {
    if (user?.role === 'admin') return '/admin';
    if (user?.role === 'tutor') return '/tutor/dashboard';
    return '/home';
  };

  return (
    <div className="profile-page" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <header className="profile-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <button 
            className="back-btn" 
            onClick={() => navigate(getHomeRoute())}
            style={{ color: colors.text }}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ color: colors.text }}>{t('pages.profile.title')}</h1>
          {!editing ? (
            <button 
              className="edit-btn" 
              onClick={() => setEditing(true)}
              style={{ color: colors.primary }}
              data-testid="edit-profile-btn"
            >
              <Edit2 size={20} />
            </button>
          ) : (
            <button 
              className="save-btn" 
              onClick={handleSave}
              disabled={loading}
              style={{ color: colors.primary }}
              data-testid="save-profile-btn"
            >
              {loading ? <Loader className="spinner" size={20} /> : <Save size={20} />}
            </button>
          )}
        </div>
      </header>

      <main className="profile-main">
        <div className="profile-container">
          {/* Avatar Section */}
          <div className="avatar-section">
            <div className="avatar-wrapper">
              <div className="avatar" style={{ backgroundColor: colors.primary }}>
                {user?.profile_picture ? (
                  <img src={user.profile_picture} alt={user.name} />
                ) : (
                  <span style={{ color: colors.textInverse }}>
                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              {editing && (
                <button className="camera-btn" style={{ backgroundColor: colors.primary }}>
                  <Camera size={18} color={colors.textInverse} />
                </button>
              )}
            </div>
            <h2 style={{ color: colors.text }}>{user?.name}</h2>
            <p style={{ color: colors.textMuted }}>{user?.email}</p>
            <span 
              className="role-badge" 
              style={{ backgroundColor: colors.primaryLight, color: colors.primary }}
            >
              {user?.role}
            </span>
          </div>

          {/* Profile Form */}
          <div className="profile-card" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <h3 style={{ color: colors.text }}>{t('pages.profile.personal_info')}</h3>

            <div className="form-group">
              <label style={{ color: colors.textMuted }}>
                <User size={16} /> {t('forms.labels.full_name')}
              </label>
              {editing ? (
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="profile-name-input"
                />
              ) : (
                <p style={{ color: colors.text }}>{profile.name || '-'}</p>
              )}
            </div>

            <div className="form-group">
              <label style={{ color: colors.textMuted }}>
                <Mail size={16} /> {t('forms.labels.email_address')}
              </label>
              <p style={{ color: colors.text }}>{profile.email || '-'}</p>
            </div>

            <div className="form-group">
              <label style={{ color: colors.textMuted }}>
                <Phone size={16} /> {t('forms.labels.phone')}
              </label>
              {editing ? (
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder={t('forms.placeholders.phone')}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="profile-phone-input"
                />
              ) : (
                <p style={{ color: colors.text }}>{profile.phone || '-'}</p>
              )}
            </div>

            <div className="form-group">
              <label style={{ color: colors.textMuted }}>
                <MapPin size={16} /> {t('forms.labels.location')}
              </label>
              {editing ? (
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder={t('forms.placeholders.location')}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="profile-location-input"
                />
              ) : (
                <p style={{ color: colors.text }}>{profile.location || '-'}</p>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="profile-card" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <h3 style={{ color: colors.text }}>{t('pages.profile.settings')}</h3>

            <button 
              className="setting-item"
              onClick={toggleTheme}
              data-testid="theme-toggle"
            >
              <span style={{ color: colors.text }}>
                {isDark ? <Moon size={20} /> : <Sun size={20} />}
                {t('pages.profile.theme')}
              </span>
              <span style={{ color: colors.textMuted }}>
                {isDark ? t('pages.profile.dark_mode') : t('pages.profile.light_mode')}
                <ChevronRight size={18} />
              </span>
            </button>

            <button 
              className="setting-item danger"
              onClick={logout}
              data-testid="logout-btn"
            >
              <span style={{ color: colors.error }}>
                <LogOut size={20} />
                {t('buttons.logout')}
              </span>
              <ChevronRight size={18} color={colors.error} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
