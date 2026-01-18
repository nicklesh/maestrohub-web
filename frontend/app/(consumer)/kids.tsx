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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface Kid {
  student_id: string;
  name: string;
  age?: number;
  grade?: string;
  notes?: string;
  email?: string;
  phone?: string;
  auto_send_schedule: boolean;
  notify_upcoming_sessions: boolean;
}

export default function KidsScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  const [kids, setKids] = useState<Kid[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingKid, setEditingKid] = useState<Kid | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formAge, setFormAge] = useState('');
  const [formGrade, setFormGrade] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAutoSend, setFormAutoSend] = useState(false);
  const [formNotifyUpcoming, setFormNotifyUpcoming] = useState(false);

  const loadKids = useCallback(async () => {
    try {
      const response = await api.get('/students', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKids(response.data || []);
    } catch (error) {
      console.error('Failed to load kids:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadKids();
  }, [loadKids]);

  const resetForm = () => {
    setFormName('');
    setFormAge('');
    setFormGrade('');
    setFormEmail('');
    setFormPhone('');
    setFormAutoSend(false);
    setFormNotifyUpcoming(false);
    setEditingKid(null);
  };

  const openEditModal = (kid: Kid) => {
    setEditingKid(kid);
    setFormName(kid.name);
    setFormAge(kid.age?.toString() || '');
    setFormGrade(kid.grade || '');
    setFormEmail(kid.email || '');
    setFormPhone(kid.phone || '');
    setFormAutoSend(kid.auto_send_schedule || false);
    setFormNotifyUpcoming(kid.notify_upcoming_sessions || false);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      showError('Please enter the child\'s name');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: formName.trim(),
        age: formAge ? parseInt(formAge) : null,
        grade: formGrade.trim() || null,
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        auto_send_schedule: formAutoSend,
        notify_upcoming_sessions: formNotifyUpcoming
      };

      if (editingKid) {
        await api.put(`/students/${editingKid.student_id}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showSuccess(t('messages.success.child_updated'));
      } else {
        await api.post('/students', data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showSuccess(t('messages.success.child_added'));
      }

      setShowAddModal(false);
      resetForm();
      loadKids();
    } catch (error: any) {
      showError(error.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (kid: Kid) => {
    // Use window.confirm on web
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to remove ${kid.name}?`);
      if (confirmed) {
        try {
          await api.delete(`/students/${kid.student_id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          loadKids();
          showSuccess('Child removed');
        } catch (error) {
          showError('Failed to delete');
        }
      }
    } else {
      // For native, proceed directly (or implement native confirmation)
      try {
        await api.delete(`/students/${kid.student_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        loadKids();
        showSuccess('Child removed');
      } catch (error) {
        showError('Failed to delete');
      }
    }
  };

  const handleSendSchedule = async (kid: Kid) => {
    if (!kid.email) {
      showError('Please add an email address for this child first');
      return;
    }

    try {
      await api.post(`/students/${kid.student_id}/send-schedule`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showSuccess(`Schedule sent to ${kid.email}`);
    } catch (error: any) {
      showError(error.response?.data?.detail || 'Failed to send schedule');
    }
  };

  const renderKidCard = ({ item }: { item: Kid }) => (
    <TouchableOpacity
      style={[styles.kidCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push(`/(consumer)/kid/${item.student_id}`)}
    >
      <View style={styles.kidHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.kidInfo}>
          <Text style={[styles.kidName, { color: colors.text }]}>{item.name}</Text>
          {item.grade && (
            <Text style={[styles.kidGrade, { color: colors.textMuted }]}>{item.grade}</Text>
          )}
        </View>
        <View style={styles.kidActions}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.background }]}
            onPress={() => openEditModal(item)}
          >
            <Ionicons name="pencil" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.background }]}
            onPress={() => handleDelete(item)}
          >
            <Ionicons name="trash" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {item.email && (
        <View style={styles.emailRow}>
          <Ionicons name="mail" size={14} color={colors.textMuted} />
          <Text style={[styles.emailText, { color: colors.textMuted }]}>{item.email}</Text>
          <TouchableOpacity onPress={() => handleSendSchedule(item)}>
            <Text style={[styles.sendLink, { color: colors.primary }]}>Send Schedule</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.viewSchedule}>
        <Ionicons name="calendar" size={16} color={colors.primary} />
        <Text style={[styles.viewScheduleText, { color: colors.primary }]}>View Schedule & Payments</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </View>
    </TouchableOpacity>
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
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>My Kids</Text>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              resetForm();
              setShowAddModal(true);
            }}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add Child</Text>
          </TouchableOpacity>
        </View>

        {kids.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No children added</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              Add your children to manage their schedules and payments
            </Text>
          </View>
        ) : (
          <FlatList
            data={kids}
            renderItem={renderKidCard}
            keyExtractor={(item) => item.student_id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadKids(); }} />
            }
          />
        )}
      </View>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => { setShowAddModal(false); resetForm(); }}
          />
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.gray300 }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {editingKid ? 'Edit Child' : 'Add Child'}
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="Child's name"
              placeholderTextColor={colors.textMuted}
              value={formName}
              onChangeText={setFormName}
            />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Age</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="Age"
                  placeholderTextColor={colors.textMuted}
                  value={formAge}
                  onChangeText={setFormAge}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Grade</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g., 5th Grade"
                  placeholderTextColor={colors.textMuted}
                  value={formGrade}
                  onChangeText={setFormGrade}
                />
              </View>
            </View>

            {/* Contact Information Section */}
            <View style={[styles.sectionDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Notification Contact (Optional)</Text>
            <View style={[styles.privacyNotice, { backgroundColor: colors.backgroundSecondary, borderColor: colors.primary }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
              <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                This contact info will strictly be used for upcoming session reminders only. We will never share this information.
              </Text>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="child@example.com"
              placeholderTextColor={colors.textMuted}
              value={formEmail}
              onChangeText={setFormEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor={colors.textMuted}
              value={formPhone}
              onChangeText={setFormPhone}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.autoSendRow}
              onPress={() => setFormNotifyUpcoming(!formNotifyUpcoming)}
            >
              <Ionicons
                name={formNotifyUpcoming ? 'checkbox' : 'square-outline'}
                size={24}
                color={formNotifyUpcoming ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.autoSendText, { color: colors.text }]}>
                Send session reminders to this contact
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.autoSendRow}
              onPress={() => setFormAutoSend(!formAutoSend)}
            >
              <Ionicons
                name={formAutoSend ? 'checkbox' : 'square-outline'}
                size={24}
                color={formAutoSend ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.autoSendText, { color: colors.text }]}>
                Auto-send quarterly schedules
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>{editingKid ? 'Update' : 'Add Child'}</Text>
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
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 20, fontWeight: '600' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  listContent: { padding: 16 },
  kidCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  kidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFFFFF', fontWeight: '600', fontSize: 20 },
  kidInfo: { flex: 1, marginLeft: 12 },
  kidName: { fontSize: 16, fontWeight: '600' },
  kidGrade: { fontSize: 13, marginTop: 2 },
  kidActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { padding: 8, borderRadius: 20 },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  emailText: { fontSize: 13, flex: 1 },
  sendLink: { fontSize: 13, fontWeight: '500' },
  viewSchedule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  viewScheduleText: { flex: 1, fontSize: 14, fontWeight: '500' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  bottomSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  sectionDivider: { height: 1, marginVertical: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    marginBottom: 16,
  },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18 },
  inputLabel: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  autoSendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 8,
  },
  autoSendText: { fontSize: 14 },
  saveButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
