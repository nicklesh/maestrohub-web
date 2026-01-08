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
import { colors } from '@/src/theme/colors';

const CATEGORIES = [
  { id: 'academic', name: 'Academic', icon: 'school' },
  { id: 'music', name: 'Music', icon: 'musical-notes' },
  { id: 'activities', name: 'Activities', icon: 'game-controller' },
];

const SUBJECTS: Record<string, string[]> = {
  academic: ['Math', 'Science', 'English', 'History', 'Test Prep', 'Writing'],
  music: ['Piano', 'Guitar', 'Voice', 'Violin', 'Drums', 'Music Theory'],
  activities: ['Coding', 'Robotics', 'Art', 'Chess', 'Debate', 'Languages'],
};

const LEVELS = [
  { id: 'elementary', name: 'Elementary (K-5)' },
  { id: 'middle_school', name: 'Middle School (6-8)' },
  { id: 'high_school', name: 'High School (9-12)' },
  { id: 'college', name: 'College' },
  { id: 'adult', name: 'Adult' },
];

const MODALITIES = [
  { id: 'online', name: 'Online', icon: 'videocam' },
  { id: 'in_person', name: 'In-Person', icon: 'location' },
];

const PAYOUT_COUNTRIES = [
  { id: 'US', name: 'United States', currency: 'USD', symbol: '$', flag: '🇺🇸' },
  { id: 'IN', name: 'India', currency: 'INR', symbol: '₹', flag: '🇮🇳' },
];

