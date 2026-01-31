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
      const response = await api.get('/kids');
      setKids(response.data.kids || []);
    } catch (err) {
      console.error('Error fetching kids:', err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (kid = null) => {
    if (kid) {
      setEditingKid(kid);
      setFormData({ name: kid.name, age: kid.age?.toString() || '', notes: kid.notes || '' });
    } else {
      setEditingKid(null);
      setFormData({ name: '', age: '', notes: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingKid(null);
    setFormData({ name: '', age: '', notes: '' });
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
        notes: formData.notes,
      };

      if (editingKid) {
        await api.put(`/kids/${editingKid.kid_id}`, data);
        showSuccess(t('pages.kids.update_success'));
      } else {
        await api.post('/kids', data);
        showSuccess(t('pages.kids.add_success'));
      }

      fetchKids();
      closeModal();
    } catch (err) {
      showError(t('messages.errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const deleteKid = async (kidId) => {
    if (!window.confirm(t('pages.kids.delete_confirm'))) return;

    try {
      await api.delete(`/kids/${kidId}`);
      showSuccess(t('pages.kids.delete_success'));
      fetchKids();
    } catch (err) {
      showError(t('messages.errors.generic'));
    }
  };

  const renderKidCard = (kid) => (
    <div 
      key={kid.kid_id} 
      className="kid-card"
      style={{ backgroundColor: colors.surface, borderColor: colors.border }}
      data-testid={`kid-card-${kid.kid_id}`}
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
          data-testid={`edit-kid-${kid.kid_id}`}
        >
          <Edit2 size={18} />
        </button>
        <button 
          onClick={() => deleteKid(kid.kid_id)}
          style={{ color: colors.error }}
          data-testid={`delete-kid-${kid.kid_id}`}
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="kids-page" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <header className="kids-header" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
        <div className="header-content">
          <button 
            className="back-btn" 
            onClick={() => navigate('/home')}
            style={{ color: colors.text }}
          >
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ color: colors.text }}>{t('pages.kids.title')}</h1>
          <button 
            className="add-btn" 
            onClick={() => openModal()}
            style={{ backgroundColor: colors.primary }}
            data-testid="add-kid-btn"
          >
            <Plus size={20} color={colors.textInverse} />
          </button>
        </div>
      </header>

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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div 
            className="modal" 
            style={{ backgroundColor: colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 style={{ color: colors.text }}>
                {editingKid ? t('pages.kids.edit_child') : t('pages.kids.add_child')}
              </h2>
              <button onClick={closeModal}>
                <X size={24} color={colors.text} />
              </button>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label style={{ color: colors.text }}>{t('forms.labels.name')}</label>
                <input
                  type="text"
                  placeholder={t('forms.placeholders.child_name')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="kid-name-input"
                />
              </div>

              <div className="form-group">
                <label style={{ color: colors.text }}>{t('forms.labels.age')}</label>
                <input
                  type="number"
                  placeholder={t('forms.placeholders.age')}
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="kid-age-input"
                />
              </div>

              <div className="form-group">
                <label style={{ color: colors.text }}>{t('forms.labels.notes')}</label>
                <textarea
                  placeholder={t('forms.placeholders.notes')}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  style={{ backgroundColor: colors.gray100, color: colors.text, borderColor: colors.border }}
                  data-testid="kid-notes-input"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="cancel-btn"
                onClick={closeModal}
                style={{ color: colors.text, borderColor: colors.border }}
              >
                {t('buttons.cancel')}
              </button>
              <button 
                className="save-btn"
                onClick={handleSave}
                disabled={saving}
                style={{ backgroundColor: colors.primary }}
                data-testid="save-kid-btn"
              >
                {saving ? <Loader className="spinner" size={18} /> : <Save size={18} />}
                {editingKid ? t('buttons.save') : t('buttons.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KidsPage;
