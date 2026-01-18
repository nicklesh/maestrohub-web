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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { useTheme } from '@/src/context/ThemeContext';
import AppHeader from '@/src/components/AppHeader';

interface Tutor {
  id: string;
  tutor_id: string;
  user_name: string;
  bio: string;
  subjects: string[];
  categories: string[];
  modality: string[];
  base_price: number;
  rating_avg: number;
  rating_count: number;
  currency_symbol: string;
  is_sponsored?: boolean;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Dropdown modal states
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);

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

  // Auto-match search query to category/subject
  useEffect(() => {
    if (searchQuery.trim() && categories.length > 0) {
      const query = searchQuery.toLowerCase().trim();
      
      // Check if query matches a category
      const matchedCategory = categories.find(
        cat => cat.name.toLowerCase().includes(query) || cat.id.toLowerCase().includes(query)
      );
      
      if (matchedCategory) {
        setSelectedCategory(matchedCategory.id);
        setSelectedSubject('all');
        return;
      }
      
      // Check if query matches a subject
      for (const cat of categories) {
        const matchedSubject = (cat.subjects || []).find(
          subj => subj.toLowerCase().includes(query)
        );
        if (matchedSubject) {
          setSelectedCategory(cat.id);
          setSelectedSubject(matchedSubject);
          return;
        }
      }
    }
  }, [searchQuery, categories]);

  // Update category when params change (from home page navigation)
  useEffect(() => {
    if (params.category && typeof params.category === 'string') {
      setSelectedCategory(params.category);
      setSelectedSubject('all');
    }
  }, [params.category]);

  useEffect(() => {
    loadCategories();
  }, []);

  // Search tutors when filters change
  useEffect(() => {
    if (!loading || tutors.length === 0) {
      searchTutors(true);
    }
  }, [selectedCategory, selectedSubject]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
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

      const response = await api.get(`/tutors/search?${queryParams}`);
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

  const getCategoryName = () => {
    if (selectedCategory === 'all') return 'All Categories';
    const cat = categories.find(c => c.id === selectedCategory);
    return cat?.name || 'Category';
  };

  const getSubjectName = () => {
    if (selectedSubject === 'all') return 'All Subjects';
    return selectedSubject;
  };

  const renderTutorCard = ({ item }: { item: Tutor }) => (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: item.is_sponsored ? colors.warning : colors.border },
        item.is_sponsored && { borderWidth: 2 },
        isTablet && styles.cardTablet,
        isDesktop && { flex: 0.32, marginHorizontal: 4 }
      ]}
      onPress={() => router.push(`/(consumer)/tutor/${item.tutor_id}`)}
    >
      {/* Sponsored Badge */}
      {item.is_sponsored && (
        <View style={[styles.sponsoredBadge, { backgroundColor: colors.warning }]}>
          <Ionicons name="star" size={10} color="#fff" />
          <Text style={styles.sponsoredBadgeText}>Sponsored</Text>
        </View>
      )}
      
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{item.user_name?.charAt(0)?.toUpperCase() || 'T'}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.tutorName, { color: colors.text }]} numberOfLines={1}>{item.user_name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={14} color="#FFB800" />
            <Text style={[styles.rating, { color: colors.text }]}>
              {item.rating_avg?.toFixed(1) || '0.0'}
            </Text>
            <Text style={[styles.ratingCount, { color: colors.textMuted }]}>
              {item.rating_count > 0 ? `(${item.rating_count})` : 'New'}
            </Text>
          </View>
        </View>
        <Text style={[styles.price, { color: colors.primary }]}>
          {item.currency_symbol || '$'}{item.base_price}/hr
        </Text>
      </View>

      <Text style={[styles.bio, { color: colors.textMuted }]} numberOfLines={2}>
        {item.bio || 'No bio available'}
      </Text>

      {/* Category & Subject Info - Clean text instead of pills */}
      <View style={styles.categoryInfo}>
        <View style={styles.categoryItem}>
          <Ionicons name="folder-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.categoryText, { color: colors.textSecondary }]} numberOfLines={1}>
            {(item.categories || []).slice(0, 2).join(', ') || 'General'}
          </Text>
        </View>
        <View style={styles.categoryItem}>
          <Ionicons name="book-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.categoryText, { color: colors.textSecondary }]} numberOfLines={1}>
            {(item.subjects || []).length} subject{(item.subjects || []).length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <View style={styles.modalityRow}>
        {(item.modality || []).map((m) => (
          <View key={m} style={styles.modalityItem}>
            <Ionicons
              name={m === 'online' ? 'videocam' : m === 'hybrid' ? 'sync' : 'location'}
              size={14}
              color={colors.textMuted}
            />
            <Text style={[styles.modalityText, { color: colors.textMuted }]}>
              {m === 'online' ? 'Online' : m === 'hybrid' ? 'Hybrid' : 'In-Person'}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );

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
    { id: 'all', name: 'All Categories' },
    ...categories.map(c => ({ id: c.id, name: c.name }))
  ];

  // Subject options for dropdown
  const subjectOptions = [
    { id: 'all', name: 'All Subjects' },
    ...availableSubjects.map(s => ({ id: s, name: s }))
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader />
      <View style={[styles.contentWrapper, containerMaxWidth ? { maxWidth: containerMaxWidth } : undefined]}>
        {/* Search Bar and Dropdowns */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          {/* Search Input */}
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }, isTablet && styles.searchBarTablet]}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }, isTablet && styles.searchInputTablet]}
              placeholder="Search tutors, subjects..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => searchTutors(true)}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); searchTutors(true); }}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Dropdowns */}
          <View style={[styles.filtersRow, isTablet && styles.filtersRowTablet]}>
            <DropdownSelector
              label="Category"
              value={getCategoryName()}
              onPress={() => setShowCategoryDropdown(true)}
              icon="grid-outline"
            />
            <DropdownSelector
              label="Subject"
              value={getSubjectName()}
              onPress={() => setShowSubjectDropdown(true)}
              icon="book-outline"
            />
          </View>

          {/* Active Filters Chips */}
          {(selectedCategory !== 'all' || selectedSubject !== 'all') && (
            <View style={styles.activeFilters}>
              {selectedCategory !== 'all' && (
                <TouchableOpacity 
                  style={[styles.activeChip, { backgroundColor: colors.primaryLight }]}
                  onPress={() => { setSelectedCategory('all'); setSelectedSubject('all'); }}
                >
                  <Text style={[styles.activeChipText, { color: colors.primary }]}>{getCategoryName()}</Text>
                  <Ionicons name="close-circle" size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
              {selectedSubject !== 'all' && (
                <TouchableOpacity 
                  style={[styles.activeChip, { backgroundColor: colors.primaryLight }]}
                  onPress={() => setSelectedSubject('all')}
                >
                  <Text style={[styles.activeChipText, { color: colors.primary }]}>{selectedSubject}</Text>
                  <Ionicons name="close-circle" size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={styles.clearAllBtn}
                onPress={() => { setSelectedCategory('all'); setSelectedSubject('all'); setSearchQuery(''); }}
              >
                <Text style={[styles.clearAllText, { color: colors.textMuted }]}>Clear all</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Results */}
        {loading && tutors.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : tutors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No tutors found
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              Try adjusting your filters
            </Text>
          </View>
        ) : (
          <FlatList
            data={tutors}
            renderItem={renderTutorCard}
            keyExtractor={(item) => item.tutor_id || item.id}
            numColumns={numColumns}
            key={numColumns}
            contentContainerStyle={[styles.listContent, isDesktop && styles.listContentDesktop]}
            onEndReached={() => hasMore && !loading && searchTutors(false)}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loading ? <ActivityIndicator color={colors.primary} style={styles.loadMore} /> : null
            }
          />
        )}
      </View>

      {/* Category Dropdown Modal */}
      <DropdownModal
        visible={showCategoryDropdown}
        onClose={() => setShowCategoryDropdown(false)}
        title="Select Category"
        options={categoryOptions}
        selected={selectedCategory}
        onSelect={(id) => {
          setSelectedCategory(id);
          setSelectedSubject('all'); // Reset subject when category changes
        }}
      />

      {/* Subject Dropdown Modal */}
      <DropdownModal
        visible={showSubjectDropdown}
        onClose={() => setShowSubjectDropdown(false)}
        title="Select Subject"
        options={subjectOptions}
        selected={selectedSubject}
        onSelect={setSelectedSubject}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    padding: 16,
    gap: 12,
  },
  headerTablet: {
    padding: 24,
    gap: 16,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
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
