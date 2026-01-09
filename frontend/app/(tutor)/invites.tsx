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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface Invite {
  invite_id: string;
  email: string;
  name?: string;
  message?: string;
  status: string;
  created_at: string;
  expires_at: string;
  accepted_at?: string;
}

export default function InvitesScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewInviteModal, setShowNewInviteModal] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteName, setNewInviteName] = useState('');
  const [newInviteMessage, setNewInviteMessage] = useState('');
  const [sending, setSending] = useState(false);

  const loadInvites = useCallback(async () => {
    try {
      const response = await api.get('/invites/sent', {
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

  const onRefresh = () => {
    setRefreshing(true);
    loadInvites();
  };

  const handleSendInvite = async () => {
    if (!newInviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newInviteEmail.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setSending(true);
    try {
      await api.post('/invites', {
        email: newInviteEmail.trim(),
        name: newInviteName.trim() || undefined,
        message: newInviteMessage.trim() || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      Alert.alert('Success', 'Invite sent successfully!');
      setShowNewInviteModal(false);
      setNewInviteEmail('');
      setNewInviteName('');
      setNewInviteMessage('');
      loadInvites();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  const handleCancelInvite = (inviteId: string) => {
    Alert.alert(
      'Cancel Invite',
      'Are you sure you want to cancel this invite?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/invites/${inviteId}`, {
                headers: { Authorization: `Bearer ${token}` }
              });
              loadInvites();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel invite');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return colors.success;
      case 'declined': return colors.error;
      case 'expired': return colors.textMuted;
      default: return colors.primary;
    }
  };

  const getStatusIcon = (status: string): any => {
    switch (status) {
      case 'accepted': return 'checkmark-circle';
      case 'declined': return 'close-circle';
      case 'expired': return 'time';
      default: return 'hourglass';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const renderInviteCard = ({ item }: { item: Invite }) => (
    <View style={[styles.inviteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.inviteHeader}>
        <View style={styles.inviteInfo}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{(item.name || item.email).charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.inviteDetails}>
            {item.name && <Text style={[styles.inviteName, { color: colors.text }]}>{item.name}</Text>}
            <Text style={[styles.inviteEmail, { color: colors.textMuted }]}>{item.email}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons name={getStatusIcon(item.status)} size={14} color={getStatusColor(item.status)} />
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
      
      <View style={styles.inviteFooter}>
        <Text style={[styles.inviteDate, { color: colors.textMuted }]}>
          Sent: {formatDate(item.created_at)}
        </Text>
        {item.status === 'pending' && (
          <TouchableOpacity 
            onPress={() => handleCancelInvite(item.invite_id)}
            style={[styles.cancelButton, { borderColor: colors.error }]}
          >
            <Text style={[styles.cancelButtonText, { color: colors.error }]}>Cancel</Text>
          </TouchableOpacity>
        )}
        {item.status === 'accepted' && item.accepted_at && (
          <Text style={[styles.acceptedDate, { color: colors.success }]}>
            Accepted: {formatDate(item.accepted_at)}
          </Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader />
      
      <View style={styles.content}>
        {/* Title and New Invite Button */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Student Invites</Text>
          <TouchableOpacity 
            style={[styles.newInviteButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowNewInviteModal(true)}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.newInviteButtonText}>New Invite</Text>
          </TouchableOpacity>
        </View>

        {/* Invites List */}
        {invites.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="mail-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No invites yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Send invites to students you'd like to connect with
            </Text>
          </View>
        ) : (
          <FlatList
            data={invites}
            renderItem={renderInviteCard}
            keyExtractor={(item) => item.invite_id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>

      {/* New Invite Modal */}
      <Modal visible={showNewInviteModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowNewInviteModal(false)}
          />
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.gray300 }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Send Invite</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
              Invite a student to connect with you on Maestro Hub
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Email *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="student@example.com"
              placeholderTextColor={colors.textMuted}
              value={newInviteEmail}
              onChangeText={setNewInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Name (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Student's name"
              placeholderTextColor={colors.textMuted}
              value={newInviteName}
              onChangeText={setNewInviteName}
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Personal Message (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Hi! I'd love to help you with..."
              placeholderTextColor={colors.textMuted}
              value={newInviteMessage}
              onChangeText={setNewInviteMessage}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.primary }, sending && styles.submitButtonDisabled]}
              onPress={handleSendInvite}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.submitButtonText}>Send Invite</Text>
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
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  newInviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  newInviteButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
  },
  inviteCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  inviteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  inviteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 18,
  },
  inviteDetails: {
    marginLeft: 12,
    flex: 1,
  },
  inviteName: {
    fontSize: 16,
    fontWeight: '600',
  },
  inviteEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  inviteMessage: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 12,
  },
  inviteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  inviteDate: {
    fontSize: 12,
  },
  acceptedDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  cancelButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  cancelButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
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
  },
  sheetSubtitle: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
