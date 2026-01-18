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
  Alert,
  RefreshControl,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
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

export default function InviteParentScreen() {
  const { token, user } = useAuth();
  const { colors } = useTheme();
  const [invites, setInvites] = useState<ParentInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [sending, setSending] = useState(false);

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
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
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

      Alert.alert('Success', 'Invitation sent successfully!');
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      setInviteMessage('');
      loadInvites();
    } catch (error: any) {
      console.error('Failed to send invite:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  const handleShareLink = async () => {
    try {
      const referralCode = user?.user_id?.slice(-8) || 'MAESTRO';
      const shareMessage = `Join me on Maestro Habitat - the best platform to find quality coaches for your kids! Use my referral code: ${referralCode}\n\nSign up at: https://www.maestrohabitat.com`;
      
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: 'Join Maestro Habitat',
            text: shareMessage,
          });
        } else {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(shareMessage);
          Alert.alert('Copied!', 'Invite link copied to clipboard');
        }
      } else {
        await Share.share({
          message: shareMessage,
        });
      }
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
            {item.invitee_name || 'Parent'}
          </Text>
          <Text style={[styles.inviteEmail, { color: colors.textMuted }]}>
            {item.invitee_email}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons name={getStatusIcon(item.status) as any} size={14} color={getStatusColor(item.status)} />
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      {item.message && (
        <Text style={[styles.inviteMessage, { color: colors.textMuted }]} numberOfLines={2}>
          "{item.message}"
        </Text>
      )}
      <Text style={[styles.inviteDate, { color: colors.textMuted }]}>
        Sent {new Date(item.created_at).toLocaleDateString()}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack showUserName title="Invite Parents" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack showUserName title="Invite Parents" />
      
      {/* Share Link Card */}
      <View style={[styles.shareCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
        <View style={styles.shareCardContent}>
          <Ionicons name="share-social" size={28} color={colors.primary} />
          <View style={styles.shareTextContainer}>
            <Text style={[styles.shareTitle, { color: colors.text }]}>Share with Friends</Text>
            <Text style={[styles.shareSubtitle, { color: colors.textMuted }]}>
              Invite other parents to join Maestro Habitat
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: colors.primary }]}
          onPress={handleShareLink}
        >
          <Ionicons name="link" size={18} color="#fff" />
          <Text style={styles.shareButtonText}>Share Link</Text>
        </TouchableOpacity>
      </View>

      {/* Invites List */}
      <View style={styles.listHeader}>
        <Text style={[styles.listTitle, { color: colors.text }]}>Your Invitations</Text>
        <TouchableOpacity
          style={[styles.inviteButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowInviteModal(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.inviteButtonText}>Invite by Email</Text>
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
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No invitations yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Invite other parents to discover great coaches
            </Text>
          </View>
        }
      />

      {/* Invite Modal */}
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>Invite a Parent</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Email Address *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="parent@example.com"
              placeholderTextColor={colors.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Name (Optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Their name"
              placeholderTextColor={colors.textMuted}
              value={inviteName}
              onChangeText={setInviteName}
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Personal Message (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Add a personal note..."
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
                  <Text style={styles.sendButtonText}>Send Invitation</Text>
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
