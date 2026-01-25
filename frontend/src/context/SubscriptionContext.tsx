import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

// Types
interface SubscriptionPlan {
  plan_id: string;
  name: string;
  price_cents: number;
  currency: string;
  interval: string;
  interval_count: number;
  features: string[];
  price_display: string;
  savings?: string;
}

interface BookingLimit {
  allowed: boolean;
  remaining: number;
  limit: number;
  used?: number;
}

interface SubscriptionStatus {
  subscription_id: string | null;
  user_id: string;
  plan_id: string;
  status: 'trial' | 'active' | 'cancelled' | 'expired' | 'free';
  is_premium: boolean;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  payment_method?: string;
  features: string[];
  days_remaining?: number;
  limits?: {
    bookings_per_month: number;
    coaches_visible: number;
    features_enabled: string[];
  };
  booking_limit: BookingLimit;
}

interface SubscriptionPlansResponse {
  plans: SubscriptionPlan[];
  free_tier: {
    bookings_per_month: number;
    coaches_visible: number;
    features_enabled: string[];
  };
  trial_days: number;
}

interface SubscriptionContextType {
  subscription: SubscriptionStatus | null;
  plans: SubscriptionPlan[];
  freeTier: SubscriptionPlansResponse['free_tier'] | null;
  trialDays: number;
  loading: boolean;
  error: string | null;
  isPremium: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number | null;
  canBook: boolean;
  bookingsRemaining: number | null;
  
  // Feature checks
  hasFeature: (feature: string) => boolean;
  
  // Actions
  refreshSubscription: () => Promise<void>;
  subscribe: (planId: string, paymentMethod: string) => Promise<boolean>;
  cancelSubscription: () => Promise<boolean>;
  reactivateSubscription: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

// Premium features list
const PREMIUM_FEATURES = [
  'unlimited_bookings',
  'all_coaches_access',
  'video_recordings',
  'reports_analytics',
  'billing_tax_reports',
  'reminders',
  'notifications',
  'reviews',
  'ad_free'
];

interface SubscriptionProviderProps {
  children: ReactNode;
}

export const SubscriptionProvider: React.FC<SubscriptionProviderProps> = ({ children }) => {
  const { user, token } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [freeTier, setFreeTier] = useState<SubscriptionPlansResponse['free_tier'] | null>(null);
  const [trialDays, setTrialDays] = useState<number>(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch subscription plans (public endpoint)
  const fetchPlans = useCallback(async () => {
    try {
      const response = await api.get('/subscription/plans');
      if (response.data) {
        setPlans(response.data.plans || []);
        setFreeTier(response.data.free_tier || null);
        setTrialDays(response.data.trial_days || 14);
      }
    } catch (err) {
      console.error('Error fetching subscription plans:', err);
    }
  }, []);

  // Fetch current user's subscription status
  const refreshSubscription = useCallback(async () => {
    if (!token || !user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const response = await api.get('/subscription/status');
      if (response.data) {
        setSubscription(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching subscription status:', err);
      setError(err.response?.data?.detail || 'Failed to fetch subscription status');
      // Set a default free subscription on error
      setSubscription({
        subscription_id: null,
        user_id: user?.user_id || '',
        plan_id: 'free',
        status: 'free',
        is_premium: false,
        trial_ends_at: null,
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        features: ['basic_search', 'basic_booking', 'view_profile'],
        booking_limit: { allowed: true, remaining: 15, limit: 15 }
      });
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  // Subscribe to a plan
  const subscribe = useCallback(async (planId: string, paymentMethod: string): Promise<boolean> => {
    if (!token) return false;

    try {
      setError(null);
      const response = await api.post('/subscription/create', {
        plan_id: planId,
        payment_method: paymentMethod
      });
      
      if (response.data?.success) {
        await refreshSubscription();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error creating subscription:', err);
      setError(err.response?.data?.detail || 'Failed to create subscription');
      return false;
    }
  }, [token, refreshSubscription]);

  // Cancel subscription
  const cancelSubscription = useCallback(async (): Promise<boolean> => {
    if (!token) return false;

    try {
      setError(null);
      const response = await api.post('/subscription/cancel');
      
      if (response.data?.success) {
        await refreshSubscription();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error cancelling subscription:', err);
      setError(err.response?.data?.detail || 'Failed to cancel subscription');
      return false;
    }
  }, [token, refreshSubscription]);

  // Reactivate cancelled subscription
  const reactivateSubscription = useCallback(async (): Promise<boolean> => {
    if (!token) return false;

    try {
      setError(null);
      const response = await api.post('/subscription/reactivate');
      
      if (response.data?.success) {
        await refreshSubscription();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('Error reactivating subscription:', err);
      setError(err.response?.data?.detail || 'Failed to reactivate subscription');
      return false;
    }
  }, [token, refreshSubscription]);

  // Check if user has a specific feature
  const hasFeature = useCallback((feature: string): boolean => {
    if (!subscription) return false;
    
    // Premium users have all premium features
    if (subscription.is_premium) {
      return PREMIUM_FEATURES.includes(feature) || subscription.features.includes(feature);
    }
    
    // Free users only have basic features
    return subscription.features.includes(feature);
  }, [subscription]);

  // Derived state
  const isPremium = subscription?.is_premium || false;
  const isTrialActive = subscription?.status === 'trial';
  const trialDaysRemaining = subscription?.days_remaining ?? null;
  const canBook = subscription?.booking_limit?.allowed ?? true;
  const bookingsRemaining = subscription?.booking_limit?.remaining ?? null;

  // Fetch plans on mount
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Fetch subscription when user logs in
  useEffect(() => {
    if (user && token) {
      refreshSubscription();
    } else {
      setSubscription(null);
      setLoading(false);
    }
  }, [user, token, refreshSubscription]);

  const value: SubscriptionContextType = {
    subscription,
    plans,
    freeTier,
    trialDays,
    loading,
    error,
    isPremium,
    isTrialActive,
    trialDaysRemaining,
    canBook,
    bookingsRemaining,
    hasFeature,
    refreshSubscription,
    subscribe,
    cancelSubscription,
    reactivateSubscription
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export default SubscriptionContext;
