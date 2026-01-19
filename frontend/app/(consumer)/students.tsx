import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/services/api';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';

interface Student {
  student_id: string;
  name: string;
  age?: number;
  grade?: string;
  notes?: string;
}

export default function StudentsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { t } = useTranslation();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [grade, setGrade] = useState('');
  const [notes, setNotes] = useState('');

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 800 : isTablet ? 680 : undefined;
  const numColumns = isDesktop ? 2 : 1;

  const styles = getStyles(colors);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const response = await api.get('/students');
      setStudents(response.data);
    } catch (error) {
      console.error('Failed to load students:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setAge('');
    setGrade('');
    setNotes('');
    setEditingStudent(null);
  };

  const openAddModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setName(student.name);
    setAge(student.age?.toString() || '');
    setGrade(student.grade || '');
    setNotes(student.notes || '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showError('Please enter student name');
      return;
    }

    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        age: age ? parseInt(age) : undefined,
        grade: grade.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (editingStudent) {
        await api.put(`/students/${editingStudent.student_id}`, data);
      } else {
        await api.post('/students', data);
      }

      setModalVisible(false);
      resetForm();
      loadStudents();
    } catch (error) {
      console.error('Save failed:', error);
      showError('Failed to save student');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (student: Student) => {
    const confirmed = Platform.OS === 'web' 
      ? window.confirm(`Are you sure you want to remove ${student.name}?`)
      : true; // On native, proceed (could use a modal in production)
    
    if (confirmed) {
      try {
        await api.delete(`/students/${student.student_id}`);
        showSuccess('Student removed successfully');
        loadStudents();
      } catch (error) {
        console.error('Delete failed:', error);
        showError('Failed to delete student');
      }
    }
  };

  const renderStudentCard = ({ item, index }: { item: Student; index: number }) => (
    <View
      style={[
        styles.studentCard,
        isTablet && styles.studentCardTablet,
        isDesktop && {
          marginRight: index % 2 === 0 ? 12 : 0,
          marginLeft: index % 2 === 1 ? 12 : 0,
          flex: 1,
        },
      ]}
    >
      <View style={[styles.studentAvatar, isTablet && styles.studentAvatarTablet]}>
        <Text style={[styles.studentInitial, isTablet && styles.studentInitialTablet]}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.studentInfo}>
        <Text style={[styles.studentName, isDesktop && styles.studentNameDesktop]}>{item.name}</Text>
        <Text style={styles.studentMeta}>
          {[item.age && `${item.age} years`, item.grade && `Grade ${item.grade}`]
            .filter(Boolean)
            .join(' • ') || 'No details added'}
        </Text>
      </View>
      <View style={styles.studentActions}>
        <TouchableOpacity style={[styles.actionButton, isTablet && styles.actionButtonTablet]} onPress={() => openEditModal(item)}>
          <Ionicons name="pencil" size={isTablet ? 20 : 18} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, isTablet && styles.actionButtonTablet]} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={isTablet ? 20 : 18} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader showBack title="My Students" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack title="My Students" />
      <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
        {/* Header Actions */}
        <View style={[styles.headerActions, isTablet && styles.headerActionsTablet]}>
          <TouchableOpacity style={[styles.addButton, isTablet && styles.addButtonTablet]} onPress={openAddModal}>
            <Ionicons name="add" size={24} color={colors.primary} />
            <Text style={styles.addButtonText}>{t('pages.students.add_student')}</Text>
          </TouchableOpacity>
        </View>

        {students.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={isTablet ? 80 : 64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, isDesktop && styles.emptyTitleDesktop]}>No students yet</Text>
            <Text style={[styles.emptyText, isDesktop && styles.emptyTextDesktop]}>
              Add your children or students to easily book lessons for them.
            </Text>
            <TouchableOpacity style={[styles.ctaButton, isTablet && styles.ctaButtonTablet]} onPress={openAddModal}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={[styles.ctaButtonText, isTablet && styles.ctaButtonTextTablet]}>{t('pages.students.add_student')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={students}
            renderItem={renderStudentCard}
            keyExtractor={(item) => item.student_id}
            contentContainerStyle={[styles.listContent, isTablet && styles.listContentTablet]}
            numColumns={numColumns}
            key={numColumns}
          />
        )}
      </View>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={[styles.modalContent, isTablet && styles.modalContentTablet]}>
            <View style={[styles.modalInner, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalCancel}>{t('buttons.cancel')}</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, isDesktop && styles.modalTitleDesktop]}>
                  {editingStudent ? t('pages.students.edit_student') : t('pages.students.add_student')}
                </Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={styles.modalSave}>{t('buttons.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.formContent}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.inputTablet]}
                  placeholder={t('pages.students.name_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.inputLabel}>{t('pages.students.age')}</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.inputTablet]}
                  placeholder={t('pages.students.age_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                />

                <Text style={styles.inputLabel}>{t('pages.students.grade')}</Text>
                <TextInput
                  style={[styles.input, isTablet && styles.inputTablet]}
                  placeholder="e.g., 5th, 8th, 10th"
                  placeholderTextColor={colors.textMuted}
                  value={grade}
                  onChangeText={setGrade}
                />

                <Text style={styles.inputLabel}>{t('pages.students.notes')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea, isTablet && styles.inputTablet]}
                  placeholder={t('pages.students.notes_placeholder')}
                  placeholderTextColor={colors.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
  },
  headerActions: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  headerActionsTablet: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  addButtonTablet: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  addButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
  },
  listContentTablet: {
    padding: 24,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  studentCardTablet: {
    padding: 20,
    borderRadius: 20,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentAvatarTablet: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  studentInitial: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  studentInitialTablet: {
    fontSize: 24,
  },
  studentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  studentNameDesktop: {
    fontSize: 18,
  },
  studentMeta: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  studentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonTablet: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyTitleDesktop: {
    fontSize: 24,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  emptyTextDesktop: {
    fontSize: 16,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  ctaButtonTablet: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
  },
  ctaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  ctaButtonTextTablet: {
    fontSize: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContent: {
    flex: 1,
  },
  modalContentTablet: {
    paddingHorizontal: 24,
  },
  modalInner: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCancel: {
    fontSize: 16,
    color: colors.textMuted,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalTitleDesktop: {
    fontSize: 22,
  },
  modalSave: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  formContent: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  inputTablet: {
    padding: 18,
    fontSize: 17,
    borderRadius: 14,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
