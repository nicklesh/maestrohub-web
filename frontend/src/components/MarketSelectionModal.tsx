import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { useMarket, Market } from '@/src/context/MarketContext';

interface MarketSelectionModalProps {
  visible: boolean;
  onClose?: () => void;
  canDismiss?: boolean;
}

const FLAG_IMAGES: Record<string, string> = {
  US: '🇺🇸',
  IN: '🇮🇳',
};

export default function MarketSelectionModal({
  visible,
  onClose,
  canDismiss = false,
}: MarketSelectionModalProps) {
  const { width } = useWindowDimensions();
  const { markets, suggestedMarketId, selectMarket, loading } = useMarket();
  const [selectedId, setSelectedId] = useState<string | null>(suggestedMarketId);
  const [submitting, setSubmitting] = useState(false);

  // Responsive breakpoints
  const isTablet = width >= 768;
  const contentMaxWidth = isTablet ? 480 : width * 0.9;

  const handleSelect = async () => {
    if (!selectedId) return;

    setSubmitting(true);
    try {
      await selectMarket(selectedId);
      onClose?.();
    } catch (error) {
      console.error('Failed to select market:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.content, { maxWidth: contentMaxWidth }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.content, { maxWidth: contentMaxWidth }, isTablet && styles.contentTablet]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, isTablet && styles.titleTablet]}>Select Your Region</Text>
            <Text style={[styles.subtitle, isTablet && styles.subtitleTablet]}>
              Choose where you're located to see tutors and prices in your currency.
            </Text>
          </View>

          {/* Market Options */}
          <View style={styles.options}>
            {markets.map((market) => (
              <TouchableOpacity
                key={market.market_id}
                style={[
                  styles.marketCard,
                  isTablet && styles.marketCardTablet,
                  selectedId === market.market_id && styles.marketCardSelected,
                ]}
                onPress={() => setSelectedId(market.market_id)}
              >
                <Text style={[styles.flag, isTablet && styles.flagTablet]}>
                  {FLAG_IMAGES[market.country] || '🌍'}
                </Text>
                <View style={styles.marketInfo}>
                  <Text style={[styles.marketName, isTablet && styles.marketNameTablet]}>
                    {market.country === 'US' ? 'United States' : 'India'}
                  </Text>
                  <Text style={styles.marketCurrency}>
                    {market.currency_symbol} {market.currency}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    selectedId === market.market_id && styles.radioSelected,
                  ]}
                >
                  {selectedId === market.market_id && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
                {suggestedMarketId === market.market_id && (
                  <View style={styles.suggestedBadge}>
                    <Text style={styles.suggestedText}>Detected</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Info Note */}
          <View style={[styles.infoNote, isTablet && styles.infoNoteTablet]}>
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <Text style={styles.infoText}>
              You can change your region later in settings. Tutors are only shown from your selected region.
            </Text>
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              isTablet && styles.continueButtonTablet,
              (!selectedId || submitting) && styles.buttonDisabled,
            ]}
            onPress={handleSelect}
            disabled={!selectedId || submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.continueButtonText, isTablet && styles.continueButtonTextTablet]}>
                Continue
              </Text>
            )}
          </TouchableOpacity>

          {canDismiss && (
            <TouchableOpacity style={styles.dismissButton} onPress={onClose}>
              <Text style={styles.dismissText}>Maybe Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 24,
    width: '100%',
  },
  contentTablet: {
    borderRadius: 28,
    padding: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  titleTablet: {
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitleTablet: {
    fontSize: 16,
  },
  options: {
    gap: 12,
    marginBottom: 20,
  },
  marketCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  marketCardTablet: {
    padding: 20,
    borderRadius: 20,
  },
  marketCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  flag: {
    fontSize: 32,
    marginRight: 12,
  },
  flagTablet: {
    fontSize: 40,
    marginRight: 16,
  },
  marketInfo: {
    flex: 1,
  },
  marketName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  marketNameTablet: {
    fontSize: 18,
  },
  marketCurrency: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 2,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  suggestedBadge: {
    position: 'absolute',
    top: -8,
    right: 12,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  suggestedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoNoteTablet: {
    padding: 16,
    borderRadius: 14,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.primaryDark,
    lineHeight: 18,
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  continueButtonTablet: {
    paddingVertical: 18,
    borderRadius: 16,
  },
  buttonDisabled: {
    backgroundColor: colors.gray300,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButtonTextTablet: {
    fontSize: 18,
  },
  dismissButton: {
    marginTop: 12,
    alignItems: 'center',
    padding: 12,
  },
  dismissText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
