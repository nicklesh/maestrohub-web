import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import { useAuth } from '@/src/context/AuthContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';
import { format, parseISO } from 'date-fns';

interface ContactMessage {
  contact_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  subject: string;
  message: string;
  category: string;
  status: string;
  created_at: string;
  responded_at?: string;
}

export default function AdminInboxScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { t, formatDate } = useTranslation();
  const { width } = useWindowDimensions();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 960 : isTablet ? 720 : undefined;

  const styles = getStyles(colors);

  useEffect(() => {
    loadMessages();
  }, [filter]);

  const loadMessages = async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await api.get(`/admin/inbox${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data.messages || []);
      setPendingCount(response.data.pending_count || 0);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages();
  };

  const handleStatusChange = async (contactId: string, newStatus: string) => {
    try {
      const response = await api.put(`/admin/inbox/${contactId}?status=${newStatus}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Check if response indicates success
      if (response.data?.success || response.status === 200) {
        if (Platform.OS === 'web') {
          showInfo(`Message marked as ${newStatus}`);
        } else {
          showInfo(`Message marked as ${newStatus}`, 'Success');
        }
        
        loadMessages();
        setSelectedMessage(null);
      }
    } catch (error: any) {
      console.error('Status update error:', error);
      // Even if there's an error, refresh to see if it actually worked
      loadMessages();
      if (Platform.OS === 'web') {
        showError('Failed to update status');
      } else {
        showError('Failed to update status');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: colors.warningLight || colors.warning, text: colors.warning };
      case 'resolved':
        return { bg: colors.successLight, text: colors.success };
      default:
        return { bg: colors.gray200, text: colors.gray600 };
    }
  };

  const renderMessageCard = ({ item }: { item: ContactMessage }) => {
    const statusColors = getStatusColor(item.status);
    const createdDate = item.created_at ? parseISO(item.created_at) : new Date();

    return (
      <TouchableOpacity
        style={[styles.card, isTablet && styles.cardTablet]}
        onPress={() => setSelectedMessage(item)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>{item.user_name?.charAt(0) || 'U'}</Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {item.user_name}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textMuted }]} numberOfLines={1}>
                {item.user_email}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusText, { color: statusColors.text }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <Text style={[styles.subject, { color: colors.text }]} numberOfLines={1}>
          {item.subject}
        </Text>
        <Text style={[styles.messagePreview, { color: colors.textMuted }]} numberOfLines={2}>
          {item.message}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.categoryBadge}>
            <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.categoryText, { color: colors.textMuted }]}>{item.category}</Text>
          </View>
          <Text style={[styles.dateText, { color: colors.textMuted }]}>
            {format(createdDate, 'MMM d, yyyy h:mm a')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

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
      <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]}>{t('pages.admin.inbox_page.title')}</Text>
            {pendingCount > 0 && (
              <View style={[styles.pendingBadge, { backgroundColor: colors.error }]}>
                <Text style={styles.pendingText}>{pendingCount}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('pages.admin.inbox_page.subtitle')}
          </Text>
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabs}>
          {(['all', 'pending', 'resolved'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.tab,
                { 
                  backgroundColor: filter === f ? colors.primary : colors.surface,
                  borderColor: colors.border 
                }
              ]}
              onPress={() => setFilter(f)}
            >
              <Text style={[
                styles.tabText,
                { color: filter === f ? '#FFFFFF' : colors.text }
              ]}>
                {t(`pages.admin.inbox_page.${f}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="mail-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {t('pages.admin.inbox_page.no_messages')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            renderItem={renderMessageCard}
            keyExtractor={(item) => item.contact_id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>

      {/* Message Detail Modal */}
      <Modal visible={!!selectedMessage} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>{t('pages.admin.inbox_page.message_details')}</Text>
              <TouchableOpacity onPress={() => setSelectedMessage(null)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {selectedMessage && (
              <View style={styles.modalBody}>
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('pages.admin.inbox_page.from')}:</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selectedMessage.user_name} ({selectedMessage.user_email})
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('pages.admin.inbox_page.subject')}:</Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {selectedMessage.subject}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('pages.admin.inbox_page.message')}:</Text>
                </View>
                <Text style={[styles.fullMessage, { color: colors.text, backgroundColor: colors.background }]}>
                  {selectedMessage.message}
                </Text>
                
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{t('pages.admin.inbox_page.status')}:</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(selectedMessage.status).bg }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(selectedMessage.status).text }]}>
                      {t(`pages.admin.inbox_page.${selectedMessage.status}`)}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionButtons}>
                  {selectedMessage.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.success }]}
                      onPress={() => handleStatusChange(selectedMessage.contact_id, 'resolved')}
                    >
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>{t('pages.admin.inbox_page.mark_resolved')}</Text>
                    </TouchableOpacity>
                  )}
                  {selectedMessage.status === 'resolved' && (
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.warning }]}
                      onPress={() => handleStatusChange(selectedMessage.contact_id, 'pending')}
                    >
                      <Ionicons name="refresh" size={18} color="#FFFFFF" />
                      <Text style={styles.actionButtonText}>{t('pages.admin.inbox_page.reopen')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTablet: {
    padding: 20,
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 12,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  subject: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  messagePreview: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    textTransform: 'capitalize',
  },
  dateText: {
    fontSize: 11,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    width: 70,
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
  },
  fullMessage: {
    fontSize: 14,
    lineHeight: 22,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
