import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useMarket } from '@/src/context/MarketContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useTranslation } from '@/src/i18n';
import MarketSelectionModal from '@/src/components/MarketSelectionModal';
import AppHeader from '@/src/components/AppHeader';

// Navigation card configuration
interface NavCard {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  gradient: string[];
}

const NAV_CARDS: NavCard[] = [
  {
    id: 'search',
    titleKey: 'pages.home.card_search_coach',
    descriptionKey: 'pages.home.card_search_coach_desc',
    icon: 'search',
    route: '/(consumer)/search',
    gradient: ['#3B82F6', '#2563EB'],
  },
  {
    id: 'book',
    titleKey: 'pages.home.card_book_session',
    descriptionKey: 'pages.home.card_book_session_desc',
    icon: 'calendar',
    route: '/(consumer)/search',
    gradient: ['#10B981', '#059669'],
  },
  {
    id: 'sessions',
    titleKey: 'pages.home.card_view_sessions',
    descriptionKey: 'pages.home.card_view_sessions_desc',
    icon: 'people',
    route: '/(consumer)/bookings',
    gradient: ['#8B5CF6', '#7C3AED'],
  },
  {
    id: 'account',
    titleKey: 'pages.home.card_view_account',
    descriptionKey: 'pages.home.card_view_account_desc',
    icon: 'person-circle',
    route: '/(consumer)/profile',
    gradient: ['#F59E0B', '#D97706'],
  },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const { needsSelection } = useMarket();
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [showMarketModal, setShowMarketModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const containerMaxWidth = isDesktop ? 800 : isTablet ? 600 : undefined;

  // Dynamic styles
  const styles = getStyles(colors, isDark);

  useEffect(() => {
    // Show market selection modal if needed
    if (needsSelection) {
      setShowMarketModal(true);
    }
  }, [needsSelection]);

  const onRefresh = () => {
    setRefreshing(true);
    // Just simulate a refresh since this page is mostly static navigation
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleCardPress = (route: string) => {
    router.push(route as any);
  };

  const renderNavigationCard = (card: NavCard, index: number) => {
    // Calculate card width for 2x2 grid
    const cardWidth = isDesktop ? '48%' : isTablet ? '48%' : '47%';
    
    return (
      <TouchableOpacity
        key={card.id}
        style={[
          styles.navCard,
          { width: cardWidth },
          isTablet && styles.navCardTablet,
        ]}
        onPress={() => handleCardPress(card.route)}
        activeOpacity={0.85}
      >
        <View style={[styles.navCardIconContainer, { backgroundColor: card.gradient[0] + '20' }]}>
          <Ionicons
            name={card.icon}
            size={isTablet ? 36 : 32}
            color={isDark ? colors.primary : card.gradient[0]}
          />
        </View>
        <Text style={[styles.navCardTitle, isTablet && styles.navCardTitleTablet]}>
          {t(card.titleKey)}
        </Text>
        <Text style={[styles.navCardDescription, isTablet && styles.navCardDescriptionTablet]} numberOfLines={2}>
          {t(card.descriptionKey)}
        </Text>
        <View style={styles.navCardArrow}>
          <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

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
        <View style={[styles.contentWrapper, containerMaxWidth ? { maxWidth: containerMaxWidth, alignSelf: 'center' } : undefined]}>
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeText, isTablet && styles.welcomeTextTablet]}>
              {t('pages.home.welcome_back')}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
            </Text>
            <Text style={[styles.welcomeSubtext, isTablet && styles.welcomeSubtextTablet]}>
              {t('pages.home.what_would_you_like')}
            </Text>
          </View>

          {/* 2x2 Navigation Grid */}
          <View style={[styles.navGrid, isTablet && styles.navGridTablet]}>
            {NAV_CARDS.map((card, index) => renderNavigationCard(card, index))}
          </View>

          {/* Quick Tips or Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Ionicons name="bulb-outline" size={24} color={colors.primary} />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>{t('pages.home.quick_tip_title')}</Text>
                <Text style={styles.infoText}>{t('pages.home.quick_tip_text')}</Text>
              </View>
            </View>
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
  // Reminders Card (matches Account page style)
  remindersCard: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  remindersCardTablet: {
    borderRadius: 16,
    padding: 20,
  },
  remindersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  remindersTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  reminderBadge: {
    backgroundColor: '#F97316',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  reminderBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  reminderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reminderCalendarIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reminderItemText: {
    flex: 1,
    fontSize: 14,
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
    flexDirection: 'column',
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
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  categoryIconTablet: {
    width: 56,
    height: 56,
    borderRadius: 16,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 18,
  },
  categoryNameTablet: {
    fontSize: 15,
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
