import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
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
import { useAuth } from '@/src/context/AuthContext';
import AppHeader from '@/src/components/AppHeader';

interface Category {
  id: string;
  name: string;
  subjects: string[];
}

const LEVELS = [
  { id: 'beginner', name: 'Beginner' },
  { id: 'intermediate', name: 'Intermediate' },
  { id: 'advanced', name: 'Advanced' },
  { id: 'elementary', name: 'Elementary (K-5)' },
  { id: 'middle_school', name: 'Middle School (6-8)' },
  { id: 'high_school', name: 'High School (9-12)' },
  { id: 'college', name: 'College' },
  { id: 'adult', name: 'Adult' },
  { id: 'professional', name: 'Professional' },
];

const MODALITIES = [
  { id: 'online', name: 'Online', icon: 'videocam' },
  { id: 'in_person', name: 'In-Person', icon: 'location' },
  { id: 'hybrid', name: 'Hybrid', icon: 'sync' },
];

const PAYOUT_COUNTRIES = [
  { id: 'US', name: 'United States', currency: 'USD', symbol: '$', flag: '🇺🇸' },
  { id: 'IN', name: 'India', currency: 'INR', symbol: '₹', flag: '🇮🇳' },
];

// Get icon for category
const getCategoryIcon = (categoryId: string): string => {
  switch (categoryId) {
    case 'coaching_personal': return 'rocket';
    case 'health_mindfulness': return 'leaf';
    case 'fitness_nutrition': return 'fitness';
    case 'relationships_family': return 'heart';
    case 'business_communication': return 'briefcase';
    case 'finance_legal': return 'cash';
    case 'culture_inclusion': return 'globe';
    case 'performance_arts': return 'mic';
    case 'academics': return 'school';
    case 'activities_hobbies': return 'color-palette';
    default: return 'apps';
  }
};

