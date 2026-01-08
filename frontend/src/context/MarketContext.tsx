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
      try {
        const geoResponse = await api.get('/geo/detect');
        setDetectedCountry(geoResponse.data.detected_country);
        setSuggestedMarketId(geoResponse.data.suggested_market_id);
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
            setNeedsSelection(true);
          }
        } catch (e) {
          // User not authenticated or no market set
          setNeedsSelection(true);
        }
      } else {
        // Check local storage for market preference
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
          setNeedsSelection(true);
        }
      }
    } catch (error) {
      console.error('Failed to load market data:', error);
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
