import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Switch,
  Platform,
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

interface AvailabilityRule {
  rule_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface VacationPeriod {
  vacation_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

// Days and months will be localized using the translation function
const TIME_SLOTS = Array.from({ length: 14 }, (_, i) => {
  const hour = i + 7; // 7 AM to 8 PM
  return `${hour.toString().padStart(2, '0')}:00`;
});

export default function CalendarScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const router = useRouter();
  
  // Localized days and months
  const DAYS_OF_WEEK = [
    t('calendar.days_short.sun') || 'Sun',
    t('calendar.days_short.mon') || 'Mon',
    t('calendar.days_short.tue') || 'Tue',
    t('calendar.days_short.wed') || 'Wed',
    t('calendar.days_short.thu') || 'Thu',
    t('calendar.days_short.fri') || 'Fri',
    t('calendar.days_short.sat') || 'Sat'
  ];
  
  const MONTHS = [
    t('calendar.months.january') || 'January',
    t('calendar.months.february') || 'February',
    t('calendar.months.march') || 'March',
    t('calendar.months.april') || 'April',
    t('calendar.months.may') || 'May',
    t('calendar.months.june') || 'June',
    t('calendar.months.july') || 'July',
    t('calendar.months.august') || 'August',
    t('calendar.months.september') || 'September',
    t('calendar.months.october') || 'October',
    t('calendar.months.november') || 'November',
    t('calendar.months.december') || 'December'
  ];
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [vacations, setVacations] = useState<VacationPeriod[]>([]);
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  
  // Modal states
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [vacationStartDate, setVacationStartDate] = useState<Date | null>(null);
  const [vacationEndDate, setVacationEndDate] = useState<Date | null>(null);
  const [isSelectingVacation, setIsSelectingVacation] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [rulesRes, vacationsRes] = await Promise.all([
        api.get('/availability/rules', { headers: { Authorization: `Bearer ${token}` } }),
        api.get('/availability/vacations', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
      ]);
      
      setRules(rulesRes.data || []);
      setVacations(vacationsRes.data || []);
      
      // Initialize selected slots from rules
      const slots = new Set<string>();
      (rulesRes.data || []).forEach((rule: AvailabilityRule) => {
        const startHour = parseInt(rule.start_time.split(':')[0]);
        const endHour = parseInt(rule.end_time.split(':')[0]);
        for (let h = startHour; h < endHour; h++) {
          slots.add(`${rule.day_of_week}-${h.toString().padStart(2, '0')}:00`);
        }
      });
      setSelectedSlots(slots);
    } catch (error) {
      console.error('Failed to load availability:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate);

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isDateInVacation = (date: Date) => {
    return vacations.some(v => {
      const start = new Date(v.start_date);
      const end = new Date(v.end_date);
      return date >= start && date <= end;
    });
  };

  const hasAvailabilityOnDay = (dayOfWeek: number) => {
    return rules.some(r => r.day_of_week === dayOfWeek);
  };

  const handleDatePress = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    
    if (isSelectingVacation) {
      if (!vacationStartDate) {
        setVacationStartDate(date);
      } else if (!vacationEndDate) {
        if (date < vacationStartDate) {
          setVacationEndDate(vacationStartDate);
          setVacationStartDate(date);
        } else {
          setVacationEndDate(date);
        }
        setShowVacationModal(true);
      }
    } else {
      setSelectedDate(date);
      setShowTimeModal(true);
    }
  };

  const toggleTimeSlot = (time: string) => {
    if (!selectedDate) return;
    const dayOfWeek = selectedDate.getDay();
    const key = `${dayOfWeek}-${time}`;
    const newSlots = new Set(selectedSlots);
    
    if (newSlots.has(key)) {
      newSlots.delete(key);
    } else {
      newSlots.add(key);
    }
    setSelectedSlots(newSlots);
  };

  const selectAllSlots = () => {
    if (!selectedDate) return;
    const dayOfWeek = selectedDate.getDay();
    const newSlots = new Set(selectedSlots);
    TIME_SLOTS.forEach(time => {
      newSlots.add(`${dayOfWeek}-${time}`);
    });
    setSelectedSlots(newSlots);
  };

  const deselectAllSlots = () => {
    if (!selectedDate) return;
    const dayOfWeek = selectedDate.getDay();
    const newSlots = new Set(selectedSlots);
    TIME_SLOTS.forEach(time => {
      newSlots.delete(`${dayOfWeek}-${time}`);
    });
    setSelectedSlots(newSlots);
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      showInfo(`${title}: ${message}`);
    } else {
      showInfo(message, title);
    }
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      // Convert selected slots to rules grouped by day
      const daySlots: Record<number, string[]> = {};
      selectedSlots.forEach((slot) => {
        const [day, time] = slot.split('-');
        const dayNum = parseInt(day);
        if (!daySlots[dayNum]) daySlots[dayNum] = [];
        daySlots[dayNum].push(time);
      });

      const newRules: any[] = [];
      Object.entries(daySlots).forEach(([day, times]) => {
        times.sort();
        if (times.length === 0) return;
        
        let startTime = times[0];
        let prevHour = parseInt(startTime.split(':')[0]);

        for (let i = 1; i <= times.length; i++) {
          const currentTime = times[i];
          const currentHour = currentTime ? parseInt(currentTime.split(':')[0]) : -1;

          if (currentHour !== prevHour + 1) {
            newRules.push({
              day_of_week: parseInt(day),
              start_time: startTime,
              end_time: `${(prevHour + 1).toString().padStart(2, '0')}:00`,
              timezone: 'America/New_York',
            });
            startTime = currentTime;
          }
          prevHour = currentHour;
        }
      });

      await api.post('/availability/rules/bulk', newRules, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      showSuccess('Availability saved successfully!');
      setShowTimeModal(false);
      loadData();
    } catch (error: any) {
      showError(error.response?.data?.detail || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const saveVacation = async () => {
    if (!vacationStartDate || !vacationEndDate) return;
    
    setSaving(true);
    try {
      await api.post('/availability/vacations', {
        start_date: vacationStartDate.toISOString().split('T')[0],
        end_date: vacationEndDate.toISOString().split('T')[0],
        reason: 'Vacation'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      showSuccess('Vacation period saved!');
      setShowVacationModal(false);
      setVacationStartDate(null);
      setVacationEndDate(null);
      setIsSelectingVacation(false);
      loadData();
    } catch (error: any) {
      showError(error.response?.data?.detail || 'Failed to save vacation');
    } finally {
      setSaving(false);
    }
  };

  const deleteVacation = async (vacationId: string) => {
    const confirmDelete = async () => {
      try {
        await api.delete(`/availability/vacations/${vacationId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        loadData();
      } catch (error) {
        showError('Failed to delete vacation');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to delete this vacation period?');
      if (confirmed) {
        await confirmDelete();
      }
    } else {
      showInfo('Are you sure you want to delete this vacation period?', 'Delete Vacation');
    }
  };

  const renderCalendarDay = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dayOfWeek = date.getDay();
    const isToday = new Date().toDateString() === date.toDateString();
    const isVacation = isDateInVacation(date);
    const hasAvailability = hasAvailabilityOnDay(dayOfWeek);
    const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
    const isVacationStart = vacationStartDate?.toDateString() === date.toDateString();
    const isVacationEnd = vacationEndDate?.toDateString() === date.toDateString();
    const isSelected = selectedDate?.toDateString() === date.toDateString();

    return (
      <TouchableOpacity
        key={day}
        style={[
          styles.dayCell,
          { backgroundColor: colors.surface, borderColor: colors.border },
          isToday && { borderColor: colors.primary, borderWidth: 2 },
          isVacation && { backgroundColor: colors.errorLight },
          (isVacationStart || isVacationEnd) && { backgroundColor: colors.primaryLight },
          isSelected && { backgroundColor: colors.primary },
          isPast && { opacity: 0.5 }
        ]}
        onPress={() => !isPast && handleDatePress(day)}
        disabled={isPast}
      >
        <Text style={[
          styles.dayNumber,
          { color: colors.text },
          isToday && { color: colors.primary, fontWeight: '700' },
          isVacation && { color: colors.error },
          isSelected && { color: '#FFFFFF', fontWeight: '700' }
        ]}>
          {day}
        </Text>
        {hasAvailability && !isVacation && !isSelected && (
          <View style={[styles.availabilityDot, { backgroundColor: colors.success }]} />
        )}
        {isVacation && (
          <Ionicons name="airplane" size={10} color={colors.error} />
        )}
        {isSelected && hasAvailability && (
          <View style={[styles.availabilityDot, { backgroundColor: '#FFFFFF' }]} />
        )}
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

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Month Header */}
        <View style={[styles.monthHeader, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.monthNav}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: colors.text }]}>
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.monthNav}>
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Day Headers */}
        <View style={styles.weekHeader}>
          {DAYS_OF_WEEK.map((day) => (
            <View key={day} style={styles.weekDayCell}>
              <Text style={[styles.weekDayText, { color: colors.textMuted }]}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={[styles.calendarGrid, { backgroundColor: colors.surface }]}>
          {/* Empty cells before first day */}
          {Array.from({ length: startingDay }, (_, i) => (
            <View key={`empty-${i}`} style={[styles.dayCell, styles.emptyDayCell, { borderColor: colors.border }]} />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }, (_, i) => renderCalendarDay(i + 1))}
        </View>

        {/* Legend */}
        <View style={[styles.legend, { backgroundColor: colors.surface }]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <Ionicons name="airplane" size={14} color={colors.error} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Vacation</Text>
          </View>
        </View>

        {/* Vacation Mode Toggle */}
        <View style={[styles.vacationSection, { backgroundColor: colors.surface }]}>
          <View style={styles.vacationHeader}>
            <Ionicons name="airplane" size={22} color={colors.primary} />
            <Text style={[styles.vacationTitle, { color: colors.text }]}>Vacation Mode</Text>
          </View>
          
          <TouchableOpacity
            style={[
              styles.vacationToggle,
              { backgroundColor: isSelectingVacation ? colors.primary : colors.background, borderColor: colors.border }
            ]}
            onPress={() => {
              setIsSelectingVacation(!isSelectingVacation);
              setVacationStartDate(null);
              setVacationEndDate(null);
            }}
          >
            <Text style={[
              styles.vacationToggleText,
              { color: isSelectingVacation ? '#FFFFFF' : colors.text }
            ]}>
              {isSelectingVacation ? 'Cancel Selection' : 'Set Vacation Days'}
            </Text>
          </TouchableOpacity>

          {isSelectingVacation && (
            <Text style={[styles.vacationHint, { color: colors.textMuted }]}>
              Tap start date, then end date on the calendar
            </Text>
          )}

          {/* Existing Vacations */}
          {vacations.length > 0 && (
            <View style={styles.existingVacations}>
              <Text style={[styles.existingTitle, { color: colors.textMuted }]}>Scheduled Vacations</Text>
              {vacations.map((v) => (
                <View key={v.vacation_id} style={[styles.vacationItem, { borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.vacationDates, { color: colors.text }]}>
                      {new Date(v.start_date).toLocaleDateString()} - {new Date(v.end_date).toLocaleDateString()}
                    </Text>
                    {v.reason && (
                      <Text style={[styles.vacationReason, { color: colors.textMuted }]}>{v.reason}</Text>
                    )}
                  </View>
                  <TouchableOpacity 
                    style={styles.deleteVacationBtn}
                    onPress={() => deleteVacation(v.vacation_id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={[styles.quickActions, { backgroundColor: colors.surface }]}>
          <Text style={[styles.quickActionsTitle, { color: colors.text }]}>Quick Actions</Text>
          <Text style={[styles.quickActionsHint, { color: colors.textMuted }]}>
            Tap any date on the calendar to set your available time slots for that day of the week.
          </Text>
          
          {/* Schedule Builder Button */}
          <TouchableOpacity
            style={[styles.scheduleBuilderBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(tutor)/schedule-builder')}
          >
            <Ionicons name="calendar-outline" size={20} color="#FFFFFF" />
            <Text style={styles.scheduleBuilderBtnText}>Set Recurring Schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Time Slot Modal */}
      <Modal visible={showTimeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Set Availability for {selectedDate ? DAYS_OF_WEEK[selectedDate.getDay()] : ''}s
              </Text>
              <TouchableOpacity onPress={() => setShowTimeModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              This will apply to every {selectedDate ? DAYS_OF_WEEK[selectedDate.getDay()] : ''}
            </Text>

            {/* Select/Deselect All */}
            <View style={styles.selectAllRow}>
              <TouchableOpacity
                style={[styles.selectAllBtn, { backgroundColor: colors.primaryLight }]}
                onPress={selectAllSlots}
              >
                <Text style={[styles.selectAllText, { color: colors.primary }]}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.selectAllBtn, { backgroundColor: colors.gray100 }]}
                onPress={deselectAllSlots}
              >
                <Text style={[styles.selectAllText, { color: colors.text }]}>Deselect All</Text>
              </TouchableOpacity>
            </View>

            {/* Time Slots Grid */}
            <ScrollView style={styles.timeSlotsScroll}>
              <View style={styles.timeSlotsGrid}>
                {TIME_SLOTS.map((time) => {
                  const dayOfWeek = selectedDate?.getDay() || 0;
                  const key = `${dayOfWeek}-${time}`;
                  const isSelected = selectedSlots.has(key);
                  const hour = parseInt(time.split(':')[0]);
                  const displayTime = hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? '12:00 PM' : `${hour}:00 AM`;

                  return (
                    <TouchableOpacity
                      key={time}
                      style={[
                        styles.timeSlot,
                        { backgroundColor: colors.background, borderColor: colors.border },
                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
                      ]}
                      onPress={() => toggleTimeSlot(time)}
                    >
                      <Text style={[
                        styles.timeSlotText,
                        { color: colors.text },
                        isSelected && { color: '#FFFFFF' }
                      ]}>
                        {displayTime}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.saveButtonDisabled]}
              onPress={saveAvailability}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Availability</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Vacation Confirm Modal */}
      <Modal visible={showVacationModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.vacationModalContent, { backgroundColor: colors.surface }]}>
            <Ionicons name="airplane" size={48} color={colors.primary} />
            <Text style={[styles.vacationModalTitle, { color: colors.text }]}>Confirm Vacation</Text>
            <Text style={[styles.vacationModalDates, { color: colors.textMuted }]}>
              {vacationStartDate?.toLocaleDateString()} - {vacationEndDate?.toLocaleDateString()}
            </Text>
            <Text style={[styles.vacationModalHint, { color: colors.textMuted }]}>
              You won't receive any bookings during this period.
            </Text>

            <View style={styles.vacationModalButtons}>
              <TouchableOpacity
                style={[styles.vacationModalBtn, { backgroundColor: colors.gray100 }]}
                onPress={() => {
                  setShowVacationModal(false);
                  setVacationStartDate(null);
                  setVacationEndDate(null);
                }}
              >
                <Text style={[styles.vacationModalBtnText, { color: colors.text }]}>{t('buttons.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.vacationModalBtn, { backgroundColor: colors.primary }]}
                onPress={saveVacation}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={[styles.vacationModalBtnText, { color: '#FFFFFF' }]}>{t('buttons.confirm')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  monthNav: { padding: 8 },
  monthTitle: { fontSize: 18, fontWeight: '700' },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekDayText: { fontSize: 12, fontWeight: '600' },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 12,
    padding: 4,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  dayCellInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  dayNumber: { fontSize: 14, fontWeight: '500' },
  emptyDayCell: {
    backgroundColor: 'transparent',
  },
  availabilityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: { fontSize: 12 },
  vacationSection: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  vacationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  vacationTitle: { fontSize: 16, fontWeight: '600' },
  vacationToggle: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  vacationToggleText: { fontSize: 14, fontWeight: '500' },
  vacationHint: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  existingVacations: { marginTop: 16 },
  existingTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  vacationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  vacationDates: { fontSize: 14, fontWeight: '500' },
  vacationReason: { fontSize: 12, marginTop: 2 },
  deleteVacationBtn: {
    padding: 10,
    marginLeft: 8,
  },
  quickActions: {
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  quickActionsTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  quickActionsHint: { fontSize: 13, lineHeight: 18 },
  scheduleBuilderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 10,
    marginTop: 16,
  },
  scheduleBuilderBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalSubtitle: { fontSize: 13, marginBottom: 16 },
  selectAllRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  selectAllBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectAllText: { fontSize: 13, fontWeight: '500' },
  timeSlotsScroll: { maxHeight: 300 },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100,
    alignItems: 'center',
  },
  timeSlotText: { fontSize: 14, fontWeight: '500' },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  vacationModalContent: {
    margin: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  vacationModalTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  vacationModalDates: { fontSize: 15, marginTop: 8 },
  vacationModalHint: { fontSize: 13, textAlign: 'center', marginTop: 8 },
  vacationModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  vacationModalBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  vacationModalBtnText: { fontSize: 15, fontWeight: '600' },
});
