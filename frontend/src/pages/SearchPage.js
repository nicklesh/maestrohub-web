import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Filter, MapPin, Star, ArrowLeft, ChevronRight, Clock, Users, Loader, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import './SearchPage.css';

const SearchPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    topic: '',
    priceMin: '',
    priceMax: '',
    sessionType: '',
  });

  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const { showError } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTutors();
  }, []);

  const fetchTutors = async (query = '', appliedFilters = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.append('search', query);
      if (appliedFilters.topic) params.append('topic', appliedFilters.topic);
      if (appliedFilters.priceMin) params.append('price_min', appliedFilters.priceMin);
      if (appliedFilters.priceMax) params.append('price_max', appliedFilters.priceMax);
      if (appliedFilters.sessionType) params.append('session_type', appliedFilters.sessionType);

      const response = await api.get(`/tutors/search?${params.toString()}`);
      setTutors(response.data.tutors || []);
    } catch (err) {
      console.error('Error fetching tutors:', err);
      // showError(t('messages.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchTutors(searchQuery, filters);
  };

  const applyFilters = () => {
    fetchTutors(searchQuery, filters);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setFilters({ topic: '', priceMin: '', priceMax: '', sessionType: '' });
    fetchTutors(searchQuery, {});
  };

  const renderTutorCard = (tutor) => (
    <Link
      key={tutor.user_id}
      to={`/tutor/${tutor.user_id}`}
      className="tutor-card"
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      data-testid={`tutor-card-${tutor.user_id}`}
    >
      <div className="tutor-card-header">
        <div className="tutor-avatar" style={{ backgroundColor: colors.primary }}>
          {tutor.profile_picture ? (
            <img src={tutor.profile_picture} alt={tutor.name} />
          ) : (
            <span style={{ color: colors.textInverse }}>{tutor.name?.charAt(0)?.toUpperCase()}</span>
          )}
        </div>
        <div className="tutor-info">
          <h3 style={{ color: colors.text }}>{tutor.name}</h3>
          {tutor.topics?.length > 0 && (
            <div className="tutor-topics">
              {tutor.topics.slice(0, 3).map((topic, idx) => (
                <span 
                  key={idx} 
                  className="topic-tag" 
                  style={{ backgroundColor: colors.primaryLight, color: colors.primary }}
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
        {tutor.rating && (
          <div className="tutor-rating" style={{ backgroundColor: colors.warning + '20' }}>
            <Star size={14} fill={colors.warning} color={colors.warning} />
            <span style={{ color: colors.warning }}>{tutor.rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {tutor.bio && (
        <p className="tutor-bio" style={{ color: colors.textMuted }}>
          {tutor.bio.length > 100 ? tutor.bio.substring(0, 100) + '...' : tutor.bio}
        </p>
      )}

      <div className="tutor-meta">
        {tutor.location && (
          <span style={{ color: colors.textMuted }}>
            <MapPin size={14} /> {tutor.location}
          </span>
        )}
        {tutor.session_rate && (
          <span style={{ color: colors.success }}>
            ${tutor.session_rate}/hr
          </span>
        )}
        {tutor.session_count > 0 && (
          <span style={{ color: colors.textMuted }}>
            <Users size={14} /> {tutor.session_count} sessions
          </span>
        )}
      </div>

      <div className="tutor-card-arrow" style={{ color: colors.primary }}>
        <ChevronRight size={20} />
      </div>
    </Link>
  );

  return (
    <div className="search-page" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <header className="search-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <button 
            className="back-btn" 
            onClick={() => navigate('/home')}
            style={{ color: colors.text }}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ color: colors.text }}>{t('pages.search.title')}</h1>
          <button 
            className="filter-btn" 
            onClick={() => setFilterOpen(true)}
            style={{ color: colors.primary, backgroundColor: colors.primaryLight }}
            data-testid="filter-btn"
          >
            <Filter size={18} />
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="search-bar-container">
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            <Search size={20} color={colors.textMuted} />
            <input
              type="text"
              placeholder={t('pages.search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ color: colors.text }}
              data-testid="search-input"
            />
            {searchQuery && (
              <button type="button" onClick={() => { setSearchQuery(''); fetchTutors('', filters); }}>
                <X size={18} color={colors.textMuted} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Content */}
      <main className="search-content">
        {loading ? (
          <div className="loading-state">
            <Loader className="spinner" size={32} color={colors.primary} />
            <p style={{ color: colors.textMuted }}>{t('pages.search.searching')}</p>
          </div>
        ) : tutors.length === 0 ? (
          <div className="empty-state">
            <Search size={64} color={colors.gray300} />
            <h3 style={{ color: colors.text }}>{t('pages.search.no_results_title')}</h3>
            <p style={{ color: colors.textMuted }}>{t('pages.search.no_results_message')}</p>
          </div>
        ) : (
          <div className="tutors-list">
            <p className="results-count" style={{ color: colors.textMuted }}>
              {tutors.length} {tutors.length === 1 ? 'coach' : 'coaches'} found
            </p>
            {tutors.map(renderTutorCard)}
          </div>
        )}
      </main>

      {/* Filter Modal */}
      {filterOpen && (
        <div className="filter-modal-overlay" onClick={() => setFilterOpen(false)}>
          <div 
            className="filter-modal" 
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="filter-header">
              <h2 style={{ color: colors.text }}>{t('pages.search.filters.title')}</h2>
              <button onClick={() => setFilterOpen(false)}>
                <X size={24} color={colors.text} />
              </button>
            </div>

            <div className="filter-content">
              <div className="filter-group">
                <label style={{ color: colors.text }}>{t('pages.search.filters.topic')}</label>
                <input
                  type="text"
                  placeholder="e.g., Piano, Tennis, Math"
                  value={filters.topic}
                  onChange={(e) => setFilters({ ...filters, topic: e.target.value })}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                />
              </div>

              <div className="filter-row">
                <div className="filter-group">
                  <label style={{ color: colors.text }}>{t('pages.search.filters.price_min')}</label>
                  <input
                    type="number"
                    placeholder="$0"
                    value={filters.priceMin}
                    onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
                    style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  />
                </div>
                <div className="filter-group">
                  <label style={{ color: colors.text }}>{t('pages.search.filters.price_max')}</label>
                  <input
                    type="number"
                    placeholder="$500"
                    value={filters.priceMax}
                    onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
                    style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  />
                </div>
              </div>

              <div className="filter-group">
                <label style={{ color: colors.text }}>{t('pages.search.filters.session_type')}</label>
                <select
                  value={filters.sessionType}
                  onChange={(e) => setFilters({ ...filters, sessionType: e.target.value })}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                >
                  <option value="">{t('pages.search.filters.all_types')}</option>
                  <option value="in_person">{t('pages.search.filters.in_person')}</option>
                  <option value="online">{t('pages.search.filters.online')}</option>
                </select>
              </div>
            </div>

            <div className="filter-actions">
              <button 
                className="clear-btn" 
                onClick={clearFilters}
                style={{ color: colors.primary, borderColor: colors.primary }}
              >
                {t('pages.search.filters.clear')}
              </button>
              <button 
                className="apply-btn" 
                onClick={applyFilters}
                style={{ backgroundColor: colors.primary }}
                data-testid="apply-filters-btn"
              >
                {t('pages.search.filters.apply')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchPage;
