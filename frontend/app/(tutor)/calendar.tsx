import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { colors } from '@/src/theme/colors';
import { format, addDays, parseISO, isToday, isTomorrow, startOfWeek } from 'date-fns';

interface AvailabilityRule {
  rule_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Booking {
  booking_id: string;
  student_name: string;
  start_at: string;
  end_at: string;
  status: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = Array.from({ length: 13 }, (_, i) => `${(i + 8).toString().padStart(2, '0')}:00`);

export default function CalendarScreen() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rulesRes, bookingsRes] = await Promise.all([
        api.get('/availability/rules'),
        api.get('/bookings?role=tutor'),
      ]);
      setRules(rulesRes.data);
      setBookings(bookingsRes.data);

      // Initialize selected slots from rules
      const slots = new Set<string>();
      rulesRes.data.forEach((rule: AvailabilityRule) => {
        const startHour = parseInt(rule.start_time.split(':')[0]);
        const endHour = parseInt(rule.end_time.split(':')[0]);
        for (let h = startHour; h < endHour; h++) {
          slots.add(`${rule.day_of_week}-${h.toString().padStart(2, '0')}:00`);
        }
      });
      setSelectedSlots(slots);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSlot = (day: number, time: string) => {
    const key = `${day}-${time}`;
    const newSlots = new Set(selectedSlots);
    if (newSlots.has(key)) {
      newSlots.delete(key);
    } else {
      newSlots.add(key);
    }
    setSelectedSlots(newSlots);
  };

  const saveAvailability = async () => {
    setSaving(true);
    try {
      // Convert selected slots to rules
      const daySlots: Record<number, string[]> = {};
      selectedSlots.forEach((slot) => {
        const [day, time] = slot.split('-');
        const dayNum = parseInt(day);
        if (!daySlots[dayNum]) daySlots[dayNum] = [];
        daySlots[dayNum].push(time);
      });

      const newRules: AvailabilityRule[] = [];
      Object.entries(daySlots).forEach(([day, times]) => {
        times.sort();
        let startTime = times[0];
        let prevHour = parseInt(startTime.split(':')[0]);

        for (let i = 1; i <= times.length; i++) {
          const currentTime = times[i];
          const currentHour = currentTime ? parseInt(currentTime.split(':')[0]) : -1;

          if (currentHour !== prevHour + 1) {
            // End of continuous block
            newRules.push({
              rule_id: '',
              day_of_week: parseInt(day),
              start_time: startTime,
              end_time: `${(prevHour + 1).toString().padStart(2, '0')}:00`,
              timezone: 'America/New_York',
            } as any);
            startTime = currentTime;
          }
          prevHour = currentHour;
        }
      });

      await api.post('/availability/rules/bulk', newRules);
      Alert.alert('Success', 'Availability updated!');
      setEditMode(false);
      loadData();
    } catch (error) {
      console.error('Failed to save:', error);
      Alert.alert('Error', 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const getBookingsForDay = (dayOffset: number) => {
    const targetDate = addDays(new Date(), dayOffset);
    return bookings.filter((b) => {
      const bookingDate = parseISO(b.start_at);
      return (
        bookingDate.getDate() === targetDate.getDate() &&
        bookingDate.getMonth() === targetDate.getMonth()
      );
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Availability</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => (editMode ? saveAvailability() : setEditMode(true))}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.editButtonText}>{editMode ? 'Save' : 'Edit'}</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Week View */}
        <View style={styles.weekView}>
          {DAYS.map((day, index) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayTab,
                selectedDay === index && styles.dayTabActive,
              ]}
              onPress={() => setSelectedDay(index)}
            >
              <Text
                style={[
                  styles.dayTabText,
                  selectedDay === index && styles.dayTabTextActive,
                ]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Time Grid */}
        {editMode ? (
          <View style={styles.timeGrid}>
            <Text style={styles.gridTitle}>Set availability for {DAYS[selectedDay]}</Text>
            <View style={styles.slotsGrid}>
              {TIME_SLOTS.map((time) => {
                const key = `${selectedDay}-${time}`;
                const isSelected = selectedSlots.has(key);
                return (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.slotButton,
                      isSelected && styles.slotButtonSelected,
                    ]}
                    onPress={() => toggleSlot(selectedDay, time)}
                  >
                    <Text
                      style={[
                        styles.slotText,
                        isSelected && styles.slotTextSelected,
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.scheduleView}>
            <Text style={styles.gridTitle}>{DAYS[selectedDay]}'s Schedule</Text>
            
            {/* Show availability */}
            <View style={styles.availabilitySection}>
              <Text style={styles.sectionLabel}>Available Times</Text>
              {rules.filter((r) => r.day_of_week === selectedDay).length === 0 ? (
                <Text style={styles.emptyText}>No availability set</Text>
              ) : (
                rules
                  .filter((r) => r.day_of_week === selectedDay)
                  .map((rule) => (
                    <View key={rule.rule_id} style={styles.availabilityItem}>
                      <Ionicons name="time-outline" size={18} color={colors.success} />
                      <Text style={styles.availabilityText}>
                        {rule.start_time} - {rule.end_time}
                      </Text>
                    </View>
                  ))
              )}
            </View>

            {/* Show bookings for next 7 days of this weekday */}
            <View style={styles.bookingsSection}>
              <Text style={styles.sectionLabel}>Upcoming Bookings</Text>
              {getBookingsForDay(selectedDay).length === 0 ? (
                <Text style={styles.emptyText}>No bookings</Text>
              ) : (
                getBookingsForDay(selectedDay).map((booking) => (
                  <View key={booking.booking_id} style={styles.bookingItem}>
                    <View style={styles.bookingDot} />
                    <View style={styles.bookingInfo}>
                      <Text style={styles.bookingTime}>
                        {format(parseISO(booking.start_at), 'h:mm a')} -{' '}
                        {format(parseISO(booking.end_at), 'h:mm a')}
                      </Text>
                      <Text style={styles.bookingStudent}>{booking.student_name}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {editMode && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setEditMode(false);
              loadData();
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
  },
  editButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  weekView: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 20,
  },
  dayTab: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  dayTabTextActive: {
    color: '#fff',
  },
  timeGrid: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.gray100,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  slotButtonSelected: {
    backgroundColor: colors.primary,
  },
  slotText: {
    fontSize: 14,
    color: colors.text,
  },
  slotTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  scheduleView: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  availabilitySection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  availabilityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  availabilityText: {
    fontSize: 15,
    color: colors.text,
  },
  bookingsSection: {},
  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bookingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 12,
  },
  bookingInfo: {},
  bookingTime: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  bookingStudent: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 16,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: colors.textMuted,
  },
});
