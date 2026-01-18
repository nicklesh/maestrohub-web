import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface Invite {
  invite_id: string;
  tutor_email: string;
  tutor_name?: string;
  message?: string;
  status: string;
  free_session_credit: boolean;
  credit_amount: number;
  created_at: string;
}

interface SocialPlatform {
  id: string;
  name: string;
  icon: string;
  color: string;
  getShareUrl: (message: string, url: string) => string;
}

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: 'logo-whatsapp',
    color: '#25D366',
    getShareUrl: (message, url) => `https://wa.me/?text=${encodeURIComponent(message + '\n\n' + url)}`,
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: 'logo-facebook',
    color: '#1877F2',
    getShareUrl: (message, url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(message)}`,
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    icon: 'logo-twitter',
    color: '#000000',
    getShareUrl: (message, url) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: 'logo-linkedin',
    color: '#0A66C2',
    getShareUrl: (message, url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'logo-instagram',
    color: '#E4405F',
    getShareUrl: (message, url) => `https://www.instagram.com/`,
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'musical-notes',
    color: '#000000',
    getShareUrl: (message, url) => `https://www.tiktok.com/`,
  },
];

export default function InviteProviderScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [sending, setSending] = useState(false);

  const loadInvites = useCallback(async () => {
    try {
      const response = await api.get('/consumer/invites', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvites(response.data.invites || []);
    } catch (error) {
      console.error('Failed to load invites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      showError('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      showError('Please enter a valid email address');
      return;
    }

    setSending(true);
    try {
      const response = await api.post('/consumer/invite-provider', {
        tutor_email: inviteEmail.trim(),
        tutor_name: inviteName.trim() || undefined,
        message: inviteMessage.trim() || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showInfo(`Your invite includes a $${response.data.credit_amount} free session credit!`
      , 'Invite Sent!');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setInviteMessage('');
      loadInvites();
    } catch (error: any) {
      showInfo(error.response?.data?.detail || 'Failed to send invite', 'Error');
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return colors.success;
      case 'declined': return colors.error;
      case 'expired': return colors.textMuted;
      default: return colors.primary;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderInvite = ({ item }: { item: Invite }) => (
    <View style={[styles.inviteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.inviteHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {(item.tutor_name || item.tutor_email).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.inviteInfo}>
          {item.tutor_name && (
            <Text style={[styles.inviteName, { color: colors.text }]}>{item.tutor_name}</Text>
          )}
          <Text style={[styles.inviteEmail, { color: colors.textMuted }]}>{item.tutor_email}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      {item.free_session_credit && (
        <View style={[styles.creditBadge, { backgroundColor: colors.success + '20' }]}>
          <Ionicons name="gift" size={16} color={colors.success} />
          <Text style={[styles.creditText, { color: colors.success }]}>
            ${item.credit_amount} Free Session Credit
          </Text>
        </View>
      )}

      <Text style={[styles.inviteDate, { color: colors.textMuted }]}>Sent: {formatDate(item.created_at)}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack showUserName title="Invite Providers" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack showUserName title="Invite Providers" />

      <View style={styles.content}>
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="gift" size={24} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.primary }]}>Refer & Earn</Text>
            <Text style={[styles.infoText, { color: colors.text }]}>
              Invite providers and get a free session credit when they join!
            </Text>
          </View>
        </View>

        {/* Invite Button */}
        <TouchableOpacity
          style={[styles.inviteButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowInviteModal(true)}
        >
          <Ionicons name="person-add" size={20} color="#FFFFFF" />
          <Text style={styles.inviteButtonText}>Invite a Provider</Text>
        </TouchableOpacity>

        {/* Invites List */}
        {invites.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="mail-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No invites sent yet</Text>
          </View>
        ) : (
          <FlatList
            data={invites}
            renderItem={renderInvite}
            keyExtractor={(item) => item.invite_id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadInvites(); }} />
            }
          />
        )}
      </View>

      {/* Invite Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowInviteModal(false)}
          />
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.gray300 }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Invite a Provider</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
              They'll get a $50 free session credit when they join!
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Provider's Email *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="tutor@example.com"
              placeholderTextColor={colors.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Provider's Name (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="John Smith"
              placeholderTextColor={colors.textMuted}
              value={inviteName}
              onChangeText={setInviteName}
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Personal Message (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Hi! I'd love to have you as my tutor..."
              placeholderTextColor={colors.textMuted}
              value={inviteMessage}
              onChangeText={setInviteMessage}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: colors.primary }, sending && styles.sendButtonDisabled]}
              onPress={handleSendInvite}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>Send Invite</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 16 },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoContent: { marginLeft: 12, flex: 1 },
  infoTitle: { fontSize: 15, fontWeight: '600' },
  infoText: { fontSize: 13, marginTop: 2 },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
  },
  inviteButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  listContent: { paddingBottom: 16 },
  inviteCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  inviteHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: '600', fontSize: 18 },
  inviteInfo: { flex: 1, marginLeft: 12 },
  inviteName: { fontSize: 15, fontWeight: '600' },
  inviteEmail: { fontSize: 13, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: '500' },
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  creditText: { fontSize: 13, fontWeight: '500' },
  inviteDate: { fontSize: 12, marginTop: 12 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, marginTop: 12 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '600' },
  sheetSubtitle: { fontSize: 14, marginTop: 4, marginBottom: 16 },
  inputLabel: { fontSize: 13, marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  sendButtonDisabled: { opacity: 0.7 },
  sendButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
