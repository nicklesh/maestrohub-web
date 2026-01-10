import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
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
  const [category, setCategory] = useState(params.category as string || 'all');
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const containerMaxWidth = isDesktop ? 1200 : isTablet ? 900 : undefined;
  const numColumns = isDesktop ? 3 : isTablet ? 2 : 1;

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    searchTutors(true);
  }, [category]);

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
      
      if (category !== 'all') {
        queryParams.append('category', category);
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

  const renderTutorCard = ({ item }: { item: Tutor }) => (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        isTablet && styles.cardTablet,
        isDesktop && { flex: 0.32, marginHorizontal: 4 }
      ]}
      onPress={() => router.push(`/(consumer)/tutor/${item.tutor_id}`)}
    >
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

      {/* Subject Pills - Wrap within container */}
      <View style={styles.subjectPillsContainer}>
        {(item.subjects || []).slice(0, 4).map((subject, index) => (
          <View key={`${subject}-${index}`} style={[styles.subjectPill, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.subjectPillText, { color: colors.primary }]}>{subject}</Text>
          </View>
        ))}
        {(item.subjects || []).length > 4 && (
          <View style={[styles.subjectPill, { backgroundColor: colors.gray200 }]}>
            <Text style={[styles.subjectPillText, { color: colors.textMuted }]}>
              +{item.subjects.length - 4}
            </Text>
          </View>
        )}
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

  // Prepare category filter list with "All" at the start
  const categoryFilters = [
    { id: 'all', name: 'All', subjects: [] },
    ...categories
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader />
      <View style={[styles.contentWrapper, containerMaxWidth ? { maxWidth: containerMaxWidth } : undefined]}>
        {/* Search Bar */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }, isTablet && styles.searchBarTablet]}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }, isTablet && styles.searchInputTablet]}
              placeholder="Search tutors..."
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
        </View>

        {/* Category Filters */}
        <View style={[styles.filtersContainer, isTablet && styles.filtersContainerTablet]}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categoryFilters}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.filterList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  category === item.id && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setCategory(item.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: colors.text },
                    category === item.id && { color: '#FFFFFF' }
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
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
  },
  headerTablet: {
    padding: 24,
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
  filtersContainer: {
    marginBottom: 8,
  },
  filtersContainerTablet: {
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
  },
  cardTablet: {
    padding: 20,
    borderRadius: 20,
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
  subjectPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
    maxWidth: '100%',
    overflow: 'hidden',
  },
  subjectPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 4,
    maxWidth: 120,
  },
  subjectPillText: {
    fontSize: 11,
    fontWeight: '500',
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
    fontSize: 16,
    marginTop: 16,
  },
  loadMore: {
    padding: 20,
  },
});
