import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface WeeklySchedule {
  day: number; // 0-6 (Sun-Sat)
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface ScheduleConfig {
  schedule_id?: string;
  weeklySchedule: WeeklySchedule[];
  duration: 'month' | 'quarter' | 'year' | 'custom';
  customMonths?: number;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  reminderDays: number; // Days before expiry to remind
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 6; // 6 AM to 7 PM
  const min = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
});

const DEFAULT_SCHEDULE: WeeklySchedule[] = DAYS_OF_WEEK.map((_, i) => ({
  day: i,
  enabled: i >= 1 && i <= 5, // Mon-Fri enabled by default
  startTime: '09:00',
  endTime: '17:00',
}));

export default function ScheduleBuilderScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'weekly' | 'specific' | 'vacation'>('weekly');
  
  // Weekly schedule state
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule[]>(DEFAULT_SCHEDULE);
  const [duration, setDuration] = useState<'month' | 'quarter' | 'year' | 'custom'>('quarter');
  const [customMonths, setCustomMonths] = useState(6);
  const [autoRenew, setAutoRenew] = useState(true);
  const [reminderDays, setReminderDays] = useState(14);
  const [existingSchedule, setExistingSchedule] = useState<any>(null);
  
  // Modal states
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  
  const isTablet = width >= 768;
  const styles = getStyles(colors);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      const res = await api.get('/tutors/schedule', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.weeklySchedule) {
        setExistingSchedule(res.data);
        setWeeklySchedule(res.data.weeklySchedule);
        setDuration(res.data.duration || 'quarter');
        setAutoRenew(res.data.autoRenew ?? true);
        setReminderDays(res.data.reminderDays || 14);
        if (res.data.customMonths) setCustomMonths(res.data.customMonths);
      }
    } catch (error) {
      // No existing schedule - use defaults
      console.log('No existing schedule');
    } finally {
      setLoading(false);
    }
  };

  const calculateEndDate = () => {
    const start = new Date();
    let months = 3; // default quarter
    switch (duration) {
      case 'month': months = 1; break;
      case 'quarter': months = 3; break;
      case 'year': months = 12; break;
      case 'custom': months = customMonths; break;
    }
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);
    return end.toISOString().split('T')[0];
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const scheduleData = {
        weeklySchedule,
        duration,
        customMonths: duration === 'custom' ? customMonths : undefined,
        startDate: new Date().toISOString().split('T')[0],
        endDate: calculateEndDate(),
        autoRenew,
        reminderDays,
      };

      await api.post('/tutors/schedule', scheduleData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showAlert('Success', 'Your schedule has been saved!');
      setExistingSchedule(scheduleData);
    } catch (error: any) {
      showAlert('Error', error.response?.data?.detail || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (dayIndex: number) => {
    setWeeklySchedule(prev => 
      prev.map((day, i) => 
        i === dayIndex ? { ...day, enabled: !day.enabled } : day
      )
    );
  };

  const updateDayTime = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setWeeklySchedule(prev =>
      prev.map((day, i) =>
        i === dayIndex ? { ...day, [field]: value } : day
      )
    );
  };

  const applyToAllDays = (startTime: string, endTime: string) => {
    setWeeklySchedule(prev =>
      prev.map(day => day.enabled ? { ...day, startTime, endTime } : day)
    );
  };

  const getDurationLabel = () => {
    switch (duration) {
      case 'month': return '1 Month';
      case 'quarter': return '3 Months (Quarter)';
      case 'year': return '1 Year';
      case 'custom': return `${customMonths} Months`;
    }
  };

  const renderWeeklySchedule = () => (
    <View style={styles.scheduleContainer}>
      {/* Duration Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Schedule Duration</Text>
        <TouchableOpacity 
          style={styles.durationSelector}
          onPress={() => setShowDurationModal(true)}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text style={styles.durationText}>{getDurationLabel()}</Text>
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </TouchableOpacity>
        
        <Text style={styles.durationHint}>
          Schedule active until: {calculateEndDate()}
        </Text>
      </View>

      {/* Auto Renewal */}
      <View style={styles.section}>
        <View style={styles.autoRenewRow}>
          <View style={styles.autoRenewInfo}>
            <Text style={styles.sectionTitle}>Auto-Renewal</Text>
            <Text style={styles.autoRenewHint}>
              Automatically renew when schedule expires
            </Text>
          </View>
          <Switch
            value={autoRenew}
            onValueChange={setAutoRenew}
            trackColor={{ false: colors.gray300, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
        
        {autoRenew && (
          <View style={styles.reminderRow}>
            <Text style={styles.reminderLabel}>Reminder before expiry:</Text>
            <View style={styles.reminderOptions}>
              {[7, 14, 30].map(days => (
                <TouchableOpacity
                  key={days}
                  style={[
                    styles.reminderChip,
                    reminderDays === days && styles.reminderChipActive
                  ]}
                  onPress={() => setReminderDays(days)}
                >
                  <Text style={[
                    styles.reminderChipText,
                    reminderDays === days && styles.reminderChipTextActive
                  ]}>
                    {days} days
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Weekly Hours */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Weekly Hours</Text>
          <TouchableOpacity 
            style={styles.applyAllBtn}
            onPress={() => {
              const enabledDay = weeklySchedule.find(d => d.enabled);
              if (enabledDay) {
                applyToAllDays(enabledDay.startTime, enabledDay.endTime);
              }
            }}
          >
            <Text style={styles.applyAllText}>Apply to all days</Text>
          </TouchableOpacity>
        </View>

        {weeklySchedule.map((day, index) => (
          <View key={index} style={styles.dayRow}>
            <TouchableOpacity 
              style={styles.dayToggle}
              onPress={() => toggleDay(index)}
            >
              <View style={[
                styles.checkbox,
                day.enabled && styles.checkboxActive
              ]}>
                {day.enabled && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              <Text style={[styles.dayName, !day.enabled && styles.dayNameDisabled]}>
                {DAYS_OF_WEEK[index]}
              </Text>
            </TouchableOpacity>

            {day.enabled && (
              <View style={styles.timeSelectors}>
                <TouchableOpacity 
                  style={styles.timeSelector}
                  onPress={() => setEditingDay(index)}
                >
                  <Text style={styles.timeText}>{day.startTime}</Text>
                </TouchableOpacity>
                <Text style={styles.timeSeparator}>to</Text>
                <TouchableOpacity 
                  style={styles.timeSelector}
                  onPress={() => setEditingDay(index)}
                >
                  <Text style={styles.timeText}>{day.endTime}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Save Button */}
      <TouchableOpacity 
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveSchedule}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="save" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Save Schedule</Text>
          </>
        )}
      </TouchableOpacity>

      {existingSchedule && (
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            {autoRenew 
              ? `Your schedule will auto-renew on ${calculateEndDate()}. You'll receive a reminder ${reminderDays} days before.`
              : `Your schedule expires on ${calculateEndDate()}. Enable auto-renewal to continue.`
            }
          </Text>
        </View>
      )}
    </View>
  );

  // Duration Modal
  const renderDurationModal = () => (
    <Modal
      visible={showDurationModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowDurationModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <Text style={styles.modalTitle}>Select Duration</Text>
          
          {(['month', 'quarter', 'year', 'custom'] as const).map(d => (
            <TouchableOpacity
              key={d}
              style={[
                styles.durationOption,
                duration === d && styles.durationOptionActive
              ]}
              onPress={() => {
                setDuration(d);
                if (d !== 'custom') setShowDurationModal(false);
              }}
            >
              <Text style={[
                styles.durationOptionText,
                duration === d && styles.durationOptionTextActive
              ]}>
                {d === 'month' ? '1 Month' :
                 d === 'quarter' ? '3 Months (Quarter)' :
                 d === 'year' ? '1 Year' : 'Custom'}
              </Text>
              {duration === d && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}

          {duration === 'custom' && (
            <View style={styles.customMonthsRow}>
              <Text style={styles.customMonthsLabel}>Number of months:</Text>
              <View style={styles.customMonthsSelector}>
                <TouchableOpacity 
                  style={styles.monthBtn}
                  onPress={() => setCustomMonths(Math.max(1, customMonths - 1))}
                >
                  <Ionicons name="remove" size={20} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.monthValue}>{customMonths}</Text>
                <TouchableOpacity 
                  style={styles.monthBtn}
                  onPress={() => setCustomMonths(Math.min(24, customMonths + 1))}
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setShowDurationModal(false)}
          >
            <Text style={styles.modalCloseBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Time Editor Modal
  const renderTimeModal = () => (
    <Modal
      visible={editingDay !== null}
      transparent
      animationType="slide"
      onRequestClose={() => setEditingDay(null)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          {editingDay !== null && (
            <>
              <Text style={styles.modalTitle}>
                {DAYS_OF_WEEK[editingDay]} Hours
              </Text>
              
              <View style={styles.timeEditSection}>
                <Text style={styles.timeEditLabel}>Start Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.timeOptionsRow}>
                    {TIME_OPTIONS.map(time => (
                      <TouchableOpacity
                        key={`start-${time}`}
                        style={[
                          styles.timeOption,
                          weeklySchedule[editingDay].startTime === time && styles.timeOptionActive
                        ]}
                        onPress={() => updateDayTime(editingDay, 'startTime', time)}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          weeklySchedule[editingDay].startTime === time && styles.timeOptionTextActive
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.timeEditSection}>
                <Text style={styles.timeEditLabel}>End Time</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.timeOptionsRow}>
                    {TIME_OPTIONS.map(time => (
                      <TouchableOpacity
                        key={`end-${time}`}
                        style={[
                          styles.timeOption,
                          weeklySchedule[editingDay].endTime === time && styles.timeOptionActive
                        ]}
                        onPress={() => updateDayTime(editingDay, 'endTime', time)}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          weeklySchedule[editingDay].endTime === time && styles.timeOptionTextActive
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setEditingDay(null)}
              >
                <Text style={styles.modalCloseBtnText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title="Schedule Builder" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Schedule Builder" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderWeeklySchedule()}
      </ScrollView>
      {renderDurationModal()}
      {renderTimeModal()}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  scheduleContainer: { gap: 20 },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  applyAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
  },
  applyAllText: { fontSize: 12, fontWeight: '500', color: colors.primary },
  durationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
  durationHint: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  autoRenewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoRenewInfo: { flex: 1 },
  autoRenewHint: { fontSize: 13, color: colors.textMuted },
  reminderRow: { marginTop: 16 },
  reminderLabel: { fontSize: 14, color: colors.text, marginBottom: 8 },
  reminderOptions: { flexDirection: 'row', gap: 8 },
  reminderChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.gray200,
  },
  reminderChipActive: { backgroundColor: colors.primary },
  reminderChipText: { fontSize: 13, fontWeight: '500', color: colors.text },
  reminderChipTextActive: { color: '#fff' },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayToggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayName: { fontSize: 15, fontWeight: '500', color: colors.text, width: 90 },
  dayNameDisabled: { color: colors.textMuted },
  timeSelectors: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeSelector: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeText: { fontSize: 14, fontWeight: '500', color: colors.text },
  timeSeparator: { fontSize: 13, color: colors.textMuted },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.primaryLight,
    padding: 14,
    borderRadius: 12,
  },
  infoText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  durationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  durationOptionActive: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  durationOptionText: { fontSize: 15, color: colors.text },
  durationOptionTextActive: { fontWeight: '600', color: colors.primary },
  customMonthsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginTop: 8,
  },
  customMonthsLabel: { fontSize: 14, color: colors.text },
  customMonthsSelector: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthValue: { fontSize: 18, fontWeight: '600', color: colors.text, minWidth: 30, textAlign: 'center' },
  modalCloseBtn: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  timeEditSection: { marginBottom: 20 },
  timeEditLabel: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 10 },
  timeOptionsRow: { flexDirection: 'row', gap: 8 },
  timeOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  timeOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeOptionText: { fontSize: 14, color: colors.text },
  timeOptionTextActive: { color: '#fff', fontWeight: '600' },
});
