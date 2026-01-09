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
  tutor_id: string;
  user_name: string;
  user_picture?: string;
  bio: string;
  categories: string[];
  subjects: string[];
  levels: string[];
  base_price: number;
  rating_avg: number;
  rating_count: number;
  modality: string[];
}

const CATEGORIES = [
  { id: 'all', name: 'All' },
  { id: 'academic', name: 'Academic' },
  { id: 'music', name: 'Music' },
  { id: 'activities', name: 'Activities' },
];

const MODALITIES = [
  { id: 'all', name: 'All' },
  { id: 'online', name: 'Online' },
  { id: 'in_person', name: 'In-Person' },
];

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState(params.category as string || 'all');
  const [modality, setModality] = useState('all');
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const isWide = width >= 1280;
  const containerMaxWidth = isWide ? 1200 : isDesktop ? 960 : isTablet ? 720 : undefined;
  const numColumns = isDesktop ? 3 : isTablet ? 2 : 1;

  useEffect(() => {
    searchTutors(true);
  }, [category, modality]);

  const searchTutors = async (reset = false) => {
    if (loading && !reset) return;
    
    const currentPage = reset ? 1 : page;
    if (reset) {
      setPage(1);
      setLoading(true);
    }

    try {
      const params: Record<string, any> = {
        page: currentPage,
        limit: 20,
      };
      
      if (searchQuery) params.subject = searchQuery;
      if (category !== 'all') params.category = category;
      if (modality !== 'all') params.modality = modality;

      const response = await api.get('/tutors/search', { params });
      const newTutors = response.data.tutors;
      
      if (reset) {
        setTutors(newTutors);
      } else {
        setTutors((prev) => [...prev, ...newTutors]);
      }
      
      setHasMore(newTutors.length === 20);
      setPage(currentPage + 1);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    searchTutors(true);
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      searchTutors();
    }
  };

  const renderTutorCard = ({ item, index }: { item: Tutor; index: number }) => (
    <View style={[
      styles.tutorCardWrapper,
      { 
        width: numColumns === 1 ? '100%' : `${100 / numColumns - 2}%`,
        marginRight: (index + 1) % numColumns !== 0 ? '2%' : 0,
      }
    ]}>
      <TouchableOpacity
        style={[styles.tutorCard, isTablet && styles.tutorCardTablet]}
        onPress={() => router.push(`/(consumer)/tutor/${item.tutor_id}`)}
      >
        <View style={[styles.tutorAvatar, isTablet && styles.tutorAvatarTablet]}>
          <Text style={[styles.tutorInitial, isTablet && styles.tutorInitialTablet]}>
            {item.user_name?.charAt(0)?.toUpperCase() || 'T'}
          </Text>
        </View>
        <View style={styles.tutorInfo}>
          <View style={styles.tutorHeader}>
            <Text style={[styles.tutorName, isTablet && styles.tutorNameTablet]}>
              {item.user_name}
            </Text>
            <Text style={[styles.tutorPrice, isTablet && styles.tutorPriceTablet]}>
              ${item.base_price}/hr
            </Text>
          </View>
          <Text style={[styles.tutorSubjects, isTablet && styles.tutorSubjectsTablet]} numberOfLines={1}>
            {item.subjects?.join(', ')}
          </Text>
          <View style={styles.tutorMeta}>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color={colors.accent} />
              <Text style={styles.rating}>
                {item.rating_avg > 0 ? `${item.rating_avg.toFixed(1)} (${item.rating_count})` : 'New'}
              </Text>
            </View>
            <View style={styles.modalityTags}>
              {item.modality?.map((m) => (
                <View key={m} style={styles.modalityTag}>
                  <Text style={styles.modalityText}>
                    {m === 'online' ? 'Online' : 'In-Person'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.contentWrapper, containerMaxWidth ? { maxWidth: containerMaxWidth } : undefined]}>
        {/* Search Header */}
        <View style={[styles.header, isTablet && styles.headerTablet]}>
          <View style={[styles.searchBar, isTablet && styles.searchBarTablet]}>
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, isTablet && styles.searchInputTablet]}
              placeholder="Search subjects or tutors..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filters */}
        <View style={[styles.filtersContainer, isTablet && styles.filtersContainerTablet]}>
          {/* Category Filter */}
          <View style={styles.filterSection}>
            <FlatList
              data={CATEGORIES}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    isTablet && styles.filterChipTablet,
                    category === item.id && styles.filterChipActive,
                  ]}
                  onPress={() => setCategory(item.id)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      isTablet && styles.filterTextTablet,
                      category === item.id && styles.filterTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
            />
          </View>

          {/* Modality Filter */}
          <View style={styles.filterSection}>
            <FlatList
              data={MODALITIES}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.filterChip,
                    styles.filterChipSmall,
                    modality === item.id && styles.filterChipActive,
                  ]}
                  onPress={() => setModality(item.id)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      modality === item.id && styles.filterTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
            />
          </View>
        </View>

        {/* Results */}
        {loading && tutors.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : tutors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, isTablet && styles.emptyTitleTablet]}>
              No tutors found
            </Text>
            <Text style={styles.emptyText}>Try adjusting your filters</Text>
          </View>
        ) : (
          <FlatList
            data={tutors}
            renderItem={renderTutorCard}
            keyExtractor={(item) => item.tutor_id}
            contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet]}
            numColumns={numColumns}
            key={numColumns}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
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
    backgroundColor: colors.background,
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
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.text,
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
  filterSection: {
    marginBottom: 8,
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  filterChipTablet: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  filterChipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  filterTextTablet: {
    fontSize: 15,
  },
  filterTextActive: {
    color: '#fff',
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
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyTitleTablet: {
    fontSize: 22,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
  listContent: {
    padding: 16,
  },
  listContentTablet: {
    padding: 24,
  },
  tutorCardWrapper: {
    marginBottom: 12,
  },
  tutorCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tutorCardTablet: {
    padding: 20,
    borderRadius: 20,
  },
  tutorAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  tutorAvatarTablet: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  tutorInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.primary,
  },
  tutorInitialTablet: {
    fontSize: 28,
  },
  tutorInfo: {
    flex: 1,
  },
  tutorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tutorName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  tutorNameTablet: {
    fontSize: 18,
  },
  tutorPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  tutorPriceTablet: {
    fontSize: 18,
  },
  tutorSubjects: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  tutorSubjectsTablet: {
    fontSize: 15,
    marginTop: 6,
  },
  tutorMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 13,
    color: colors.text,
  },
  modalityTags: {
    flexDirection: 'row',
    gap: 8,
  },
  modalityTag: {
    backgroundColor: colors.gray100,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  modalityText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },
  loadMore: {
    paddingVertical: 16,
  },
});
