import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Switch,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { api } from '@/src/services/api';
import AppHeader from '@/src/components/AppHeader';

interface MarketPricing {
  market_id: string;
  market_display: string;
  market_flag: string;
  market_code: string;
  currency: string;
  currency_symbol: string;
  min_price: number;
  max_price: number;
  current_price: number | null;
  recommended_price: number | null;
  exchange_rate: number | null;
  is_base_market: boolean;
  is_enabled: boolean;
}

interface MarketPricingData {
  base_price: number;
  base_market: string;
  market_pricing: MarketPricing[];
  enabled_markets: string[];
  modality: string[];
}

export default function MarketSettings() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError } = useToast();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<MarketPricingData | null>(null);
  const [enabledMarkets, setEnabledMarkets] = useState<string[]>([]);
  const [marketPrices, setMarketPrices] = useState<Record<string, string>>({});

  const isTablet = width >= 768;
  const isDesktop = width >= 1024;
  const styles = getStyles(colors);

  useEffect(() => {
    loadMarketPricing();
  }, []);

  const loadMarketPricing = async () => {
    try {
      const response = await api.get('/tutors/market-pricing', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(response.data);
      setEnabledMarkets(response.data.enabled_markets || []);
      
      // Initialize price inputs with current prices
      const prices: Record<string, string> = {};
      response.data.market_pricing.forEach((m: MarketPricing) => {
        if (m.current_price !== null) {
          prices[m.market_id] = m.current_price.toString();
        }
      });
      setMarketPrices(prices);
    } catch (error) {
      console.error('Failed to load market pricing:', error);
      showError('Failed to load market settings');
    } finally {
      setLoading(false);
    }
  };

  const toggleMarket = (marketId: string) => {
    if (enabledMarkets.includes(marketId)) {
      setEnabledMarkets(enabledMarkets.filter(m => m !== marketId));
    } else {
      setEnabledMarkets([...enabledMarkets, marketId]);
    }
  };

  const handlePriceChange = (marketId: string, value: string) => {
    // Only allow numbers and decimals
    const cleaned = value.replace(/[^0-9.]/g, '');
    setMarketPrices({ ...marketPrices, [marketId]: cleaned });
  };

  const useRecommendedPrice = (marketId: string, recommendedPrice: number | null) => {
    if (recommendedPrice !== null) {
      setMarketPrices({ ...marketPrices, [marketId]: recommendedPrice.toString() });
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Convert string prices to numbers
      const pricesObj: Record<string, number> = {};
      Object.entries(marketPrices).forEach(([key, value]) => {
        if (value && !isNaN(parseFloat(value))) {
          pricesObj[key] = parseFloat(value);
        }
      });

      await api.put('/tutors/market-pricing', {
        market_prices: pricesObj,
        enabled_markets: enabledMarkets
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showSuccess('Market settings saved successfully');
      router.back();
    } catch (error: any) {
      console.error('Failed to save market pricing:', error);
      const msg = error.response?.data?.detail || 'Failed to save settings';
      showError(typeof msg === 'string' ? msg : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader title="Market Settings" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const canEnableMarkets = data?.modality?.includes('online') || data?.modality?.includes('hybrid');

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Market Settings" showBack />
      <ScrollView contentContainerStyle={[styles.scrollContent, isTablet && styles.scrollContentTablet]}>
        <View style={[styles.contentWrapper, isDesktop && { maxWidth: 640, alignSelf: 'center', width: '100%' }]}>
          
          {/* Info Card */}
          <View style={[styles.card, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>
              {canEnableMarkets 
                ? "Since you offer online/hybrid sessions, you can enable other markets to reach more students globally."
                : "Multi-market exposure is only available for coaches with online or hybrid modality."}
            </Text>
          </View>

          {/* Base Market Info */}
          {data && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Your Base Market</Text>
              <View style={styles.baseMarketRow}>
                {data.market_pricing.filter(m => m.is_base_market).map(m => (
                  <View key={m.market_id} style={styles.marketBadge}>
                    <Text style={styles.marketFlag}>{m.market_flag}</Text>
                    <Text style={[styles.marketCode, { color: colors.text }]}>{m.market_code}</Text>
                    <Text style={[styles.basePrice, { color: colors.textMuted }]}>
                      {m.currency_symbol}{data.base_price}/hr
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Market List */}
          {canEnableMarkets && data && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Enable Other Markets</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Toggle markets where you want to appear in search results and set custom prices
              </Text>
              
              {data.market_pricing.filter(m => !m.is_base_market).map(market => (
                <View key={market.market_id} style={[styles.marketItem, { borderColor: colors.border }]}>
                  <View style={styles.marketHeader}>
                    <View style={styles.marketInfo}>
                      <Text style={styles.marketFlagLarge}>{market.market_flag}</Text>
                      <View>
                        <Text style={[styles.marketName, { color: colors.text }]}>{market.market_code}</Text>
                        <Text style={[styles.marketCurrency, { color: colors.textMuted }]}>
                          {market.currency} ({market.currency_symbol})
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={enabledMarkets.includes(market.market_id)}
                      onValueChange={() => toggleMarket(market.market_id)}
                      trackColor={{ false: colors.gray300, true: colors.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                  
                  {enabledMarkets.includes(market.market_id) && (
                    <View style={styles.priceSection}>
                      <Text style={[styles.priceLabel, { color: colors.textMuted }]}>
                        Your price for this market:
                      </Text>
                      <View style={styles.priceRow}>
                        <Text style={[styles.currencySymbol, { color: colors.text }]}>
                          {market.currency_symbol}
                        </Text>
                        <TextInput
                          style={[styles.priceInput, { 
                            backgroundColor: colors.background, 
                            borderColor: colors.border,
                            color: colors.text 
                          }]}
                          value={marketPrices[market.market_id] || ''}
                          onChangeText={(val) => handlePriceChange(market.market_id, val)}
                          placeholder={market.recommended_price?.toString() || '0'}
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                        />
                        <Text style={[styles.perHour, { color: colors.textMuted }]}>/hr</Text>
                      </View>
                      
                      {market.recommended_price && (
                        <TouchableOpacity 
                          style={[styles.recommendedButton, { borderColor: colors.primary }]}
                          onPress={() => useRecommendedPrice(market.market_id, market.recommended_price)}
                        >
                          <Ionicons name="sparkles" size={14} color={colors.primary} />
                          <Text style={[styles.recommendedText, { color: colors.primary }]}>
                            Use recommended: {market.currency_symbol}{market.recommended_price}
                          </Text>
                        </TouchableOpacity>
                      )}
                      
                      <Text style={[styles.priceHint, { color: colors.textMuted }]}>
                        Range: {market.currency_symbol}{market.min_price} - {market.currency_symbol}{market.max_price}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Save Button */}
          {canEnableMarkets && (
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }, saving && { opacity: 0.7 }]}
              onPress={saveSettings}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save Market Settings</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
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
  scrollContent: {
    padding: 16,
  },
  scrollContentTablet: {
    padding: 24,
  },
  contentWrapper: {
    flex: 1,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'column',
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  baseMarketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  marketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marketFlag: {
    fontSize: 24,
  },
  marketFlagLarge: {
    fontSize: 32,
  },
  marketCode: {
    fontSize: 16,
    fontWeight: '600',
  },
  basePrice: {
    fontSize: 14,
  },
  marketItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  marketInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  marketName: {
    fontSize: 16,
    fontWeight: '600',
  },
  marketCurrency: {
    fontSize: 12,
  },
  priceSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  priceLabel: {
    fontSize: 13,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  perHour: {
    fontSize: 14,
  },
  recommendedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  recommendedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  priceHint: {
    fontSize: 11,
    marginTop: 8,
  },
  saveButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
