import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import AppHeader from '@/src/components/AppHeader';

export default function AdminSettings() {
  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 600 : isTablet ? 520 : undefined;

  const styles = getStyles(colors);

  const handleLogout = async () => {
    const doLogout = async () => {
      try {
        if (Platform.OS === 'web') {
          try {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            sessionStorage.clear();
          } catch (e) {
            console.error('Storage clear error:', e);
          }
        }
        await logout();
      } catch (e) {
        console.error('Logout error:', e);
      }
      router.replace('/(auth)/login');
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        await doLogout();
      }
    } else {
      Alert.alert('Logout', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: doLogout },
      ]);
    }
  };

  const showComingSoon = (feature: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${feature} settings coming soon!`);
    } else {
      Alert.alert('Coming Soon', `${feature} settings will be available in a future update.`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack={false} />
      <ScrollView contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Settings</Text>
          </View>

          {/* Profile */}
          <View style={[styles.profileCard, isTablet && styles.profileCardTablet]}>
            <View style={[styles.avatar, isDesktop && styles.avatarDesktop]}>
              <Text style={[styles.avatarText, isDesktop && styles.avatarTextDesktop]}>
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, isDesktop && styles.profileNameDesktop]}>{user?.name}</Text>
              <Text style={[styles.profileEmail, isDesktop && styles.profileEmailDesktop]}>{user?.email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>Administrator</Text>
              </View>
            </View>
          </View>

          {/* Appearance Section */}
          <View style={[styles.card, isTablet && styles.cardTablet]}>
            <Text style={[styles.cardTitle, isDesktop && styles.cardTitleDesktop]}>Appearance</Text>
            <View style={styles.themeRow}>
              <View style={styles.themeLeft}>
                <Ionicons 
                  name={isDark ? 'moon' : 'sunny'} 
                  size={isTablet ? 24 : 22} 
                  color={colors.primary} 
                />
                <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>
                  Dark Mode
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.gray300, true: colors.primary }}
                thumbColor={isDark ? colors.white : colors.white}
              />
            </View>
          </View>

          {/* Admin Menu */}
          <View style={[styles.menu, isTablet && styles.menuTablet]}>
            <TouchableOpacity 
              style={[styles.menuItem, isTablet && styles.menuItemTablet]}
              onPress={() => router.push('/(admin)/pricing')}
            >
              <Ionicons name="pricetag-outline" size={isTablet ? 24 : 22} color={colors.primary} />
              <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>Pricing Policies</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, isTablet && styles.menuItemTablet]}
              onPress={() => router.push('/(admin)/scheduled-jobs')}
            >
              <Ionicons name="time-outline" size={isTablet ? 24 : 22} color={colors.primary} />
              <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>Scheduled Jobs</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, isTablet && styles.menuItemTablet]}
              onPress={() => router.push('/(admin)/notifications-settings')}
            >
              <Ionicons name="notifications-outline" size={isTablet ? 24 : 22} color={colors.primary} />
              <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>Notifications</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.menuItem, isTablet && styles.menuItemTablet, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/(admin)/security')}
            >
              <Ionicons name="shield-outline" size={isTablet ? 24 : 22} color={colors.primary} />
              <Text style={[styles.menuItemText, isDesktop && styles.menuItemTextDesktop]}>Security</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Logout */}
          <TouchableOpacity style={[styles.logoutButton, isTablet && styles.logoutButtonTablet]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={colors.error} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
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
    paddingBottom: 40,
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileCardTablet: {
    borderRadius: 20,
    padding: 24,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarDesktop: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.primary,
  },
  avatarTextDesktop: {
    fontSize: 34,
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  profileNameDesktop: {
    fontSize: 22,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  profileEmailDesktop: {
    fontSize: 16,
  },
  roleBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTablet: {
    borderRadius: 20,
    padding: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  cardTitleDesktop: {
    fontSize: 18,
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menu: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuTablet: {
    borderRadius: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  menuItemTablet: {
    padding: 20,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  menuItemTextDesktop: {
    fontSize: 18,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorLight,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  logoutButtonTablet: {
    padding: 18,
    borderRadius: 14,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.error,
  },
});
