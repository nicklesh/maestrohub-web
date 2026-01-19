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
  Share,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface ParentInvite {
  invite_id: string;
  invitee_email: string;
  invitee_name?: string;
  message?: string;
  status: string;
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
    id: 'email',
    name: 'Email',
    icon: 'mail',
    color: '#EA4335',
    getShareUrl: (message, url) => `mailto:?subject=${encodeURIComponent('Join Maestro Habitat!')}&body=${encodeURIComponent(message + '\n\n' + url)}`,
  },
  {
    id: 'gmail',
    name: 'Gmail',
    icon: 'mail-outline',
    color: '#D44638',
    getShareUrl: (message, url) => `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent('Join Maestro Habitat!')}&body=${encodeURIComponent(message + '\n\n' + url)}`,
  },
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
    getShareUrl: (message, url) => `https://www.instagram.com/`, // Instagram doesn't support direct sharing via URL
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: 'musical-notes',
    color: '#000000',
    getShareUrl: (message, url) => `https://www.tiktok.com/`, // TikTok doesn't support direct sharing via URL
  },
];

export default function InviteParentScreen() {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t, locale } = useTranslation();
  const [invites, setInvites] = useState<ParentInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [sending, setSending] = useState(false);

  const referralCode = user?.user_id?.slice(-8) || 'MAESTRO';
  const shareUrl = 'https://www.maestrohabitat.com';
  const shareMessage = t('pages.invite_parent.share_message', { code: referralCode });

  const loadInvites = useCallback(async () => {
    try {
      const response = await api.get('/consumer/parent-invites', {
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
      showError(t('forms.validation.enter_email_address'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      showError(t('forms.validation.invalid_email'));
      return;
    }

    setSending(true);
    try {
      await api.post('/consumer/invite-parent', {
        invitee_email: inviteEmail.trim(),
        invitee_name: inviteName.trim() || undefined,
        message: inviteMessage.trim() || undefined,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showSuccess('Invitation sent successfully!');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setInviteMessage('');
      loadInvites();
    } catch (error: any) {
      console.error('Failed to send invite:', error);
      showInfo(error.response?.data?.detail || 'Failed to send invitation', 'Error');
    } finally {
      setSending(false);
    }
  };

  const handleSocialShare = async (platform: SocialPlatform) => {
    const url = platform.getShareUrl(shareMessage, shareUrl);
    
    // For Instagram and TikTok, show a message that they need to copy the link
    if (platform.id === 'instagram' || platform.id === 'tiktok') {
      // Copy to clipboard first
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(shareMessage + '\n\n' + shareUrl);
        } catch (e) {
          console.error('Clipboard error:', e);
        }
      }
      
      showSuccess(`Link copied! Open ${platform.name} and paste the invite message.`, 'Link Copied!');
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        Linking.openURL(url);
      }
      setShowShareModal(false);
      return;
    }

    // For other platforms, open the share URL
    try {
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
      setShowShareModal(false);
    } catch (error) {
      console.error('Failed to open share URL:', error);
      showError('Failed to open sharing option');
    }
  };

  const handleNativeShare = async () => {
    try {
      await Share.share({
        message: shareMessage + '\n\n' + shareUrl,
        title: 'Join Maestro Habitat',
      });
      setShowShareModal(false);
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return colors.success;
      case 'pending': return colors.warning;
      case 'expired': return colors.textMuted;
      default: return colors.textMuted;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return 'checkmark-circle';
      case 'pending': return 'time';
      case 'expired': return 'close-circle';
      default: return 'ellipse';
    }
  };

  const renderInvite = ({ item }: { item: ParentInvite }) => (
    <View style={[styles.inviteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.inviteHeader}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {(item.invitee_name || item.invitee_email).charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.inviteInfo}>
          <Text style={[styles.inviteName, { color: colors.text }]}>
            {item.invitee_name || t('pages.invite_parent.parent')}
          </Text>
          <Text style={[styles.inviteEmail, { color: colors.textMuted }]}>
            {item.invitee_email}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons name={getStatusIcon(item.status) as any} size={14} color={getStatusColor(item.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {t(`common.${item.status}`)}
          </Text>
        </View>
      </View>
      {item.message && (
        <Text style={[styles.inviteMessage, { color: colors.textMuted }]} numberOfLines={2}>
          "{item.message}"
        </Text>
      )}
      <Text style={[styles.inviteDate, { color: colors.textMuted }]}>
        {t('pages.invite_parent.sent')} {new Date(item.created_at).toLocaleDateString(locale === 'hi_IN' ? 'hi-IN' : locale?.replace('_', '-') || 'en-US')}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack showUserName title={t("pages.invite_parent.title")} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack showUserName title={t("pages.invite_parent.title")} />
      
      {/* Share Link Card */}
      <View style={[styles.shareCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
        <View style={styles.shareCardContent}>
          <Ionicons name="share-social" size={28} color={colors.primary} />
          <View style={styles.shareTextContainer}>
            <Text style={[styles.shareTitle, { color: colors.text }]}>{t('pages.invite_parent.share_with_friends')}</Text>
            <Text style={[styles.shareSubtitle, { color: colors.textMuted }]}>
              {t('pages.invite_parent.share_subtitle')}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowShareModal(true)}
        >
          <Ionicons name="share-outline" size={18} color="#fff" />
          <Text style={styles.shareButtonText}>{t('pages.invite_parent.share_link')}</Text>
        </TouchableOpacity>
      </View>

      {/* Invites List */}
      <View style={styles.listHeader}>
        <Text style={[styles.listTitle, { color: colors.text }]}>{t('pages.invite_parent.your_invitations')}</Text>
        <TouchableOpacity
          style={[styles.inviteButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowInviteModal(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.inviteButtonText}>{t('pages.invite_parent.invite_by_email')}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={invites}
        renderItem={renderInvite}
        keyExtractor={(item) => item.invite_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadInvites();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('pages.invite_parent.no_invitations')}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {t('pages.invite_parent.no_invitations_desc')}
            </Text>
          </View>
        }
      />

      {/* Share Modal with Social Options */}
      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowShareModal(false)}
          />
          <View style={[styles.shareModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('pages.invite_parent.share_via')}</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Preview Card */}
            <View style={[styles.previewCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.previewTitle, { color: colors.text }]}>Join Maestro Habitat!</Text>
              <Text style={[styles.previewMessage, { color: colors.textMuted }]} numberOfLines={2}>
                {shareMessage}
              </Text>
              <Text style={[styles.previewUrl, { color: colors.primary }]}>{shareUrl}</Text>
            </View>

            {/* Social Icons Grid */}
            <ScrollView horizontal={false} showsVerticalScrollIndicator={false}>
              <View style={styles.socialGrid}>
                {SOCIAL_PLATFORMS.map((platform) => (
                  <TouchableOpacity
                    key={platform.id}
                    style={styles.socialButton}
                    onPress={() => handleSocialShare(platform)}
                  >
                    <View style={[styles.socialIconCircle, { backgroundColor: platform.color }]}>
                      <Ionicons name={platform.icon as any} size={24} color="#fff" />
                    </View>
                    <Text style={[styles.socialName, { color: colors.text }]}>{platform.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Native Share Option (for mobile) */}
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                style={[styles.nativeShareButton, { backgroundColor: colors.primary }]}
                onPress={handleNativeShare}
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
                <Text style={styles.nativeShareText}>More Options...</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Invite by Email Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInviteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowInviteModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('pages.invite_parent.invite_a_parent')}</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('pages.invite_parent.email_address')} *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="parent@example.com"
              placeholderTextColor={colors.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('pages.invite_parent.name_optional')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('pages.invite_parent.their_name')}
              placeholderTextColor={colors.textMuted}
              value={inviteName}
              onChangeText={setInviteName}
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{t('pages.invite_parent.personal_message')}</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder={t('pages.invite_parent.add_personal_note')}
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
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.sendButtonText}>{t('pages.invite_parent.send_invitation')}</Text>
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
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  shareCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  shareTextContainer: {
    flex: 1,
  },
  shareTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  shareSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  inviteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  inviteCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  inviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
  },
  inviteInfo: {
    flex: 1,
    marginLeft: 12,
  },
  inviteName: {
    fontSize: 15,
    fontWeight: '600',
  },
  inviteEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inviteMessage: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 12,
  },
  inviteDate: {
    fontSize: 12,
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  shareModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  previewCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  previewUrl: {
    fontSize: 12,
    marginTop: 8,
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 16,
    paddingVertical: 8,
  },
  socialButton: {
    alignItems: 'center',
    width: 70,
  },
  socialIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  socialName: {
    fontSize: 11,
    textAlign: 'center',
  },
  nativeShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 16,
  },
  nativeShareText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
