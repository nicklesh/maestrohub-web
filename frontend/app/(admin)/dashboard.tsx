import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [stats, setStats] = useState({ tutors: 0, bookings: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : undefined;
  
  const styles = getStyles(colors);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [tutorsRes, analyticsRes] = await Promise.all([
        api.get('/admin/tutors', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/admin/analytics/markets', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { markets: [] } }))
      ]);
      
      const totalRevenue = analyticsRes.data.markets?.reduce((sum: number, m: any) => sum + (m.total_revenue_cents || 0), 0) || 0;
      
      setStats({
        tutors: tutorsRes.data?.length || 0,
        bookings: analyticsRes.data.markets?.reduce((sum: number, m: any) => sum + (m.total_bookings || 0), 0) || 0,
        revenue: totalRevenue / 100
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack={false} />
      <ScrollView contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Header */}
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Admin Dashboard</Text>
            <Text style={[styles.subtitle, isDesktop && styles.subtitleDesktop]}>Manage your marketplace</Text>
          </View>

          {/* Quick Stats */}
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />
          ) : (
            <View style={[styles.statsGrid, isTablet && styles.statsGridTablet]}>
              <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
                <Ionicons name="people" size={isTablet ? 28 : 24} color={colors.primary} />
                <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>{stats.tutors}</Text>
                <Text style={styles.statLabel}>Tutors</Text>
              </View>
              <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
                <Ionicons name="calendar" size={isTablet ? 28 : 24} color={colors.accent} />
                <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>{stats.bookings}</Text>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>
              <View style={[styles.statCard, isTablet && styles.statCardTablet]}>
                <Ionicons name="cash" size={isTablet ? 28 : 24} color={colors.success} />
                <Text style={[styles.statValue, isDesktop && styles.statValueDesktop]}>${stats.revenue.toFixed(0)}</Text>
                <Text style={styles.statLabel}>Revenue</Text>
              </View>
            </View>
          )}

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
                <Text style={[styles.actionTitle, isDesktop && styles.actionTitleDesktop]}>Review Coaches</Text>
                <Text style={[styles.actionSubtitle, isDesktop && styles.actionSubtitleDesktop]}>Approve or suspend tutor profiles</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionCard, isTablet && styles.actionCardTablet]}
              onPress={() => router.push('/(admin)/inbox')}
            >
              <View style={[styles.actionIcon, isTablet && styles.actionIconTablet]}>
                <Ionicons name="mail" size={isTablet ? 28 : 24} color={colors.accent} />
              </View>
              <View style={styles.actionInfo}>
                <Text style={[styles.actionTitle, isDesktop && styles.actionTitleDesktop]}>Inbox</Text>
                <Text style={[styles.actionSubtitle, isDesktop && styles.actionSubtitleDesktop]}>View contact form submissions</Text>
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

const getStyles = (colors: ThemeColors) => StyleSheet.create({
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
  headerTablet: {
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  titleDesktop: {
    fontSize: 28,
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
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  sectionTitleDesktop: {
    fontSize: 20,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  actionCardTablet: {
    padding: 20,
    borderRadius: 20,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionIconTablet: {
    width: 56,
    height: 56,
    borderRadius: 14,
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
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  infoCardTablet: {
    padding: 20,
    borderRadius: 20,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  infoTitleDesktop: {
    fontSize: 16,
  },
  infoSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
