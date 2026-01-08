import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { api } from '@/src/services/api';
import { colors } from '@/src/theme/colors';

interface Student {
  student_id: string;
  name: string;
  age?: number;
  grade?: string;
}

export default function ProfileScreen() {
  const { user, logout, updateRole } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 640 : isTablet ? 560 : undefined;

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const response = await api.get('/students');
      setStudents(response.data);
    } catch (error) {
      console.error('Failed to load students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const handleSwitchToTutor = () => {
    Alert.alert(
      'Become a Tutor',
      'Would you like to create a tutor profile?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            await updateRole('tutor');
            router.replace('/(tutor)/onboarding');
          },
        },
      ]
    );
  };

  const MenuItem = ({
    icon,
    label,
    onPress,
    rightElement,
  }: {
    icon: string;
    label: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
  }) => (
    <TouchableOpacity style={[styles.menuItem, isTablet && styles.menuItemTablet]} onPress={onPress} disabled={!onPress}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon as any} size={isTablet ? 24 : 22} color={colors.primary} />
        <Text style={[styles.menuItemLabel, isDesktop && styles.menuItemLabelDesktop]}>{label}</Text>
      </View>
      {rightElement || <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
        <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Profile Header */}
          <View style={[styles.header, isTablet && styles.headerTablet]}>
            <View style={[styles.avatar, isDesktop && styles.avatarDesktop]}>
              <Text style={[styles.avatarText, isDesktop && styles.avatarTextDesktop]}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <Text style={[styles.userName, isDesktop && styles.userNameDesktop]}>{user?.name}</Text>
            <Text style={[styles.userEmail, isDesktop && styles.userEmailDesktop]}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {user?.role === 'consumer' ? 'Parent' : user?.role}
              </Text>
            </View>
          </View>

          {/* Students Section */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>My Students</Text>
              <TouchableOpacity onPress={() => router.push('/(consumer)/students')}>
                <Text style={styles.sectionAction}>Manage</Text>
              </TouchableOpacity>
            </View>
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : students.length === 0 ? (
              <TouchableOpacity
                style={[styles.addStudentCard, isTablet && styles.addStudentCardTablet]}
                onPress={() => router.push('/(consumer)/students')}
              >
                <Ionicons name="add-circle-outline" size={isTablet ? 40 : 32} color={colors.primary} />
                <Text style={styles.addStudentText}>Add a student</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.studentsList}>
                {students.slice(0, 3).map((student) => (
                  <View key={student.student_id} style={[styles.studentCard, isTablet && styles.studentCardTablet]}>
                    <View style={[styles.studentAvatar, isTablet && styles.studentAvatarTablet]}>
                      <Text style={[styles.studentInitial, isTablet && styles.studentInitialTablet]}>
                        {student.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={[styles.studentName, isDesktop && styles.studentNameDesktop]}>{student.name}</Text>
                      {student.grade && (
                        <Text style={styles.studentGrade}>Grade {student.grade}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Menu Section */}
          <View style={[styles.section, isTablet && styles.sectionTablet]}>
            <Text style={[styles.sectionTitle, isDesktop && styles.sectionTitleDesktop]}>Account</Text>
            <View style={[styles.menuCard, isTablet && styles.menuCardTablet]}>
              <MenuItem
                icon="person-outline"
                label="Edit Profile"
                onPress={() => {}}
              />
              <MenuItem
                icon="notifications-outline"
                label="Notifications"
                onPress={() => {}}
              />
              <MenuItem
                icon="card-outline"
                label="Payment Methods"
                onPress={() => {}}
              />
              <MenuItem
                icon="school-outline"
                label="Become a Tutor"
                onPress={handleSwitchToTutor}
              />
            </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  scrollContentTablet: {
    paddingVertical: 32,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTablet: {
    borderRadius: 20,
    marginHorizontal: 20,
    marginBottom: 8,
    borderBottomWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarDesktop: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.primary,
  },
  avatarTextDesktop: {
    fontSize: 40,
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  userNameDesktop: {
    fontSize: 26,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  userEmailDesktop: {
    fontSize: 16,
  },
  roleBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
    textTransform: 'capitalize',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTablet: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  sectionAction: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  addStudentCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addStudentCardTablet: {
    padding: 32,
    borderRadius: 16,
  },
  addStudentText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  studentsList: {
    gap: 12,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  studentCardTablet: {
    padding: 16,
    borderRadius: 16,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentAvatarTablet: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  studentInitial: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  studentInitialTablet: {
    fontSize: 18,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  studentNameDesktop: {
    fontSize: 16,
  },
  studentGrade: {
    fontSize: 12,
    color: colors.textMuted,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuCardTablet: {
    borderRadius: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemTablet: {
    padding: 18,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemLabel: {
    fontSize: 15,
    color: colors.text,
  },
  menuItemLabelDesktop: {
    fontSize: 17,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: colors.errorLight,
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
