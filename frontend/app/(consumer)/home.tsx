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
    id: 'bookings',
    titleKey: 'pages.home.card_your_bookings',
    descriptionKey: 'pages.home.card_your_bookings_desc',
    icon: 'calendar',
    route: '/(consumer)/bookings',
    gradient: ['#10B981', '#059669'],
  },
  {
    id: 'kids',
    titleKey: 'pages.home.card_my_kids_sessions',
    descriptionKey: 'pages.home.card_my_kids_sessions_desc',
    icon: 'people',
    route: '/(consumer)/kids',
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

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Allow global background to show through
  },
  scrollContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  scrollContentTablet: {
    paddingHorizontal: 20,
  },
  contentWrapper: {
    width: '100%',
    paddingHorizontal: 16,
  },
  // Welcome Section
  welcomeSection: {
    marginTop: 20,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  welcomeTextTablet: {
    fontSize: 32,
  },
  welcomeSubtext: {
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 22,
  },
  welcomeSubtextTablet: {
    fontSize: 18,
  },
  // Navigation Grid (2x2)
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  navGridTablet: {
    gap: 16,
  },
  // Navigation Card
  navCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 160,
    justifyContent: 'flex-start',
  },
  navCardTablet: {
    padding: 24,
    minHeight: 180,
    borderRadius: 24,
  },
  navCardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  navCardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  navCardTitleTablet: {
    fontSize: 19,
  },
  navCardDescription: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    flex: 1,
  },
  navCardDescriptionTablet: {
    fontSize: 14,
    lineHeight: 20,
  },
  navCardArrow: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Info Section
  infoSection: {
    marginTop: 28,
    paddingHorizontal: 4,
  },
  infoCard: {
    backgroundColor: isDark ? colors.primaryLight : colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
  },
});
