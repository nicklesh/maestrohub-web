import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, X, ChevronDown, Star, Folder, BookOpen, Video, MapPin, 
  Rocket, Leaf, Heart, Briefcase, DollarSign, Globe, Mic, GraduationCap, 
  Palette, Dumbbell, Check, Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import api from '../services/api';
import './SearchPage.css';

// Flag component
const FlagIcon = ({ countryCode, size = 16 }) => {
  const flagEmoji = {
    'US': '🇺🇸', 'GB': '🇬🇧', 'CA': '🇨🇦', 'AU': '🇦🇺', 'IN': '🇮🇳',
    'DE': '🇩🇪', 'FR': '🇫🇷', 'ES': '🇪🇸', 'IT': '🇮🇹', 'BR': '🇧🇷',
    'MX': '🇲🇽', 'JP': '🇯🇵', 'KR': '🇰🇷', 'CN': '🇨🇳', 'NL': '🇳🇱',
    'SE': '🇸🇪', 'NO': '🇳🇴', 'DK': '🇩🇰', 'FI': '🇫🇮', 'PL': '🇵🇱',
  };
  return <span style={{ fontSize: size }}>{flagEmoji[countryCode] || '🌍'}</span>;
};

// Category icon mapping
const getCategoryIcon = (categoryId) => {
  const iconMap = {
    'coaching_personal': Rocket,
    'health_mindfulness': Leaf,
    'fitness_nutrition': Dumbbell,
    'relationships_family': Heart,
    'business_communication': Briefcase,
    'finance_legal': DollarSign,
    'culture_inclusion': Globe,
    'performance_arts': Mic,
    'academics': GraduationCap,
    'activities_hobbies': Palette,
  };
  return iconMap[categoryId] || Folder;
};

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { colors, isDark } = useTheme();
  const { token } = useAuth();
  const { showError } = useToast();
  const { t, formatNumber } = useTranslation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [showGlobalCoaches, setShowGlobalCoaches] = useState(true);
  const [tutors, setTutors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResults, setShowResults] = useState(false);
  
  // Dropdown states
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);

  // Get subjects for selected category
  const availableSubjects = useMemo(() => {
    if (selectedCategory === 'all') {
      const allSubjects = categories.flatMap(cat => cat.subjects || []);
      return [...new Set(allSubjects)].sort();
    }
    const cat = categories.find(c => c.id === selectedCategory);
    return cat?.subjects || [];
  }, [selectedCategory, categories]);

  // Helper functions for translations
  const getCategoryName = (categoryId, originalName) => {
    if (!categoryId) return originalName || t('common.general');
    const key = `categories.${categoryId}`;
    const translated = t(key);
    return translated === key ? (originalName || categoryId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())) : translated;
  };

  const getSubjectName = (subjectId) => {
    if (!subjectId) return '';
    const normalizedKey = subjectId.toLowerCase().replace(/[&\s\-\/]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    const key = `subjects.${normalizedKey}`;
    const translated = t(key);
    return translated === key ? subjectId : translated;
  };

  const getModalityName = (modality) => {
    const m = modality.toLowerCase().replace('-', '_');
    switch (m) {
      case 'online': return t('pages.search.online');
      case 'in_person': return t('pages.search.in_person');
      case 'hybrid': return t('pages.search.hybrid');
      default: return modality;
    }
  };

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Handle URL params for category
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    if (categoryParam) {
      setSelectedCategory(categoryParam);
      setShowResults(true);
    }
  }, [searchParams]);

  // Search tutors when filters change
  useEffect(() => {
    if (showResults) {
      searchTutors();
    }
  }, [selectedCategory, selectedSubject, showGlobalCoaches, showResults]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      const transformedCategories = (response.data.categories || []).map(cat => ({
        id: cat.id || cat.name?.toLowerCase().replace(/[&\s]+/g, '_'),
        name: cat.name,
        subjects: (cat.subcategories || []).map(sub => typeof sub === 'string' ? sub : sub.name),
      }));
      setCategories(transformedCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setSelectedSubject('all');
    setShowResults(true);
    searchTutorsWithCategory(categoryId);
  };

  const searchTutorsWithCategory = async (categoryId) => {
    setLoading(true);
    setTutors([]);
    
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (categoryId !== 'all') params.append('category', categoryId);
      if (searchQuery) params.append('query', searchQuery);
      if (!showGlobalCoaches) params.append('local_only', 'true');

      const response = await api.get(`/tutors/search?${params}`);
      setTutors(response.data.tutors || []);
    } catch (error) {
      console.error('Failed to search tutors:', error);
      showError(t('messages.errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const searchTutors = async () => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedSubject !== 'all') params.append('subject', selectedSubject);
      if (searchQuery) params.append('query', searchQuery);
      if (!showGlobalCoaches) params.append('local_only', 'true');

      const response = await api.get(`/tutors/search?${params}`);
      setTutors(response.data.tutors || []);
    } catch (error) {
      console.error('Failed to search tutors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowResults(true);
      searchTutors();
    }
  };

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedSubject('all');
    setSearchQuery('');
    setShowResults(false);
    setTutors([]);
  };

  const getCategoryDisplayName = () => {
    if (selectedCategory === 'all') return t('pages.search.all_categories');
    const cat = categories.find(c => c.id === selectedCategory);
    return getCategoryName(selectedCategory, cat?.name);
  };

  const getSubjectDisplayName = () => {
    if (selectedSubject === 'all') return t('pages.search.all_subjects');
    return getSubjectName(selectedSubject);
  };

  // Render category card
  const renderCategoryCard = (category) => {
    const Icon = getCategoryIcon(category.id);
    
    return (
      <button
        key={category.id}
        className="category-card"
        style={{ backgroundColor: colors.surface, borderColor: colors.border }}
        onClick={() => handleCategorySelect(category.id)}
        data-testid={`category-${category.id}`}
      >
        <div className="category-icon-container" style={{ backgroundColor: colors.primaryLight }}>
          <Icon size={24} color={colors.primary} />
        </div>
        <span className="category-name" style={{ color: colors.text }}>
          {getCategoryName(category.id, category.name)}
        </span>
        <span className="category-subjects" style={{ color: colors.textMuted }}>
          {t('pages.home.subjects_count', { count: formatNumber(category.subjects?.length || 0) })}
        </span>
      </button>
    );
  };

  // Render tutor card
  const renderTutorCard = (tutor) => (
    <button
      key={tutor.tutor_id || tutor.user_id}
      className={`tutor-card ${tutor.is_sponsored ? 'sponsored' : ''}`}
      style={{ 
        backgroundColor: colors.surface, 
        borderColor: tutor.is_sponsored ? colors.warning : colors.border 
      }}
      onClick={() => navigate(`/tutor/${tutor.tutor_id || tutor.user_id}`)}
      data-testid={`tutor-card-${tutor.tutor_id || tutor.user_id}`}
    >
      {/* Sponsored Badge */}
      {tutor.is_sponsored && (
        <div className="sponsored-badge" style={{ backgroundColor: colors.warning }}>
          <Star size={10} color="#fff" />
          <span>{t('pages.search.sponsored')}</span>
        </div>
      )}
      
      {/* Card Header */}
      <div className="card-header">
        <div className="tutor-avatar" style={{ backgroundColor: colors.primary }}>
          <span>{(tutor.user_name || tutor.name || 'T').charAt(0)}</span>
        </div>
        <div className="card-info">
          <div className="tutor-name-row">
            <span className="tutor-name" style={{ color: colors.text }}>
              {tutor.user_name || tutor.name}
            </span>
            {tutor.market_code && (
              <FlagIcon countryCode={tutor.market_code} size={16} />
            )}
          </div>
          <div className="rating-row">
            <Star size={14} color="#FFB800" fill="#FFB800" />
            <span className="rating" style={{ color: colors.text }}>
              {formatNumber((tutor.rating_avg || 0).toFixed(1))}
            </span>
            <span className="rating-count" style={{ color: colors.textMuted }}>
              {tutor.rating_count > 0 
                ? `(${formatNumber(tutor.rating_count)} ${t('pages.search.reviews')})` 
                : t('common.new')
              }
            </span>
          </div>
        </div>
        <div className="price-container">
          <span className="price" style={{ color: colors.primary }}>
            {tutor.currency_symbol || '$'}{formatNumber(tutor.display_price || tutor.base_price)}{t('pages.search.per_hour')}
          </span>
        </div>
      </div>

      {/* Bio */}
      <p className="tutor-bio" style={{ color: colors.textMuted }}>
        {tutor.bio || t('pages.search.no_bio')}
      </p>

      {/* Category & Subject Info */}
      <div className="category-info">
        <div className="category-item">
          <Folder size={14} color={colors.textMuted} />
          <span style={{ color: colors.textSecondary }}>
            {(tutor.categories || []).slice(0, 2).map(c => getCategoryName(c)).join(', ') || t('common.general')}
          </span>
        </div>
        <div className="category-item">
          <BookOpen size={14} color={colors.textMuted} />
          <span style={{ color: colors.textSecondary }}>
            {formatNumber((tutor.subjects || []).length)} {t('pages.search.subject')}{(tutor.subjects || []).length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Modality */}
      <div className="modality-row">
        {(Array.isArray(tutor.modality) ? tutor.modality : [tutor.modality].filter(Boolean)).map((m, idx) => (
          <div key={`${m}-${idx}`} className="modality-item">
            <Video size={14} color={colors.textMuted} />
            <span style={{ color: colors.textMuted }}>{getModalityName(m)}</span>
          </div>
        ))}
      </div>
    </button>
  );

  return (
    <div className="search-page" style={{ backgroundColor: colors.background }}>
      <AppHeader />
      
      <main className="search-content">
        <div className="content-wrapper">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="search-bar-container">
            <div className="search-bar" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
              <Search size={20} color={colors.textMuted} />
              <input
                type="text"
                className="search-input"
                style={{ color: colors.text }}
                placeholder={t('forms.placeholders.search_subjects')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                data-testid="search-input"
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="clear-search">
                  <X size={20} color={colors.textMuted} />
                </button>
              )}
            </div>
          </form>

          {/* BROWSE MODE: Show category cards */}
          {!showResults && (
            <div className="categories-section">
              <h2 className="section-title" style={{ color: colors.text }}>
                {t('pages.home.browse_categories')}
              </h2>
              <div className="categories-grid">
                {loading ? (
                  <div className="loading-container">
                    <Loader2 size={32} color={colors.primary} className="spinner" />
                  </div>
                ) : (
                  // Sort categories to put 'academics' first
                  [...categories].sort((a, b) => {
                    if (a.id === 'academics') return -1;
                    if (b.id === 'academics') return 1;
                    return 0;
                  }).map(renderCategoryCard)
                )}
              </div>
            </div>
          )}

          {/* RESULTS MODE: Show filters and results */}
          {showResults && (
            <div className="results-section">
              {/* Filter Pill */}
              <div className="filter-pill-container">
                <div className="filter-pill" style={{ backgroundColor: colors.primaryLight }}>
                  <span style={{ color: colors.primary }}>
                    {searchQuery.trim() || getCategoryDisplayName()}
                  </span>
                  <button onClick={clearFilters} className="filter-pill-close">
                    <X size={16} color={colors.primary} />
                  </button>
                </div>
              </div>

              {/* Dropdowns */}
              <div className="dropdowns-container">
                {/* Category Dropdown */}
                <div className="dropdown-wrapper">
                  <button 
                    className="dropdown-button"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    onClick={() => setShowCategoryDropdown(true)}
                  >
                    <Folder size={16} color={colors.primary} />
                    <div className="dropdown-text">
                      <span className="dropdown-label" style={{ color: colors.textMuted }}>
                        {t('pages.search.category')}
                      </span>
                      <span className="dropdown-value" style={{ color: colors.text }}>
                        {getCategoryDisplayName()}
                      </span>
                    </div>
                    <ChevronDown size={18} color={colors.textMuted} />
                  </button>
                </div>

                {/* Subject Dropdown */}
                <div className="dropdown-wrapper">
                  <button 
                    className="dropdown-button"
                    style={{ backgroundColor: colors.surface, borderColor: colors.border }}
                    onClick={() => setShowSubjectDropdown(true)}
                  >
                    <BookOpen size={16} color={colors.primary} />
                    <div className="dropdown-text">
                      <span className="dropdown-label" style={{ color: colors.textMuted }}>
                        {t('pages.search.subject')}
                      </span>
                      <span className="dropdown-value" style={{ color: colors.text }}>
                        {getSubjectDisplayName()}
                      </span>
                    </div>
                    <ChevronDown size={18} color={colors.textMuted} />
                  </button>
                </div>
              </div>

              {/* Global Toggle */}
              <div className="toggle-container">
                <span style={{ color: colors.text }}>{t('pages.search.show_global_coaches')}</span>
                <button 
                  className={`toggle-switch ${showGlobalCoaches ? 'active' : ''}`}
                  style={{ backgroundColor: showGlobalCoaches ? colors.primary : colors.gray300 }}
                  onClick={() => setShowGlobalCoaches(!showGlobalCoaches)}
                  data-testid="global-toggle"
                >
                  <div className="toggle-thumb" />
                </button>
              </div>

              {/* Results */}
              <div className="tutors-list">
                {loading ? (
                  <div className="loading-container">
                    <Loader2 size={32} color={colors.primary} className="spinner" />
                  </div>
                ) : tutors.length === 0 ? (
                  <div className="empty-state" style={{ color: colors.textMuted }}>
                    <Search size={48} color={colors.gray300} />
                    <p>{t('pages.search.no_results')}</p>
                  </div>
                ) : (
                  tutors.map(renderTutorCard)
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Category Dropdown Modal */}
      {showCategoryDropdown && (
        <div className="dropdown-modal-overlay" onClick={() => setShowCategoryDropdown(false)}>
          <div 
            className="dropdown-modal" 
            style={{ backgroundColor: colors.surface }}
            onClick={e => e.stopPropagation()}
          >
            <div className="dropdown-modal-header">
              <h3 style={{ color: colors.text }}>{t('pages.search.select_category')}</h3>
              <button onClick={() => setShowCategoryDropdown(false)}>
                <X size={24} color={colors.textMuted} />
              </button>
            </div>
            <div className="dropdown-modal-list">
              <button
                className={`dropdown-option ${selectedCategory === 'all' ? 'selected' : ''}`}
                style={{ backgroundColor: selectedCategory === 'all' ? colors.primaryLight : 'transparent' }}
                onClick={() => { setSelectedCategory('all'); setShowCategoryDropdown(false); }}
              >
                <span style={{ color: selectedCategory === 'all' ? colors.primary : colors.text }}>
                  {t('pages.search.all_categories')}
                </span>
                {selectedCategory === 'all' && <Check size={20} color={colors.primary} />}
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  className={`dropdown-option ${selectedCategory === cat.id ? 'selected' : ''}`}
                  style={{ backgroundColor: selectedCategory === cat.id ? colors.primaryLight : 'transparent' }}
                  onClick={() => { setSelectedCategory(cat.id); setSelectedSubject('all'); setShowCategoryDropdown(false); }}
                >
                  <span style={{ color: selectedCategory === cat.id ? colors.primary : colors.text }}>
                    {getCategoryName(cat.id, cat.name)}
                  </span>
                  {selectedCategory === cat.id && <Check size={20} color={colors.primary} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Subject Dropdown Modal */}
      {showSubjectDropdown && (
        <div className="dropdown-modal-overlay" onClick={() => setShowSubjectDropdown(false)}>
          <div 
            className="dropdown-modal" 
            style={{ backgroundColor: colors.surface }}
            onClick={e => e.stopPropagation()}
          >
            <div className="dropdown-modal-header">
              <h3 style={{ color: colors.text }}>{t('pages.search.select_subject')}</h3>
              <button onClick={() => setShowSubjectDropdown(false)}>
                <X size={24} color={colors.textMuted} />
              </button>
            </div>
            <div className="dropdown-modal-list">
              <button
                className={`dropdown-option ${selectedSubject === 'all' ? 'selected' : ''}`}
                style={{ backgroundColor: selectedSubject === 'all' ? colors.primaryLight : 'transparent' }}
                onClick={() => { setSelectedSubject('all'); setShowSubjectDropdown(false); }}
              >
                <span style={{ color: selectedSubject === 'all' ? colors.primary : colors.text }}>
                  {t('pages.search.all_subjects')}
                </span>
                {selectedSubject === 'all' && <Check size={20} color={colors.primary} />}
              </button>
              {availableSubjects.map(subj => (
                <button
                  key={subj}
                  className={`dropdown-option ${selectedSubject === subj ? 'selected' : ''}`}
                  style={{ backgroundColor: selectedSubject === subj ? colors.primaryLight : 'transparent' }}
                  onClick={() => { setSelectedSubject(subj); setShowSubjectDropdown(false); }}
                >
                  <span style={{ color: selectedSubject === subj ? colors.primary : colors.text }}>
                    {getSubjectName(subj)}
                  </span>
                  {selectedSubject === subj && <Check size={20} color={colors.primary} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
