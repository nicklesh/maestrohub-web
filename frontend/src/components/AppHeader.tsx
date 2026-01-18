import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { api } from '@/src/services/api';

// App branding from environment variables
const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'Maestro Habitat';

interface AppHeaderProps {
  showBack?: boolean;
  title?: string;
  showUserName?: boolean;
}

// Gold color for dark mode envelope
const GOLD_COLOR = '#D4AF37';

export default function AppHeader({ showBack = false, title, showUserName = false }: AppHeaderProps) {
  const { user, logout, token } = useAuth();
  const { colors, isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  
  const [showContactSheet, setShowContactSheet] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [submittingContact, setSubmittingContact] = useState(false);

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'consumer': return 'Parent';
      case 'tutor': return 'Tutor';
      case 'admin': return 'Admin';
      default: return role;
    }
  };

  const handleLogoPress = () => {
    // Navigate to in-app home based on role (same page navigation)
    if (user?.role === 'tutor') {
      router.replace('/(tutor)/dashboard');
    } else if (user?.role === 'admin') {
      router.replace('/(admin)/dashboard');
    } else {
      router.replace('/(consumer)/home');
    }
  };

  const handleBack = () => {
    // On web, use browser history if available
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        // Fallback to home based on role
        handleLogoPress();
      }
    } else if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback to home based on role
      handleLogoPress();
    }
  };

  const handleLogout = async () => {
    // On web, use window.confirm instead of Alert
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        try {
          await logout();
        } catch (error) {
          console.error('Logout error:', error);
        }
        // Force redirect after logout regardless of success/failure
        window.location.href = '/login';
      }
    } else {
      // For native, we'll proceed with logout directly
      try {
        await logout();
        router.replace('/(auth)/login');
      } catch (error) {
        console.error('Logout error:', error);
        showError('Failed to logout');
      }
    }
  };

  const handleContactSubmit = async () => {
    if (!contactSubject.trim() || !contactMessage.trim()) {
      showError('Please fill in all fields');
      return;
    }

    setSubmittingContact(true);
    try {
      await api.post('/contact', {
        subject: contactSubject,
        message: contactMessage,
        category: 'general'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      showSuccess('Your message has been sent!');
      setShowContactSheet(false);
      setContactSubject('');
      setContactMessage('');
    } catch (error) {
      showError('Failed to send message');
    } finally {
      setSubmittingContact(false);
    }
  };

  // Determine envelope color - gold in dark mode, text color in light mode
  const envelopeColor = isDark ? GOLD_COLOR : colors.text;

  return (
    <>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {/* Left - Back Button OR User Info */}
        <View style={styles.headerLeft}>
          {showBack ? (
            <View style={styles.backContainer}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              {showUserName && title && (
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </Text>
              )}
              {showUserName && !title && user?.name && (
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  {user.name}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.userInfo}>
              <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.userAvatarText}>{user?.name?.charAt(0) || 'U'}</Text>
              </View>
              <View style={styles.userDetails}>
                <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                  {user?.name?.split(' ')[0] || 'User'}
                </Text>
                <Text style={[styles.userRole, { color: colors.textMuted }]}>
                  {getRoleDisplay(user?.role || '')}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Center - Logo (different for dark/light mode) */}
        <TouchableOpacity onPress={handleLogoPress} style={styles.logoContainer}>
          <Image
            source={isDark 
              ? require('../../assets/images/mh_logo_dark_trimmed.png')
              : require('../../assets/images/mh_logo_trimmed.png')
            }
            style={styles.logo}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {/* Right - Actions */}
        <View style={styles.headerRight}>
          {/* Hide Contact Us for admin users */}
          {user?.role !== 'admin' && (
            <TouchableOpacity 
              onPress={() => setShowContactSheet(true)} 
              style={[styles.iconButton, { backgroundColor: colors.background }]}
            >
              <Ionicons name="mail-outline" size={20} color={envelopeColor} />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={handleLogout} 
            style={[styles.iconButton, { backgroundColor: colors.background }]}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Contact Us Bottom Sheet - Fixed for dark mode */}
      <Modal visible={showContactSheet} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setShowContactSheet(false)}
          />
          <View style={[
            styles.bottomSheet, 
            { 
              backgroundColor: colors.surface,
              // Ensure no white corners in dark mode
              overflow: 'hidden',
            }
          ]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.gray300 }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Contact Us</Text>
            
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Subject</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="What can we help you with?"
              placeholderTextColor={colors.textMuted}
              value={contactSubject}
              onChangeText={setContactSubject}
            />
            
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Describe your issue or question..."
              placeholderTextColor={colors.textMuted}
              value={contactMessage}
              onChangeText={setContactMessage}
              multiline
              numberOfLines={4}
            />
            
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={handleContactSubmit}
              disabled={submittingContact}
            >
              {submittingContact ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Send Message</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    maxWidth: 120,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  userDetails: {
    maxWidth: 80,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
  },
  userRole: {
    fontSize: 10,
  },
  logoContainer: {
    flex: 1,
    alignItems: 'center',
  },
  logo: {
    width: 175,
    height: 70,
  },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    // Ensure rounded corners clip content
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
