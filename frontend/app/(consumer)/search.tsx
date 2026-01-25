import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import UserAvatar from '@/src/components/UserAvatar';
import FlagIcon from '@/src/components/FlagIcon';

interface Tutor {
  id: string;
  tutor_id: string;
  user_name: string;
  bio: string;
  subjects: string[];
  categories: string[];
  modality: string[];
  base_price: number;
  display_price?: number;
  original_price?: number;
  original_currency_symbol?: string;
  original_price_display?: string;
  rating_avg: number;
  rating_count: number;
  currency_symbol: string;
  is_sponsored?: boolean;
  market_flag?: string;
  market_code?: string;
  market_display?: string;
  is_cross_market?: boolean;
}

interface Category {
  id: string;
  name: string;
  subjects: string[];
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { token, user } = useAuth();
  const { t, formatNumber } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [showGlobalCoaches, setShowGlobalCoaches] = useState(true); // Show coaches from all countries by default
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showResults, setShowResults] = useState(false);
  
  // Dropdown modal states
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showCountryFilter, setShowCountryFilter] = useState(false);

  // Get category icon
  const getCategoryIcon = (categoryId: string): keyof typeof Ionicons.glyphMap => {
    switch (categoryId) {
      case 'coaching_personal': return 'rocket';
      case 'health_mindfulness': return 'leaf';
      case 'fitness_nutrition': return 'fitness';
      case 'relationships_family': return 'heart';
      case 'business_communication': return 'briefcase';
      case 'finance_legal': return 'cash';
      case 'culture_inclusion': return 'globe';
      case 'performance_arts': return 'mic';
      case 'academics': return 'school';
      case 'activities_hobbies': return 'color-palette';
      case 'academic': return 'school';
      case 'music': return 'musical-notes';
      default: return 'apps';
    }
  };

  // Helper function to translate category names
  const getCategoryName = (categoryId: string | undefined | null, originalName?: string): string => {
    if (!categoryId) return originalName || t('common.general');
    const key = `categories.${categoryId}`;
    const translated = t(key);
    return translated === key ? (originalName || categoryId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())) : translated;
  };

  // Helper function to translate subject names
  const getSubjectName = (subjectId: string | undefined | null): string => {
    if (!subjectId) return '';
    // Normalize the subject name to match translation key format
    // Handle spaces, &, /, and - to convert to underscores
    const normalizedKey = subjectId.toLowerCase()
      .replace(/[&\s\-\/]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const key = `subjects.${normalizedKey}`;
    const translated = t(key);
    return translated === key ? subjectId : translated;
  };

  // Helper function to translate modality
  const getModalityName = (modality: string): string => {
    const m = modality.toLowerCase().replace('-', '_');
    switch (m) {
      case 'online': return t('pages.search.online');
      case 'in_person': return t('pages.search.in_person');
      case 'hybrid': return t('pages.search.hybrid');
      default: return modality;
    }
  };

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const containerMaxWidth = isDesktop ? 1200 : isTablet ? 900 : undefined;
  const numColumns = isDesktop ? 3 : isTablet ? 2 : 1;

  // Get subjects for selected category
  const availableSubjects = useMemo(() => {
    if (selectedCategory === 'all') {
      // Combine all subjects from all categories
      const allSubjects = categories.flatMap(cat => cat.subjects || []);
      return [...new Set(allSubjects)].sort();
    }
    const cat = categories.find(c => c.id === selectedCategory);
    return cat?.subjects || [];
  }, [selectedCategory, categories]);

  // Auto-match search query to category/subject and trigger search
  useEffect(() => {
    if (searchQuery.trim() && categories.length > 0) {
      const query = searchQuery.toLowerCase().trim();
      console.log('Auto-match checking for:', query);
      
      // Check if query matches a category
      const matchedCategory = categories.find(
        cat => cat.name.toLowerCase().includes(query) || cat.id.toLowerCase().includes(query)
      );
      
      if (matchedCategory) {
        console.log('Matched category:', matchedCategory.id);
        setSelectedCategory(matchedCategory.id);
        setSelectedSubject('all');
        setShowResults(true);
        // Directly trigger search with matched values
        searchTutorsWithParams(matchedCategory.id, 'all', query);
        return;
      }
      
      // Check if query matches a subject
      for (const cat of categories) {
        const matchedSubject = (cat.subjects || []).find(
          subj => subj.toLowerCase().includes(query)
        );
        if (matchedSubject) {
          console.log('Matched subject:', matchedSubject, 'in category:', cat.id);
          setSelectedCategory(cat.id);
          setSelectedSubject(matchedSubject);
          setShowResults(true);
          // Directly trigger search with matched values
          searchTutorsWithParams(cat.id, matchedSubject, query);
          return;
        }
      }
      console.log('No match found for:', query);
    }
  }, [searchQuery, categories]);

  // Helper function to search with specific params
  const searchTutorsWithParams = async (categoryId: string, subjectId: string, query: string) => {
    setPage(1);
    setTutors([]);
    setLoading(true);

    try {
      const queryParams = new URLSearchParams({
        page: '1',
        limit: '20',
      });
      
      if (categoryId !== 'all') {
        queryParams.append('category', categoryId);
      }
      if (subjectId !== 'all') {
        queryParams.append('subject', subjectId);
      }
      if (query) {
        queryParams.append('query', query);
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.get(`/tutors/search?${queryParams}`, { headers });
      const newTutors = response.data.tutors || [];
      
      setTutors(newTutors);
      setHasMore(newTutors.length === 20);
    } catch (error) {
      console.error('Failed to search tutors:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update category when params change (from home page navigation)
  useEffect(() => {
    if (params.category && typeof params.category === 'string') {
      setSelectedCategory(params.category);
      setSelectedSubject('all');
      setShowResults(true);
    }
  }, [params.category]);

  useEffect(() => {
    loadCategories();
  }, []);

  // Search tutors when filters change - only if showResults is true
  useEffect(() => {
    if (showResults && (!loading || tutors.length === 0)) {
      searchTutors(true);
    }
  }, [selectedCategory, selectedSubject, showResults]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      // Transform subcategories to subjects for frontend compatibility
      const transformedCategories = (response.data.categories || []).map((cat: any) => ({
        id: cat.id || cat.name?.toLowerCase().replace(/[&\s]+/g, '_'),
        name: cat.name,
        subjects: (cat.subcategories || []).map((sub: any) => 
          typeof sub === 'string' ? sub : sub.name
        ),
      }));
      setCategories(transformedCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handler when a category card is clicked
  const handleCategorySelect = (categoryId: string) => {
    console.log('Category selected:', categoryId);
    console.log('Setting showResults to true');
    setSelectedCategory(categoryId);
    setSelectedSubject('all');
    setShowResults(true);
    // Trigger search immediately with the new category
    searchTutorsWithCategory(categoryId);
  };

  const searchTutorsWithCategory = async (categoryId: string) => {
    console.log('searchTutorsWithCategory called with:', categoryId);
    setPage(1);
    setTutors([]);
    setLoading(true);

    try {
      const queryParams = new URLSearchParams({
        page: '1',
        limit: '20',
      });
      
      if (categoryId !== 'all') {
        queryParams.append('category', categoryId);
      }
      if (searchQuery) {
        queryParams.append('query', searchQuery);
      }

      console.log('Making API call to:', `/tutors/search?${queryParams}`);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.get(`/tutors/search?${queryParams}`, { headers });
      const newTutors = response.data.tutors || [];
      console.log('Received tutors:', newTutors.length);
      
      setTutors(newTutors);
      setHasMore(newTutors.length === 20);
      console.log('State updated - tutors count:', newTutors.length);
    } catch (error) {
      console.error('Failed to search tutors:', error);
    } finally {
      setLoading(false);
      console.log('Loading set to false');
    }
  };

  const searchTutors = async (reset = false) => {
    const currentPage = reset ? 1 : page;
    if (reset) {
      setPage(1);
      setTutors([]);
    }

    try {
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      });
      
      if (selectedCategory !== 'all') {
        queryParams.append('category', selectedCategory);
      }
      if (selectedSubject !== 'all') {
        queryParams.append('subject', selectedSubject);
      }
      if (searchQuery) {
        queryParams.append('query', searchQuery);
      }
      if (!showGlobalCoaches) {
        queryParams.append('local_only', 'true');
      }

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await api.get(`/tutors/search?${queryParams}`, { headers });
      const newTutors = response.data.tutors || [];
      
      setTutors(reset ? newTutors : [...tutors, ...newTutors]);
      setHasMore(newTutors.length === 20);
      if (!reset) setPage(currentPage + 1);
    } catch (error) {
      console.error('Failed to search tutors:', error);
    } finally {
      setLoading(false);
    }
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

  const renderTutorCard = ({ item, index }: { item: Tutor; index: number }) => {
    // Calculate consistent card width for multi-column layouts
    const cardStyle = numColumns > 1 ? {
      flex: 1,
      maxWidth: `${100 / numColumns - 2}%` as any,
      marginHorizontal: 6,
    } : {};

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: item.is_sponsored ? colors.warning : colors.border },
          item.is_sponsored && { borderWidth: 2 },
          isTablet && styles.cardTablet,
          cardStyle
        ]}
        onPress={() => router.push(`/(consumer)/tutor/${item.tutor_id}`)}
      >
        {/* Sponsored Badge */}
        {item.is_sponsored && (
          <View style={[styles.sponsoredBadge, { backgroundColor: colors.warning }]}>
            <Ionicons name="star" size={10} color="#fff" />
            <Text style={styles.sponsoredBadgeText}>{t('pages.search.sponsored')}</Text>
          </View>
        )}
        
        {/* Market Flag Badge */}
        {item.market_code && (
          <View style={[styles.marketBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.marketCode, { color: colors.textMuted }]}>{item.market_code}</Text>
            <FlagIcon countryCode={item.market_code} size={14} />
          </View>
        )}
        
        <View style={styles.cardHeader}>
          <UserAvatar 
            name={item.user_name || 'T'} 
            role="tutor" 
            category={(item.categories || [])[0]}
            size={44}
          />
          <View style={styles.cardInfo}>
            <Text style={[styles.tutorName, { color: colors.text }]} numberOfLines={1}>{item.user_name}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={[styles.rating, { color: colors.text }]}>
                {formatNumber(item.rating_avg?.toFixed(1) || '0.0')}
              </Text>
              <Text style={[styles.ratingCount, { color: colors.textMuted }]}>
                {item.rating_count > 0 ? `(${formatNumber(item.rating_count)} ${t('pages.search.reviews')})` : t('common.new')}
              </Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={[styles.price, { color: colors.primary }]}>
              {item.currency_symbol || '$'}{formatNumber(item.display_price || item.base_price)}{t('pages.search.per_hour')}
            </Text>
            {item.original_price_display && (
              <Text style={[styles.originalPrice, { color: colors.textMuted }]}>
                ({item.original_price_display})
              </Text>
            )}
          </View>
        </View>

        <Text style={[styles.bio, { color: colors.textMuted }]} numberOfLines={2}>
          {item.bio || t('pages.search.no_bio')}
        </Text>

        {/* Category & Subject Info - Clean text instead of pills */}
        <View style={styles.categoryInfo}>
          <View style={styles.categoryItem}>
            <Ionicons name="folder-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.categoryText, { color: colors.textSecondary }]} numberOfLines={1}>
              {(item.categories || []).slice(0, 2).map(c => getCategoryName(c)).join(', ') || t('common.general')}
            </Text>
          </View>
          <View style={styles.categoryItem}>
            <Ionicons name="book-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.categoryText, { color: colors.textSecondary }]} numberOfLines={1}>
              {formatNumber((item.subjects || []).length)} {t('pages.search.subject')}{(item.subjects || []).length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.modalityRow}>
          {(Array.isArray(item.modality) ? item.modality : [item.modality].filter(Boolean)).map((m) => (
            <View key={m} style={styles.modalityItem}>
              <Ionicons
                name={m === 'online' ? 'videocam' : m === 'hybrid' ? 'sync' : 'location'}
                size={14}
                color={colors.textMuted}
              />
              <Text style={[styles.modalityText, { color: colors.textMuted }]}>
                {getModalityName(m)}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  // Dropdown selector component
  const DropdownSelector = ({ 
    label, 
    value, 
    onPress, 
    icon 
  }: { 
    label: string; 
    value: string; 
    onPress: () => void;
    icon: string;
  }) => (
    <TouchableOpacity 
      style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
    >
      <Ionicons name={icon as any} size={16} color={colors.primary} />
      <View style={styles.dropdownTextContainer}>
        <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.dropdownValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      </View>
      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  // Dropdown modal
  const DropdownModal = ({ 
    visible, 
    onClose, 
    title, 
    options, 
    selected, 
    onSelect 
  }: { 
    visible: boolean;
    onClose: () => void;
    title: string;
    options: { id: string; name: string }[];
    selected: string;
    onSelect: (id: string) => void;
  }) => (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay} 
        activeOpacity={1} 
        onPress={onClose}
      >
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            style={styles.modalList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  selected === item.id && { backgroundColor: colors.primaryLight }
                ]}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                <Text style={[
                  styles.modalOptionText, 
                  { color: colors.text },
                  selected === item.id && { color: colors.primary, fontWeight: '600' }
                ]}>
                  {item.name}
                </Text>
                {selected === item.id && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // Category options for dropdown
  const categoryOptions = [
    { id: 'all', name: t('pages.search.all_categories') },
    ...categories.map(c => ({ id: c.id, name: getCategoryName(c.id, c.name) }))
  ];

  // Subject options for dropdown
  const subjectOptions = [
    { id: 'all', name: t('pages.search.all_subjects') },
    ...availableSubjects.map(s => ({ id: s, name: getSubjectName(s) }))
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.contentWrapper, containerMaxWidth ? { maxWidth: containerMaxWidth } : undefined]}>
          {/* Search Bar */}
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }, isTablet && styles.searchBarTablet]}>
              <Ionicons name="search" size={20} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }, isTablet && styles.searchInputTablet]}
                placeholder={t('forms.placeholders.search_subjects')}
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => { 
                  if (searchQuery.trim()) {
                    setShowResults(true); 
                    searchTutorsWithParams(selectedCategory, selectedSubject, searchQuery);
                  }
                }}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { 
                  setSearchQuery(''); 
                  // If we were in results mode due to search term only, go back to browse mode
                  if (selectedCategory === 'all') {
                    setShowResults(false);
                    setTutors([]);
                  }
                }}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* BROWSE MODE: Show category cards when no filter is active */}
          {!showResults && (
            <View style={styles.categoriesSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('pages.home.browse_categories')}
              </Text>
              <View style={[styles.categoriesGrid, isTablet && styles.categoriesGridTablet]}>
                {categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryCard,
                      { 
                        backgroundColor: colors.surface, 
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                      isTablet && styles.categoryCardTablet,
                    ]}
                    onPress={() => handleCategorySelect(category.id)}
                  >
                    <View style={[styles.categoryIconContainer, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons
                        name={getCategoryIcon(category.id)}
                        size={isTablet ? 28 : 24}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={2}>
                      {getCategoryName(category.id, category.name)}
                    </Text>
                    <Text style={[styles.categorySubjects, { color: colors.textMuted }]}>
                      {t('pages.home.subjects_count', { count: formatNumber(category.subjects?.length || 0) })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* RESULTS MODE: Show filter pill, dropdowns, and results */}
          {showResults && (
            <View style={styles.resultsSection}>
              {/* Filter Pill */}
              <View style={styles.filterPillContainer}>
                <View style={[styles.filterPill, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.filterPillText, { color: colors.primary }]}>
                    {searchQuery.trim() 
                      ? searchQuery 
                      : getCategoryName(selectedCategory, categories.find(c => c.id === selectedCategory)?.name)
                    }
                  </Text>
                  <TouchableOpacity 
                    onPress={() => { 
                      setSelectedCategory('all'); 
                      setSelectedSubject('all'); 
                      setSearchQuery(''); 
                      setShowResults(false);
                      setTutors([]);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Filter Dropdowns */}
              <View style={[styles.filtersRow, isTablet && styles.filtersRowTablet]}>
                <DropdownSelector
                  label={t('pages.search.category')}
                  value={getCategoryDisplayName()}
                  onPress={() => setShowCategoryDropdown(true)}
                  icon="grid-outline"
                />
                <DropdownSelector
                  label={t('pages.search.subject')}
                  value={getSubjectDisplayName()}
                  onPress={() => setShowSubjectDropdown(true)}
                  icon="book-outline"
                />
              </View>

              {/* Global/Local Coaches Toggle */}
              <View style={[styles.countryFilterRow, { borderColor: colors.border }]}>
                <View style={styles.countryFilterLeft}>
                  <Ionicons name="globe-outline" size={18} color={colors.primary} />
                  <Text style={[styles.countryFilterLabel, { color: colors.text }]}>
                    Show coaches from all countries
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.countryToggle, 
                    { backgroundColor: showGlobalCoaches ? colors.primary : colors.gray300 }
                  ]}
                  onPress={() => {
                    setShowGlobalCoaches(!showGlobalCoaches);
                    // Trigger a new search
                    setTimeout(() => searchTutors(true), 100);
                  }}
                >
                  <View style={[
                    styles.countryToggleCircle,
                    showGlobalCoaches && styles.countryToggleCircleActive
                  ]} />
                </TouchableOpacity>
              </View>

              {/* Search Results */}
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : tutors.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="search" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    {t('pages.search.no_results_title')}
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                    {t('pages.search.no_results_description')}
                  </Text>
                </View>
              ) : (
                <View style={[styles.tutorsList, numColumns > 1 && styles.tutorsListMultiColumn]}>
                  {tutors.map((tutor, index) => (
                    <View key={tutor.tutor_id || tutor.id} style={numColumns > 1 ? styles.tutorCardWrapper : styles.tutorCardWrapperSingle}>
                      {renderTutorCard({ item: tutor, index })}
                    </View>
                  ))}
                  {hasMore && !loading && (
                    <TouchableOpacity 
                      style={[styles.loadMoreBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => searchTutors(false)}
                    >
                      <Text style={[styles.loadMoreText, { color: colors.primary }]}>{t('buttons.load_more')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Category Dropdown Modal */}
      <DropdownModal
        visible={showCategoryDropdown}
        onClose={() => setShowCategoryDropdown(false)}
        title={t('common.select_category')}
        options={categoryOptions}
        selected={selectedCategory}
        onSelect={(id) => {
          setSelectedCategory(id);
          setSelectedSubject('all');
          // Trigger search with new category
          searchTutorsWithParams(id, 'all', searchQuery);
        }}
      />

      {/* Subject Dropdown Modal */}
      <DropdownModal
        visible={showSubjectDropdown}
        onClose={() => setShowSubjectDropdown(false)}
        title={t('common.select_subject')}
        options={subjectOptions}
        selected={selectedSubject}
        onSelect={(id) => {
          setSelectedSubject(id);
          // Trigger search with new subject
          searchTutorsWithParams(selectedCategory, id, searchQuery);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  contentWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  headerTablet: {
    padding: 24,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    gap: 12,
  },
  searchBarTablet: {
    borderRadius: 16,
    paddingHorizontal: 20,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
  },
  searchInputTablet: {
    height: 56,
    fontSize: 18,
  },
  // Categories Section
  categoriesSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoriesGridTablet: {
    gap: 16,
  },
  categoryCard: {
    width: '48%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryCardTablet: {
    padding: 20,
    borderRadius: 20,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  categorySubjects: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  // Results Section
  resultsSection: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  filterPillContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  filtersRowTablet: {
    gap: 16,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  clearFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  subjectFilterRow: {
    marginBottom: 16,
  },
  tutorsList: {
    gap: 12,
  },
  tutorsListMultiColumn: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  tutorCardWrapper: {
    width: '32%',
    marginBottom: 12,
    marginRight: '1.33%',
  },
  tutorCardWrapperSingle: {
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    marginBottom: 12,
  },
  loadMoreBtn: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Dropdown styles
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
  },
  filtersRowTablet: {
    gap: 16,
  },
  dropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  dropdownTextContainer: {
    flex: 1,
  },
  dropdownLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dropdownValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  activeChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  clearAllBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
  },
  listContentDesktop: {
    paddingHorizontal: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  cardTablet: {
    padding: 20,
    borderRadius: 20,
  },
  sponsoredBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    gap: 4,
    zIndex: 1,
  },
  sponsoredBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  marketBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    gap: 4,
    zIndex: 1,
  },
  marketFlag: {
    fontSize: 14,
  },
  marketCode: {
    fontSize: 10,
    fontWeight: '600',
  },
  countryFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 12,
  },
  countryFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  countryFilterLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  countryToggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  countryToggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  countryToggleCircleActive: {
    alignSelf: 'flex-end',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontSize: 10,
    marginTop: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 12,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryText: {
    fontSize: 13,
  },
  modalityRow: {
    flexDirection: 'row',
    gap: 16,
  },
  modalityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalityText: {
    fontSize: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  loadMore: {
    padding: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalList: {
    maxHeight: 400,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalOptionText: {
    fontSize: 16,
  },
});
