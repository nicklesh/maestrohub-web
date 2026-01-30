import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, X, Loader, Clock, Save } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import api from '../services/api';
import { format, addDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import './TutorCalendarPage.css';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const TutorCalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [newSlot, setNewSlot] = useState({ date: '', start_time: '09:00', end_time: '10:00' });
  const [saving, setSaving] = useState(false);

  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    fetchSlots();
  }, [currentDate]);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 7), 'yyyy-MM-dd');
      const response = await api.get(`/tutor/slots?start_date=${startDate}&end_date=${endDate}`);
      setSlots(response.data.slots || []);
    } catch (err) {
      console.error('Error fetching slots:', err);
    } finally {
      setLoading(false);
    }
  };

  const navigateWeek = (direction) => {
    setCurrentDate(addDays(currentDate, direction * 7));
  };

  const getSlotsForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return slots.filter(slot => slot.date === dayStr);
  };

  const openAddModal = (day) => {
    setNewSlot({
      date: format(day, 'yyyy-MM-dd'),
      start_time: '09:00',
      end_time: '10:00',
    });
    setShowModal(true);
  };

  const saveSlot = async () => {
    if (!newSlot.date || !newSlot.start_time || !newSlot.end_time) {
      showError(t('forms.validation.fill_all_fields'));
      return;
    }

    try {
      setSaving(true);
      await api.post('/tutor/slots', newSlot);
      showSuccess(t('messages.success.created'));
      setShowModal(false);
      fetchSlots();
    } catch (err) {
      showError(err.response?.data?.detail || t('messages.errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const deleteSlot = async (slotId) => {
    if (!window.confirm(t('messages.confirm.delete'))) return;

    try {
      await api.delete(`/tutor/slots/${slotId}`);
      showSuccess(t('messages.success.deleted'));
      fetchSlots();
    } catch (err) {
      showError(t('messages.errors.generic'));
    }
  };

  return (
    <div className="calendar-page" style={{ backgroundColor: colors.background }}>
      <header className="calendar-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <button className="back-btn" onClick={() => navigate('/tutor/dashboard')} style={{ color: colors.text }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ color: colors.text }}>{t('navigation.calendar')}</h1>
          <button 
            className="add-slot-btn" 
            onClick={() => openAddModal(new Date())}
            style={{ backgroundColor: colors.primary }}
          >
            <Plus size={20} color="#fff" />
          </button>
        </div>
      </header>

      {/* Week Navigation */}
      <div className="week-nav" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <button onClick={() => navigateWeek(-1)} style={{ color: colors.text }}>
          <ChevronLeft size={24} />
        </button>
        <span style={{ color: colors.text }}>
          {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
        </span>
        <button onClick={() => navigateWeek(1)} style={{ color: colors.text }}>
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Calendar Grid */}
      <main className="calendar-main">
        {loading ? (
          <div className="loading-state">
            <Loader className="spinner" size={32} color={colors.primary} />
          </div>
        ) : (
          <div className="calendar-grid">
            {/* Day Headers */}
            <div className="day-headers">
              {weekDays.map((day) => (
                <div 
                  key={day.toISOString()} 
                  className={`day-header ${isSameDay(day, new Date()) ? 'today' : ''}`}
                  style={{ 
                    backgroundColor: isSameDay(day, new Date()) ? colors.primaryLight : 'transparent',
                    color: colors.text
                  }}
                >
                  <span className="day-name">{format(day, 'EEE')}</span>
                  <span className="day-number" style={{ color: isSameDay(day, new Date()) ? colors.primary : colors.text }}>
                    {format(day, 'd')}
                  </span>
                </div>
              ))}
            </div>

            {/* Time Slots */}
            <div className="days-container">
              {weekDays.map((day) => {
                const daySlots = getSlotsForDay(day);
                return (
                  <div key={day.toISOString()} className="day-column" style={{ borderColor: colors.border }}>
                    {daySlots.length === 0 ? (
                      <button 
                        className="add-slot-empty"
                        onClick={() => openAddModal(day)}
                        style={{ color: colors.textMuted }}
                      >
                        <Plus size={16} />
                        Add
                      </button>
                    ) : (
                      daySlots.map((slot) => (
                        <div 
                          key={slot.slot_id}
                          className={`slot-item ${slot.is_booked ? 'booked' : ''}`}
                          style={{ 
                            backgroundColor: slot.is_booked ? colors.successLight : colors.primaryLight,
                            borderColor: slot.is_booked ? colors.success : colors.primary,
                          }}
                        >
                          <span className="slot-time" style={{ color: slot.is_booked ? colors.success : colors.primary }}>
                            {slot.start_time} - {slot.end_time}
                          </span>
                          {slot.is_booked ? (
                            <span className="slot-status" style={{ color: colors.success }}>Booked</span>
                          ) : (
                            <button 
                              className="delete-slot-btn" 
                              onClick={() => deleteSlot(slot.slot_id)}
                              style={{ color: colors.error }}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Add Slot Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div 
            className="modal" 
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 style={{ color: colors.text }}>Add Availability</h2>
              <button onClick={() => setShowModal(false)}>
                <X size={24} color={colors.text} />
              </button>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label style={{ color: colors.text }}>Date</label>
                <input
                  type="date"
                  value={newSlot.date}
                  onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label style={{ color: colors.text }}>Start Time</label>
                  <input
                    type="time"
                    value={newSlot.start_time}
                    onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                    style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: colors.text }}>End Time</label>
                  <input
                    type="time"
                    value={newSlot.end_time}
                    onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                    style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={() => setShowModal(false)}
                style={{ color: colors.text, borderColor: colors.border }}
              >
                {t('buttons.cancel')}
              </button>
              <button 
                className="save-btn"
                onClick={saveSlot}
                disabled={saving}
                style={{ backgroundColor: colors.primary }}
              >
                {saving ? <Loader className="spinner" size={18} /> : <Save size={18} />}
                {t('buttons.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorCalendarPage;
