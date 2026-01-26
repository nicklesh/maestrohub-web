import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

export interface Market {
  market_id: string;
  country: string;
  currency: string;
  currency_symbol: string;
  default_timezone: string;
  is_enabled: boolean;
  min_price: number;
  max_price: number;
}

interface MarketContextType {
  markets: Market[];
  currentMarket: Market | null;
  needsSelection: boolean;
  detectedCountry: string | null;
  suggestedMarketId: string | null;
  loading: boolean;
  selectMarket: (marketId: string) => Promise<void>;
  refreshMarket: () => Promise<void>;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export function MarketProvider({ children }: { children: ReactNode }) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [currentMarket, setCurrentMarket] = useState<Market | null>(null);
  const [needsSelection, setNeedsSelection] = useState(false);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [suggestedMarketId, setSuggestedMarketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMarketData();
  }, []);

  const loadMarketData = async () => {
    try {
      // Load available markets
      const marketsResponse = await api.get('/markets');
      setMarkets(marketsResponse.data.markets);

      // Try to detect country from IP
      let geoData: { detected_country?: string; suggested_market_id?: string; market_id?: string } = {};
      try {
        const geoResponse = await api.get('/geo/detect');
        geoData = geoResponse.data;
        setDetectedCountry(geoData.detected_country || null);
        setSuggestedMarketId(geoData.suggested_market_id || null);
      } catch (e) {
        console.log('Geo detection not available');
      }

      // Check if user has a market set (if authenticated)
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          const marketResponse = await api.get('/me/market');
          if (marketResponse.data.market) {
            setCurrentMarket(marketResponse.data.market);
            setNeedsSelection(false);
          } else {
            // For authenticated users without market, use suggested market automatically
            // Market selection should only be prompted during registration, not login
            const suggestedId = geoData.suggested_market_id || geoData.market_id;
            if (suggestedId) {
              const suggestedMarket = marketsResponse.data.markets.find(
                (m: Market) => m.market_id === suggestedId
              );
              if (suggestedMarket) {
                setCurrentMarket(suggestedMarket);
                // Auto-save this market for the user
                try {
                  await api.put('/me/market', { market_id: suggestedMarket.market_id });
                } catch (e) {
                  console.error('Failed to auto-save market:', e);
                }
                setNeedsSelection(false);
              } else {
                // Fallback to first available market instead of showing modal
                if (marketsResponse.data.markets.length > 0) {
                  const fallbackMarket = marketsResponse.data.markets[0];
                  setCurrentMarket(fallbackMarket);
                  try {
                    await api.put('/me/market', { market_id: fallbackMarket.market_id });
                  } catch (e) {
                    console.error('Failed to auto-save fallback market:', e);
                  }
                  setNeedsSelection(false);
                } else {
                  setNeedsSelection(true);
                }
              }
            } else {
              // No geo data available - use first market as fallback for authenticated users
              if (marketsResponse.data.markets.length > 0) {
                const fallbackMarket = marketsResponse.data.markets[0];
                setCurrentMarket(fallbackMarket);
                try {
                  await api.put('/me/market', { market_id: fallbackMarket.market_id });
                } catch (e) {
                  console.error('Failed to auto-save fallback market:', e);
                }
                setNeedsSelection(false);
              } else {
                setNeedsSelection(true);
              }
            }
          }
        } catch (e) {
          // User not authenticated or no market set - don't show modal for logged in users
          // Just use the first available market
          if (marketsResponse.data.markets.length > 0) {
            const fallbackMarket = marketsResponse.data.markets[0];
            setCurrentMarket(fallbackMarket);
            setNeedsSelection(false);
          } else {
            setNeedsSelection(true);
          }
        }
      } else {
        // Check local storage for market preference (for non-authenticated users)
        const storedMarketId = await AsyncStorage.getItem('selected_market_id');
        if (storedMarketId && marketsResponse.data.markets) {
          const found = marketsResponse.data.markets.find(
            (m: Market) => m.market_id === storedMarketId
          );
          if (found) {
            setCurrentMarket(found);
            setNeedsSelection(false);
          } else {
            setNeedsSelection(true);
          }
        } else {
          // For non-authenticated users without stored preference, show selection
          setNeedsSelection(true);
        }
      }
    } catch (error) {
      console.error('Failed to load market data:', error);
      // On error, don't show modal - just set loading to false
      setNeedsSelection(false);
    } finally {
      setLoading(false);
    }
  };

  const selectMarket = async (marketId: string) => {
    try {
      const market = markets.find((m) => m.market_id === marketId);
      if (!market) {
        throw new Error('Invalid market');
      }

      // Save locally
      await AsyncStorage.setItem('selected_market_id', marketId);
      setCurrentMarket(market);
      setNeedsSelection(false);

      // Try to save to backend if authenticated
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          await api.post('/me/market', { market_id: marketId });
        } catch (e) {
          // Silently fail - local storage is the fallback
          console.log('Could not save market to server');
        }
      }
    } catch (error) {
      console.error('Failed to select market:', error);
      throw error;
    }
  };

  const refreshMarket = async () => {
    setLoading(true);
    await loadMarketData();
  };

  return (
    <MarketContext.Provider
      value={{
        markets,
        currentMarket,
        needsSelection,
        detectedCountry,
        suggestedMarketId,
        loading,
        selectMarket,
        refreshMarket,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
}

export function useMarket() {
  const context = useContext(MarketContext);
  if (context === undefined) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
}
