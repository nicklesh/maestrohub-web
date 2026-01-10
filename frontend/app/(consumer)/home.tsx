import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useMarket } from '@/src/context/MarketContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import MarketSelectionModal from '@/src/components/MarketSelectionModal';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface Category {
  id: string;
  name: string;
  subjects: string[];
}

interface Tutor {
  tutor_id: string;
  user_name: string;
  user_picture?: string;
  bio: string;
  categories: string[];
  subjects: string[];
  base_price: number;
  rating_avg: number;
  rating_count: number;
  modality: string[];
  currency?: string;
  currency_symbol?: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { currentMarket, needsSelection } = useMarket();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredTutors, setFeaturedTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMarketModal, setShowMarketModal] = useState(false);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const isWide = width >= 1280;
  const containerMaxWidth = isWide ? 1200 : isDesktop ? 960 : isTablet ? 720 : undefined;

  // Dynamic styles
  const styles = getStyles(colors);

  useEffect(() => {
    loadData();
    // Show market selection modal if needed
    if (needsSelection) {
      setShowMarketModal(true);
    }
  }, [needsSelection]);

  const loadData = async () => {
    try {
      const [catRes, tutorRes] = await Promise.all([
        api.get('/categories'),
        api.get('/tutors/search?limit=8'),
      ]);
      setCategories(catRes.data.categories);
      setFeaturedTutors(tutorRes.data.tutors);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getCategoryIcon = (categoryId: string): string => {
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

  const renderCategoryCard = (category: Category, index: number) => (
    <TouchableOpacity
      key={category.id}
      style={[
        styles.categoryCard,
        isTablet && styles.categoryCardTablet,
        { width: isDesktop ? '31%' : isTablet ? '48%' : '48%' },
      ]}
      onPress={() => router.push(`/(consumer)/search?category=${category.id}`)}
    >
      <View style={[styles.categoryIcon, isTablet && styles.categoryIconTablet]}>
        <Ionicons
          name={getCategoryIcon(category.id) as any}
          size={isTablet ? 36 : 28}
          color={colors.primary}
        />
      </View>
      <Text style={[styles.categoryName, isTablet && styles.categoryNameTablet]} numberOfLines={2}>
        {category.name}
      </Text>
      <Text style={styles.categorySubjects}>
        {category.subjects.length} subjects
      </Text>
    </TouchableOpacity>
  );

  const renderTutorCard = ({ item }: { item: Tutor }) => (
    <TouchableOpacity
      style={[
        styles.tutorCard,
        isTablet && styles.tutorCardTablet,
        isDesktop && styles.tutorCardDesktop,
      ]}
      onPress={() => router.push(`/(consumer)/tutor/${item.tutor_id}`)}
    >
      <View style={[styles.tutorAvatar, isTablet && styles.tutorAvatarTablet]}>
        <Text style={[styles.tutorInitial, isTablet && styles.tutorInitialTablet]}>
          {item.user_name?.charAt(0)?.toUpperCase() || 'T'}
        </Text>
      </View>
      <View style={styles.tutorInfo}>
        <Text style={[styles.tutorName, isTablet && styles.tutorNameTablet]} numberOfLines={1}>
          {item.user_name}
        </Text>
        <Text style={styles.tutorSubjects} numberOfLines={1}>
          {item.subjects?.slice(0, 2).join(', ')}
        </Text>
        <View style={styles.tutorMeta}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color={colors.accent} />
            <Text style={styles.rating}>
              {item.rating_avg > 0 ? item.rating_avg.toFixed(1) : 'New'}
            </Text>
          </View>
          <Text style={[styles.price, isTablet && styles.priceTablet]}>
            {item.currency_symbol || currentMarket?.currency_symbol || '$'}{item.base_price}/hr
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <AppHeader />
      
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          isTablet && styles.scrollContentTablet,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={[styles.contentWrapper, containerMaxWidth ? { maxWidth: containerMaxWidth } : undefined]}>
          {/* Search Bar */}
          <TouchableOpacity
            style={[styles.searchBar, isTablet && styles.searchBarTablet]}
            onPress={() => router.push('/(consumer)/search')}
          >
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <Text style={styles.searchPlaceholder}>Search for tutors...</Text>
          </TouchableOpacity>

          {/* Categories */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
              Browse Categories
            </Text>
            <View style={[styles.categoriesGrid, isTablet && styles.categoriesGridTablet]}>
              {categories.map((cat, index) => renderCategoryCard(cat, index))}
            </View>
          </View>

          {/* Featured Tutors */}
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isTablet && styles.sectionHeaderTablet]}>
              <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>
                Featured Tutors
              </Text>
              <TouchableOpacity onPress={() => router.push('/(consumer)/search')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            {featuredTutors.length > 0 ? (
              isTablet ? (
                <View style={styles.tutorsGrid}>
                  {featuredTutors.map((tutor) => (
                    <View 
                      key={tutor.tutor_id} 
                      style={{ width: isDesktop ? '24%' : '48%', marginBottom: 16 }}
                    >
                      {renderTutorCard({ item: tutor })}
                    </View>
                  ))}
                </View>
              ) : (
                <FlatList
                  data={featuredTutors}
                  renderItem={renderTutorCard}
                  keyExtractor={(item) => item.tutor_id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tutorList}
                />
              )
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>No tutors available yet</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Market Selection Modal */}
      <MarketSelectionModal
        visible={showMarketModal}
        onClose={() => setShowMarketModal(false)}
        canDismiss={false}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  scrollContentTablet: {
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
    alignSelf: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  searchBarTablet: {
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
  },
  searchPlaceholder: {
    color: colors.textMuted,
    fontSize: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionHeaderTablet: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitleDesktop: {
    fontSize: 22,
  },
  seeAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  categoriesGrid: {
    paddingHorizontal: 20,
    gap: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoriesGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  categoryCardTablet: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  categoryIconTablet: {
    width: 64,
    height: 64,
    borderRadius: 20,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  categoryNameTablet: {
    fontSize: 18,
  },
  categorySubjects: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  tutorList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  tutorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  tutorCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    width: 160,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 4,
  },
  tutorCardTablet: {
    width: '100%',
    padding: 20,
    borderRadius: 20,
    marginHorizontal: 0,
  },
  tutorCardDesktop: {
    padding: 24,
  },
  tutorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  tutorAvatarTablet: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 16,
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
  tutorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  tutorNameTablet: {
    fontSize: 16,
  },
  tutorSubjects: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
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
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  price: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  priceTablet: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
});
