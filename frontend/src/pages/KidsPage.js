import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Plus, Edit2, Trash2, Loader, User, Calendar, Save, X, Mail, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../i18n';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import api from '../services/api';
import './KidsPage.css';

const KidsPage = () => {
  const [kids, setKids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingKid, setEditingKid] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    age: '', 
    grade: '',
    email: '',
    phone: '',
    sendReminders: true,
    sendSchedules: false
  });
  const [saving, setSaving] = useState(false);

  const { colors } = useTheme();
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchKids();
  }, []);

  const fetchKids = async () => {
    try {
      setLoading(true);
      const response = await api.get('/students');
      setKids(response.data || []);
    } catch (err) {
      console.error('Error fetching kids:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (kid = null) => {
    if (kid) {
      setEditingKid(kid);
      setFormData({ 
        student_id: kid.student_id || kid.kid_id,
        name: kid.name || '', 
        age: kid.age?.toString() || '', 
        grade: kid.grade || '',
        email: kid.email || '',
        phone: kid.phone || '',
        sendReminders: kid.send_reminders !== false,
        sendSchedules: kid.send_schedules || false
      });
    } else {
      setEditingKid(null);
      setFormData({ name: '', age: '', grade: '', email: '', phone: '', sendReminders: true, sendSchedules: false });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingKid(null);
    setFormData({ name: '', age: '', grade: '', email: '', phone: '', sendReminders: true, sendSchedules: false });
  };

  const handleSave = async () => {
    if (!formData.name) {
      showError(t('pages.kids.name_required'));
      return;
    }

    try {
      setSaving(true);
      const data = {
        name: formData.name,
        age: formData.age ? parseInt(formData.age) : null,
        grade: formData.grade || null,
        email: formData.email || null,
        phone: formData.phone || null,
        send_reminders: formData.sendReminders,
        send_schedules: formData.sendSchedules,
      };

      if (editingKid) {
        await api.put(`/students/${editingKid.student_id || editingKid.kid_id}`, data);
        showSuccess(t('pages.kids.update_success'));
      } else {
        await api.post('/students', data);
        showSuccess(t('pages.kids.add_success'));
      }

      fetchKids();
      closeModal();
    } catch (err) {
      // Handle error properly
      let errorMessage = t('messages.errors.generic');
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          errorMessage = detail.map(e => e.msg || e.message || String(e)).join(', ');
        } else if (typeof detail === 'string') {
          errorMessage = detail;
        }
      }
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const deleteKid = async (kidId) => {
    if (!window.confirm(t('pages.kids.delete_confirm'))) return;

    try {
      await api.delete(`/students/${kidId}`);
      showSuccess(t('pages.kids.delete_success'));
      fetchKids();
    } catch (err) {
      showError(t('messages.errors.generic'));
    }
  };

  const renderKidCard = (kid) => (
    <div 
      key={kid.student_id || kid.kid_id} 
      className="kid-card"
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      data-testid={`kid-card-${kid.student_id || kid.kid_id}`}
    >
      <div className="kid-avatar" style={{ backgroundColor: colors.primaryLight }}>
        <User size={24} color={colors.primary} />
      </div>
      <div className="kid-info">
        <h4 style={{ color: colors.text }}>{kid.name}</h4>
        {kid.age && (
          <span style={{ color: colors.textMuted }}>
            {kid.age} {t('pages.kids.years_old')}
          </span>
        )}
        {kid.notes && (
          <p style={{ color: colors.textMuted }}>{kid.notes}</p>
        )}
      </div>
      <div className="kid-actions">
        <button 
          onClick={() => openModal(kid)}
          style={{ color: colors.primary }}
          data-testid={`edit-kid-${kid.student_id || kid.kid_id}`}
        >
          <Edit2 size={18} />
        </button>
        <button 
          onClick={() => deleteKid(kid.student_id || kid.kid_id)}
          style={{ color: colors.error }}
          data-testid={`delete-kid-${kid.student_id || kid.kid_id}`}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="kids-page" style={{ backgroundColor: colors.background }}>
      <AppHeader />
      
      {/* Title bar with Add Child button */}
      <div className="kids-title-bar" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="title-content">
          <h1 style={{ color: colors.text }}>{t('pages.kids.title')}</h1>
          <button 
            className="add-child-btn" 
            onClick={() => openModal()}
            style={{ backgroundColor: colors.primary }}
            data-testid="add-kid-btn"
          >
            <Plus size={18} color="#fff" />
            <span>{t('pages.kids.add_child')}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="kids-content">
        {loading ? (
          <div className="loading-state">
            <Loader className="spinner" size={32} color={colors.primary} />
          </div>
        ) : kids.length === 0 ? (
          <div className="empty-state">
            <Users size={64} color={colors.gray300} />
            <h3 style={{ color: colors.text }}>{t('pages.kids.no_kids_title')}</h3>
            <p style={{ color: colors.textMuted }}>{t('pages.kids.no_kids_message')}</p>
            <button 
              className="primary-btn"
              onClick={() => openModal()}
              style={{ backgroundColor: colors.primary }}
            >
              <Plus size={20} />
              {t('pages.kids.add_child')}
            </button>
          </div>
        ) : (
          <div className="kids-list">
            {kids.map(renderKidCard)}
          </div>
        )}
      </main>

      {/* Modal - Bottom Sheet Style */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div 
            className="bottom-sheet" 
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" style={{ backgroundColor: colors.gray300 }} />
            
            <div className="modal-header">
              <h2 style={{ color: colors.text }}>
                {editingKid ? t('pages.kids.edit_child') : t('pages.kids.add_child')}
              </h2>
              <button onClick={closeModal} className="close-btn">
                <X size={24} color={colors.textMuted} />
              </button>
            </div>

            <div className="modal-content">
              {/* Name (required) */}
              <div className="form-group">
                <label style={{ color: colors.textMuted }}>{t('forms.labels.name')} *</label>
                <input
                  type="text"
                  placeholder={t('forms.placeholders.child_name')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
                  data-testid="kid-name-input"
                />
              </div>

              {/* Age and Grade side by side */}
              <div className="form-row">
                <div className="form-group">
                  <label style={{ color: colors.textMuted }}>{t('forms.labels.age')}</label>
                  <input
                    type="number"
                    placeholder={t('forms.placeholders.age')}
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
                    data-testid="kid-age-input"
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: colors.textMuted }}>{t('pages.kids.child_grade')}</label>
                  <input
                    type="text"
                    placeholder={t('pages.kids.grade_placeholder')}
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
                  />
                </div>
              </div>

              {/* Notification Contact Section */}
              <div className="section-header" style={{ borderTopColor: colors.border }}>
                <h3 style={{ color: colors.text }}>{t('pages.kids.notification_contact')}</h3>
                <p style={{ color: colors.textMuted }}>{t('pages.kids.notification_contact_info')}</p>
              </div>

              {/* Email */}
              <div className="form-group">
                <label style={{ color: colors.textMuted }}>{t('forms.labels.email')}</label>
                <input
                  type="email"
                  placeholder={t('forms.placeholders.email')}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
                />
              </div>

              {/* Phone */}
              <div className="form-group">
                <label style={{ color: colors.textMuted }}>{t('forms.labels.phone')}</label>
                <input
                  type="tel"
                  placeholder={t('forms.placeholders.phone')}
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{ backgroundColor: colors.background, color: colors.text, borderColor: colors.border }}
                />
              </div>

              {/* Checkboxes */}
              <div className="checkbox-group">
                <label className="checkbox-label" style={{ color: colors.text }}>
                  <input
                    type="checkbox"
                    checked={formData.sendReminders}
                    onChange={(e) => setFormData({ ...formData, sendReminders: e.target.checked })}
                    style={{ accentColor: colors.primary }}
                  />
                  {t('pages.kids.send_reminders')}
                </label>
                <label className="checkbox-label" style={{ color: colors.text }}>
                  <input
                    type="checkbox"
                    checked={formData.sendSchedules}
                    onChange={(e) => setFormData({ ...formData, sendSchedules: e.target.checked })}
                    style={{ accentColor: colors.primary }}
                  />
                  {t('pages.kids.auto_send_schedules')}
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="submit-btn"
                onClick={handleSave}
                disabled={saving}
                style={{ backgroundColor: colors.primary }}
                data-testid="save-kid-btn"
              >
                {saving ? <Loader className="spinner" size={18} /> : null}
                {editingKid ? t('buttons.save') : t('pages.kids.add_child')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <BottomNav />
    </div>
  );
};

export default KidsPage;