export default function TutorOnboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const { token } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(true);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 560 : isTablet ? 480 : undefined;

  // Form state
  const [bio, setBio] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedModalities, setSelectedModalities] = useState<string[]>(['online']);
  const [basePrice, setBasePrice] = useState('50');
  const [duration, setDuration] = useState('60');
  const [payoutCountry, setPayoutCountry] = useState<string>('US');

  const styles = getStyles(colors);

  useEffect(() => {
    loadCategories();
    checkExistingProfile();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const checkExistingProfile = async () => {
    try {
      const response = await api.get('/tutors/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.tutor_id) {
        setHasExistingProfile(true);
        // Pre-fill with existing data
        setBio(response.data.bio || '');
        setSelectedCategories(response.data.categories || []);
        setSelectedSubjects(response.data.subjects || []);
        setSelectedLevels(response.data.levels || []);
        setSelectedModalities(response.data.modality || ['online']);
        setBasePrice(String(response.data.base_price || 50));
        setDuration(String(response.data.duration_minutes || 60));
      }
    } catch (error) {
      // No existing profile, that's fine
      setHasExistingProfile(false);
    } finally {
      setCheckingProfile(false);
    }
  };

  const toggleSelection = (list: string[], setList: (v: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  // Get subjects from selected categories
  const availableSubjects = selectedCategories.flatMap((catId) => {
    const cat = categories.find(c => c.id === catId);
    return cat?.subjects || [];
  });

  const selectedCountry = PAYOUT_COUNTRIES.find(c => c.id === payoutCountry);
  const currencySymbol = selectedCountry?.symbol || '$';

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      showInfo(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSubmit = async () => {
    if (!bio.trim()) {
      showError('Please enter a bio');
      return;
    }
    if (selectedCategories.length === 0) {
      showError('Please select at least one category');
      return;
    }
    if (selectedSubjects.length === 0) {
      showError('Please select at least one subject');
      return;
    }
    if (selectedLevels.length === 0) {
      showError('Please select at least one level');
      return;
    }

    setLoading(true);
    try {
      const profileData = {
        bio: bio.trim(),
        categories: selectedCategories,
        subjects: selectedSubjects,
        levels: selectedLevels,
        modality: selectedModalities,
        base_price: parseFloat(basePrice),
        duration_minutes: parseInt(duration),
        payout_country: payoutCountry,
        policies: {
          cancel_window_hours: 24,
          no_show_policy: 'Full charge for no-shows',
          late_arrival_policy: 'Lesson time not extended',
        },
      };

      if (hasExistingProfile) {
        // Update existing profile
        await api.put('/tutors/profile', profileData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showSuccess('Your profile has been updated!');
      } else {
        // Create new profile
        await api.post('/tutors/profile', profileData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        showSuccess('Your profile has been created and is pending review.');
      }

      router.replace('/(tutor)/dashboard');
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to save profile';
      showError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>Tell us about yourself</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>Write a bio that introduces you to students</Text>

      <TextInput
        style={[styles.bioInput, isTablet && styles.bioInputTablet, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
        placeholder="Hi! I'm a passionate educator with experience in..."
        placeholderTextColor={colors.textMuted}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />
      <Text style={[styles.charCount, { color: colors.textMuted }]}>{bio.length}/500 characters</Text>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>What do you teach?</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>Select your categories and subjects</Text>

      <Text style={[styles.sectionLabel, { color: colors.text }]}>Categories</Text>
      <View style={styles.chipGrid}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedCategories.includes(cat.id) && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => {
              toggleSelection(selectedCategories, setSelectedCategories, cat.id);
              // Clear subjects from this category when deselected
              if (selectedCategories.includes(cat.id)) {
                const catSubjects = cat.subjects || [];
                setSelectedSubjects(prev => prev.filter(s => !catSubjects.includes(s)));
              }
            }}
          >
            <Ionicons 
              name={getCategoryIcon(cat.id) as any} 
              size={18} 
              color={selectedCategories.includes(cat.id) ? '#FFFFFF' : colors.primary} 
            />
            <Text style={[
              styles.categoryChipText,
              { color: colors.text },
              selectedCategories.includes(cat.id) && { color: '#FFFFFF' }
            ]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {availableSubjects.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 20 }]}>Subjects/Skills</Text>
          <View style={styles.chipGrid}>
            {availableSubjects.map((subject) => (
              <TouchableOpacity
                key={subject}
                style={[
                  styles.chip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  selectedSubjects.includes(subject) && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => toggleSelection(selectedSubjects, setSelectedSubjects, subject)}
              >
                <Text style={[
                  styles.chipText,
                  { color: colors.text },
                  selectedSubjects.includes(subject) && { color: '#FFFFFF' }
                ]}>{subject}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>Who do you teach?</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>Select the levels you can teach</Text>

      <View style={styles.chipGrid}>
        {LEVELS.map((level) => (
          <TouchableOpacity
            key={level.id}
            style={[
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedLevels.includes(level.id) && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => toggleSelection(selectedLevels, setSelectedLevels, level.id)}
          >
            <Text style={[
              styles.chipText,
              { color: colors.text },
              selectedLevels.includes(level.id) && { color: '#FFFFFF' }
            ]}>{level.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>Set your rates</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>Choose how you teach and your pricing</Text>

      <Text style={[styles.sectionLabel, { color: colors.text }]}>Modality</Text>
      <View style={styles.chipGrid}>
        {MODALITIES.map((mod) => (
          <TouchableOpacity
            key={mod.id}
            style={[
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedModalities.includes(mod.id) && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => toggleSelection(selectedModalities, setSelectedModalities, mod.id)}
          >
            <Ionicons 
              name={mod.icon as any} 
              size={16} 
              color={selectedModalities.includes(mod.id) ? '#FFFFFF' : colors.text} 
            />
            <Text style={[
              styles.chipText,
              { color: colors.text, marginLeft: 4 },
              selectedModalities.includes(mod.id) && { color: '#FFFFFF' }
            ]}>{mod.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.text, marginTop: 20 }]}>Payout Country</Text>
      <View style={styles.chipGrid}>
        {PAYOUT_COUNTRIES.map((country) => (
          <TouchableOpacity
            key={country.id}
            style={[
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              payoutCountry === country.id && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setPayoutCountry(country.id)}
          >
            <Text style={[
              styles.chipText,
              { color: colors.text },
              payoutCountry === country.id && { color: '#FFFFFF' }
            ]}>{country.flag} {country.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceInput}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Price per Hour</Text>
          <View style={[styles.inputWithPrefix, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.prefix, { color: colors.textMuted }]}>{currencySymbol}</Text>
            <TextInput
              style={[styles.priceTextInput, { color: colors.text }]}
              value={basePrice}
              onChangeText={setBasePrice}
              keyboardType="numeric"
            />
          </View>
        </View>

        <View style={styles.priceInput}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Session Length</Text>
          <View style={[styles.inputWithPrefix, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.priceTextInput, { color: colors.text }]}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
            />
            <Text style={[styles.suffix, { color: colors.textMuted }]}>min</Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (checkingProfile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title={hasExistingProfile ? "Edit Profile" : "Complete Profile"} showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={hasExistingProfile ? "Edit Profile" : "Complete Profile"} showBack />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={[styles.scrollContent, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
          {/* Progress */}
          <View style={styles.progress}>
            {[1, 2, 3, 4].map((s) => (
              <View
                key={s}
                style={[
                  styles.progressDot,
                  { backgroundColor: s <= step ? colors.primary : colors.border }
                ]}
              />
            ))}
          </View>
          <Text style={[styles.progressText, { color: colors.textMuted }]}>Step {step} of 4</Text>

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={styles.footerButtons}>
            {step > 1 && (
              <TouchableOpacity
                style={[styles.backButton, { borderColor: colors.border }]}
                onPress={() => setStep(step - 1)}
              >
                <Ionicons name="arrow-back" size={20} color={colors.text} />
                <Text style={[styles.backButtonText, { color: colors.text }]}>Back</Text>
              </TouchableOpacity>
            )}
            {step < 4 ? (
              <TouchableOpacity
                style={[styles.nextButton, { backgroundColor: colors.primary }, step === 1 && { flex: 1 }]}
                onPress={() => setStep(step + 1)}
              >
                <Text style={styles.nextButtonText}>Continue</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.nextButton, { backgroundColor: colors.primary }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.nextButtonText}>{hasExistingProfile ? 'Update Profile' : 'Create Profile'}</Text>
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressDot: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 24,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  stepTitleDesktop: {
    fontSize: 28,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
  },
  stepSubtitleDesktop: {
    fontSize: 16,
  },
  bioInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 150,
  },
  bioInputTablet: {
    minHeight: 180,
    fontSize: 17,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 14,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  priceInput: {
    flex: 1,
  },
  inputWithPrefix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  prefix: {
    fontSize: 16,
    marginRight: 4,
  },
  suffix: {
    fontSize: 14,
    marginLeft: 4,
  },
  priceTextInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
