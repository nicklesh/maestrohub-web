import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { api } from '../../src/services/api';
import { colors } from '../../src/theme/colors';

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
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredTutors, setFeaturedTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [catRes, tutorRes] = await Promise.all([
        api.get('/categories'),
        api.get('/tutors/search?limit=6'),
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

  const renderCategoryCard = (category: Category) => (
    <TouchableOpacity
      key={category.id}
      style={styles.categoryCard}
      onPress={() => router.push(`/(consumer)/search?category=${category.id}`)}
    >
      <Ionicons
        name={
          category.id === 'academic'
            ? 'school'
            : category.id === 'music'
            ? 'musical-notes'
            : 'game-controller'
        }
        size={32}
        color={colors.primary}
      />
      <Text style={styles.categoryName}>{category.name}</Text>
      <Text style={styles.categorySubjects}>
        {category.subjects.slice(0, 3).join(', ')}
      </Text>
    </TouchableOpacity>
  );

  const renderTutorCard = ({ item }: { item: Tutor }) => (
    <TouchableOpacity
      style={styles.tutorCard}
      onPress={() => router.push(`/(consumer)/tutor/${item.tutor_id}`)}
    >
      <View style={styles.tutorAvatar}>
        <Text style={styles.tutorInitial}>
          {item.user_name?.charAt(0)?.toUpperCase() || 'T'}
        </Text>
      </View>
      <View style={styles.tutorInfo}>
        <Text style={styles.tutorName} numberOfLines={1}>
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
          <Text style={styles.price}>${item.base_price}/hr</Text>
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'}!</Text>
            <Text style={styles.tagline}>The easiest way to book a tutor.</Text>
          </View>
        </View>

        {/* Search Bar */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => router.push('/(consumer)/search')}
        >
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <Text style={styles.searchPlaceholder}>Search for tutors...</Text>
        </TouchableOpacity>

        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse Categories</Text>
          <View style={styles.categoriesGrid}>
            {categories.map(renderCategoryCard)}
          </View>
        </View>

        {/* Featured Tutors */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Tutors</Text>
            <TouchableOpacity onPress={() => router.push('/(consumer)/search')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {featuredTutors.length > 0 ? (
            <FlatList
              data={featuredTutors}
              renderItem={renderTutorCard}
              keyExtractor={(item) => item.tutor_id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tutorList}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>No tutors available yet</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  tagline: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  seeAll: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: 4,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  categorySubjects: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  tutorList: {
    paddingHorizontal: 16,
    gap: 12,
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
  tutorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  tutorInitial: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.primary,
  },
  tutorInfo: {
    flex: 1,
  },
  tutorName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
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
