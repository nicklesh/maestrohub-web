import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
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

export default function BecomeTutorScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const contentMaxWidth = isDesktop ? 560 : isTablet ? 480 : undefined;

  // Step 1: New Account Info
  const [tutorEmail, setTutorEmail] = useState('');
  const [tutorPassword, setTutorPassword] = useState('');
  const [tutorName, setTutorName] = useState('');

  // Step 2-4: Profile Info
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
  }, []);

  const loadCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Failed to load categories:', error);
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

  const validateStep1 = () => {
    if (!tutorEmail.trim()) {
      showError('Please enter an email address for your tutor account');
      return false;
    }
    if (!tutorEmail.includes('@')) {
      showError('Please enter a valid email address');
      return false;
    }
    if (user?.email && tutorEmail.toLowerCase() === user.email.toLowerCase()) {
      showError('You must use a different email address for your tutor account. Your parent account uses this email.');
      return false;
    }
    if (!tutorPassword || tutorPassword.length < 6) {
      showError('Password must be at least 6 characters');
      return false;
    }
    if (!tutorName.trim()) {
      showError('Please enter your professional name');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!bio.trim() || bio.length < 50) {
      showError('Please enter a bio (at least 50 characters)');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (selectedCategories.length === 0) {
      showError('Please select at least one category');
      return false;
    }
    if (selectedSubjects.length === 0) {
      showError('Please select at least one subject/skill');
      return false;
    }
    if (selectedLevels.length === 0) {
      showError('Please select at least one level');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Step 1: Create new tutor user account
      const registerResponse = await api.post('/auth/register', {
        email: tutorEmail.trim().toLowerCase(),
        password: tutorPassword,
        name: tutorName.trim(),
        role: 'tutor',
      });

      // Step 2: Get the new user's token
      const loginResponse = await api.post('/auth/login', {
        email: tutorEmail.trim().toLowerCase(),
        password: tutorPassword,
      });

      const newToken = loginResponse.data.token;

      // Step 3: Create tutor profile with the new token
      await api.post('/tutors/profile', {
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
      }, {
        headers: { Authorization: `Bearer ${newToken}` }
      });

      // Success!
      showSuccess('Your tutor account has been created! You can now log in with your new tutor email to access your tutor dashboard. Your parent account remains unchanged.');
      router.replace('/(consumer)/profile');
    } catch (error: any) {
      console.error('Registration error:', error);
      const message = error.response?.data?.detail || 'Failed to create tutor account. Please try again.';
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Create Your Coach Account</Text>
      <Text style={[styles.stepDescription, { color: colors.textMuted }]}>
        To become a tutor, you'll need a separate account with a different email address. 
        This keeps your parent and tutor roles separate.
      </Text>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={20} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.textMuted }]}>
          Your current parent account ({user?.email}) will remain unchanged. You'll use the new email below to log in as a tutor.
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Coach Email *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="tutor@example.com"
          placeholderTextColor={colors.textMuted}
          value={tutorEmail}
          onChangeText={setTutorEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Password *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="At least 6 characters"
          placeholderTextColor={colors.textMuted}
          value={tutorPassword}
          onChangeText={setTutorPassword}
          secureTextEntry
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Professional Name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Name displayed to students"
          placeholderTextColor={colors.textMuted}
          value={tutorName}
          onChangeText={setTutorName}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>About You</Text>
      <Text style={[styles.stepDescription, { color: colors.textMuted }]}>
        Tell potential students about yourself and your experience
      </Text>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.text }]}>Bio *</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Share your background, experience, teaching style, and what makes you a great tutor..."
          placeholderTextColor={colors.textMuted}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <Text style={[styles.charCount, { color: colors.textMuted }]}>{bio.length}/500</Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Your Expertise</Text>
      <Text style={[styles.stepDescription, { color: colors.textMuted }]}>
        Select categories, subjects, and levels you can teach
      </Text>

      <Text style={[styles.sectionLabel, { color: colors.text }]}>Categories</Text>
      <View style={styles.chipGrid}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedCategories.includes(cat.id) && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => {
              toggleSelection(selectedCategories, setSelectedCategories, cat.id);
              // Clear subjects when category changes
              if (selectedCategories.includes(cat.id)) {
                const catSubjects = cat.subjects || [];
                setSelectedSubjects(prev => prev.filter(s => !catSubjects.includes(s)));
              }
            }}
          >
            <Text style={[
              styles.chipText,
              { color: colors.text },
              selectedCategories.includes(cat.id) && { color: '#FFFFFF' }
            ]}>{cat.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {availableSubjects.length > 0 && (
        <>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Subjects/Skills</Text>
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

      <Text style={[styles.sectionLabel, { color: colors.text }]}>Levels</Text>
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
      <Text style={[styles.stepTitle, { color: colors.text }]}>Pricing & Availability</Text>
      <Text style={[styles.stepDescription, { color: colors.textMuted }]}>
        Set your rates and how you'll deliver lessons
      </Text>

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

      <Text style={[styles.sectionLabel, { color: colors.text }]}>Payout Country</Text>
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
          <Text style={[styles.label, { color: colors.text }]}>Price per Hour</Text>
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
          <Text style={[styles.label, { color: colors.text }]}>Session Length</Text>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Become a Coach" showBack onBack={handleBack} />
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
          {step < 4 ? (
            <TouchableOpacity
              style={[styles.nextButton, { backgroundColor: colors.primary }]}
              onPress={handleNext}
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
                  <Text style={styles.nextButtonText}>Create Coach Account</Text>
                  <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
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
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
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
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
