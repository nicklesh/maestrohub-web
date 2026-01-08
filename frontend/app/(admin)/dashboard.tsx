import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme/colors';

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : undefined;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          <View style={styles.header}>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Admin Dashboard</Text>
            <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>Manage your marketplace</Text>
          </View>

          {/* Quick Stats */}
          <View style={[styles.statsGrid, isTablet && styles.statsGridTablet]}>
            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Ionicons name="people" size={isTablet ? 28 : 24} color={colors.primary} />
              <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>0</Text>
              <Text style={styles.statLabel}>Tutors</Text>
            </View>
            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Ionicons name="calendar" size={isTablet ? 28 : 24} color={colors.accent} />
              <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>0</Text>
              <Text style={styles.statLabel}>Bookings</Text>
            </View>
            <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
              <Ionicons name="cash" size={isTablet ? 28 : 24} color={colors.success} />
              <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>$0</Text>
              <Text style={styles.statLabel}>Revenue</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Quick Actions</Text>
            <TouchableOpacity
              style={[styles.actionCard, isTablet && styles.actionCardTablet]}
              onPress={() => router.push('/(admin)/tutors')}
            >
              <View style={[styles.actionIcon, isTablet && styles.actionIconTablet]}>
                <Ionicons name="checkmark-circle" size={isTablet ? 28 : 24} color={colors.primary} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, isDesktop && styles.actionTitleDesktop]}>Review Tutors</Text>
                <Text style={[styles.actionSubtitle, isDesktop && styles.actionSubtitleDesktop]}>Approve or suspend tutor profiles</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Admin Info */}
          <View style={[styles.infoCard, isTablet && styles.infoCardTablet]}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <View style={styles.infoText}>
              <Text style={[styles.infoTitle, isDesktop && styles.infoTitleDesktop]}>Admin Access</Text>
              <Text style={styles.infoSubtitle}>You are logged in as {user?.email}</Text>
            </View>
          </View>
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
  scrollContent: {
    padding: 20,
  },
  scrollContentTablet: {
    padding: 32,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  titleDesktop: {
    fontSize: 32,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  subtitleDesktop: {
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statsGridTablet: {
    gap: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCardTablet: {
    borderRadius: 20,
    padding: 24,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  statValueDesktop: {
    fontSize: 28,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTablet: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  sectionTitleDesktop: {
    fontSize: 18,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionCardTablet: {
    borderRadius: 20,
    padding: 20,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionIconTablet: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  actionTitleDesktop: {
    fontSize: 18,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  actionSubtitleDesktop: {
    fontSize: 14,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoCardTablet: {
    borderRadius: 16,
    padding: 20,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  infoTitleDesktop: {
    fontSize: 16,
  },
  infoSubtitle: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 2,
  },
});