export default function TutorOnboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

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
  const [payoutCountry, setPayoutCountry] = useState<string>('US');  // New: payout country

  const toggleSelection = (list: string[], setList: (v: string[]) => void, item: string) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const availableSubjects = selectedCategories.flatMap((cat) => SUBJECTS[cat] || []);

  // Get currency based on selected payout country
  const selectedCountry = PAYOUT_COUNTRIES.find(c => c.id === payoutCountry);
  const currencySymbol = selectedCountry?.symbol || '$';

  const handleSubmit = async () => {
    if (!bio.trim()) {
      Alert.alert('Error', 'Please enter a bio');
      return;
    }
    if (selectedCategories.length === 0) {
      Alert.alert('Error', 'Please select at least one category');
      return;
    }
    if (selectedSubjects.length === 0) {
      Alert.alert('Error', 'Please select at least one subject');
      return;
    }
    if (selectedLevels.length === 0) {
      Alert.alert('Error', 'Please select at least one level');
      return;
    }

    setLoading(true);
    try {
      // Create tutor profile
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
      });

      // Set provider market based on payout country
      try {
        await api.post('/providers/market', { payout_country: payoutCountry });
      } catch (e) {
        console.log('Could not set provider market');
      }

      Alert.alert(
        'Profile Created!',
        'Your tutor profile has been created. It will be reviewed by our team.',
        [{ text: 'OK', onPress: () => router.replace('/(tutor)/dashboard') }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>Tell us about yourself</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>Write a bio that introduces you to students</Text>

      <TextInput
        style={[styles.bioInput, isTablet && styles.bioInputTablet]}
        placeholder="Hi! I'm a passionate educator with experience in..."
        placeholderTextColor={colors.textMuted}
        value={bio}
        onChangeText={setBio}
        multiline
        numberOfLines={6}
      />

      <TouchableOpacity
        style={[styles.nextButton, isTablet && styles.nextButtonTablet, !bio.trim() && styles.buttonDisabled]}
        onPress={() => setStep(2)}
        disabled={!bio.trim()}
      >
        <Text style={[styles.nextButtonText, isTablet && styles.nextButtonTextTablet]}>Continue</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>What do you teach?</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>Select your categories</Text>

      <View style={[styles.optionsGrid, isTablet && styles.optionsGridTablet]}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.optionCard,
              isTablet && styles.optionCardTablet,
              selectedCategories.includes(cat.id) && styles.optionCardSelected,
            ]}
            onPress={() => {
              toggleSelection(selectedCategories, setSelectedCategories, cat.id);
              // Clear subjects when category changes
              setSelectedSubjects([]);
            }}
          >
            <Ionicons
              name={cat.icon as any}
              size={isTablet ? 32 : 28}
              color={selectedCategories.includes(cat.id) ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.optionText,
                selectedCategories.includes(cat.id) && styles.optionTextSelected,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedCategories.length > 0 && (
        <>
          <Text style={[styles.subTitle, isDesktop && styles.subTitleDesktop]}>Select subjects</Text>
          <View style={styles.chipsContainer}>
            {availableSubjects.map((subject) => (
              <TouchableOpacity
                key={subject}
                style={[
                  styles.chip,
                  isTablet && styles.chipTablet,
                  selectedSubjects.includes(subject) && styles.chipSelected,
                ]}
                onPress={() => toggleSelection(selectedSubjects, setSelectedSubjects, subject)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedSubjects.includes(subject) && styles.chipTextSelected,
                  ]}
                >
                  {subject}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <View style={styles.navigationRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.nextButton,
            styles.nextButtonSmall,
            isTablet && styles.nextButtonTablet,
            selectedSubjects.length === 0 && styles.buttonDisabled,
          ]}
          onPress={() => setStep(3)}
          disabled={selectedSubjects.length === 0}
        >
          <Text style={[styles.nextButtonText, isTablet && styles.nextButtonTextTablet]}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>Who do you teach?</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>Select experience levels</Text>

      <View style={styles.levelsList}>
        {LEVELS.map((level) => (
          <TouchableOpacity
            key={level.id}
            style={[
              styles.levelItem,
              isTablet && styles.levelItemTablet,
              selectedLevels.includes(level.id) && styles.levelItemSelected,
            ]}
            onPress={() => toggleSelection(selectedLevels, setSelectedLevels, level.id)}
          >
            <Text
              style={[
                styles.levelText,
                isDesktop && styles.levelTextDesktop,
                selectedLevels.includes(level.id) && styles.levelTextSelected,
              ]}
            >
              {level.name}
            </Text>
            {selectedLevels.includes(level.id) && (
              <Ionicons name="checkmark" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={[styles.subTitle, isDesktop && styles.subTitleDesktop]}>How do you teach?</Text>
      <View style={styles.modalitiesRow}>
        {MODALITIES.map((mod) => (
          <TouchableOpacity
            key={mod.id}
            style={[
              styles.modalityCard,
              isTablet && styles.modalityCardTablet,
              selectedModalities.includes(mod.id) && styles.modalityCardSelected,
            ]}
            onPress={() => toggleSelection(selectedModalities, setSelectedModalities, mod.id)}
          >
            <Ionicons
              name={mod.icon as any}
              size={24}
              color={selectedModalities.includes(mod.id) ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.modalityText,
                selectedModalities.includes(mod.id) && styles.modalityTextSelected,
              ]}
            >
              {mod.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.navigationRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.nextButton,
            styles.nextButtonSmall,
            isTablet && styles.nextButtonTablet,
            selectedLevels.length === 0 && styles.buttonDisabled,
          ]}
          onPress={() => setStep(4)}
          disabled={selectedLevels.length === 0}
        >
          <Text style={[styles.nextButtonText, isTablet && styles.nextButtonTextTablet]}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, isDesktop && styles.stepTitleDesktop]}>Set your pricing</Text>
      <Text style={[styles.stepSubtitle, isDesktop && styles.stepSubtitleDesktop]}>How much do you charge per lesson?</Text>

      <Text style={[styles.inputLabel, isDesktop && styles.inputLabelDesktop]}>Hourly rate ($)</Text>
      <View style={[styles.priceInputContainer, isTablet && styles.priceInputContainerTablet]}>
        <Text style={[styles.dollarSign, isDesktop && styles.dollarSignDesktop]}>$</Text>
        <TextInput
          style={[styles.priceInput, isDesktop && styles.priceInputDesktop]}
          value={basePrice}
          onChangeText={setBasePrice}
          keyboardType="numeric"
          placeholder="50"
          placeholderTextColor={colors.textMuted}
        />
        <Text style={styles.perHour}>/hour</Text>
      </View>

      <Text style={[styles.inputLabel, isDesktop && styles.inputLabelDesktop]}>Default session length</Text>
      <View style={[styles.durationOptions, isTablet && styles.durationOptionsTablet]}>
        {['30', '45', '60', '90'].map((d) => (
          <TouchableOpacity
            key={d}
            style={[
              styles.durationOption,
              isTablet && styles.durationOptionTablet,
              duration === d && styles.durationOptionSelected,
            ]}
            onPress={() => setDuration(d)}
          >
            <Text
              style={[
                styles.durationText,
                isDesktop && styles.durationTextDesktop,
                duration === d && styles.durationTextSelected,
              ]}
            >
              {d} min
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.navigationRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => setStep(3)}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextButton, styles.nextButtonSmall, isTablet && styles.nextButtonTablet, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.nextButtonText, isTablet && styles.nextButtonTextTablet]}>Create Profile</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
          <View style={[styles.contentWrapper, contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : undefined]}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, isDesktop && styles.headerTitleDesktop]}>Create Profile</Text>
              <View style={styles.closeButton} />
            </View>

            {/* Progress */}
            <View style={[styles.progress, isTablet && styles.progressTablet]}>
              {[1, 2, 3, 4].map((s) => (
                <View
                  key={s}
                  style={[styles.progressStep, s <= step && styles.progressStepActive]}
                />
              ))}
            </View>

            {/* Steps */}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
            {step === 4 && renderStep4()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  scrollContentTablet: {
    paddingVertical: 32,
  },
  contentWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerTitleDesktop: {
    fontSize: 22,
  },
  progress: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 24,
  },
  progressTablet: {
    marginBottom: 32,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: colors.gray200,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: colors.primary,
  },
  stepContent: {
    paddingHorizontal: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  stepTitleDesktop: {
    fontSize: 28,
  },
  stepSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 24,
  },
  stepSubtitleDesktop: {
    fontSize: 16,
    marginBottom: 32,
  },
  bioInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    minHeight: 150,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  bioInputTablet: {
    borderRadius: 16,
    padding: 20,
    fontSize: 17,
    minHeight: 180,
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  nextButtonTablet: {
    borderRadius: 14,
    padding: 18,
  },
  nextButtonSmall: {
    flex: 1,
  },
  buttonDisabled: {
    backgroundColor: colors.gray300,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButtonTextTablet: {
    fontSize: 18,
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  optionsGridTablet: {
    gap: 16,
  },
  optionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionCardTablet: {
    borderRadius: 20,
    padding: 24,
  },
  optionCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  optionTextSelected: {
    color: colors.primary,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  subTitleDesktop: {
    fontSize: 18,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipTablet: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    color: colors.text,
  },
  chipTextSelected: {
    color: '#fff',
  },
  navigationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  levelsList: {
    gap: 8,
    marginBottom: 24,
  },
  levelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelItemTablet: {
    padding: 18,
    borderRadius: 14,
  },
  levelItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  levelText: {
    fontSize: 15,
    color: colors.text,
  },
  levelTextDesktop: {
    fontSize: 17,
  },
  levelTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  modalitiesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  modalityCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalityCardTablet: {
    padding: 20,
    borderRadius: 16,
  },
  modalityCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  modalityText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  modalityTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
  },
  inputLabelDesktop: {
    fontSize: 16,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  priceInputContainerTablet: {
    borderRadius: 14,
    paddingHorizontal: 20,
  },
  dollarSign: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
  },
  dollarSignDesktop: {
    fontSize: 28,
  },
  priceInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    paddingVertical: 16,
    marginLeft: 4,
  },
  priceInputDesktop: {
    fontSize: 28,
    paddingVertical: 18,
  },
  perHour: {
    fontSize: 16,
    color: colors.textMuted,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  durationOptionsTablet: {
    gap: 12,
  },
  durationOption: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  durationOptionTablet: {
    padding: 18,
    borderRadius: 14,
  },
  durationOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  durationText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },
  durationTextDesktop: {
    fontSize: 16,
  },
  durationTextSelected: {
    color: colors.primary,
  },
});
