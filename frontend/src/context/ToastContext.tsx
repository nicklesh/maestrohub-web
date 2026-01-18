import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const TOAST_COLORS = {
  success: {
    bg: '#10B981',
    bgLight: '#D1FAE5',
    text: '#065F46',
    icon: 'checkmark-circle' as const,
  },
  error: {
    bg: '#EF4444',
    bgLight: '#FEE2E2',
    text: '#991B1B',
    icon: 'close-circle' as const,
  },
  info: {
    bg: '#3B82F6',
    bgLight: '#DBEAFE',
    text: '#1E40AF',
    icon: 'information-circle' as const,
  },
  warning: {
    bg: '#F59E0B',
    bgLight: '#FEF3C7',
    text: '#92400E',
    icon: 'warning' as const,
  },
};

const ToastItem: React.FC<{
  toast: Toast;
  onHide: (id: string) => void;
  index: number;
}> = ({ toast, onHide, index }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const colors = TOAST_COLORS[toast.type];

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide
    const timer = setTimeout(() => {
      hideWithAnimation();
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, []);

  const hideWithAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide(toast.id);
    });
  };

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          backgroundColor: colors.bgLight,
          borderLeftColor: colors.bg,
          opacity: fadeAnim,
          transform: [{ translateY }],
          marginTop: index > 0 ? 8 : 0,
        },
      ]}
    >
      <View style={styles.toastContent}>
        <Ionicons name={colors.icon} size={22} color={colors.bg} style={styles.icon} />
        <View style={styles.textContainer}>
          {toast.title && (
            <Text style={[styles.title, { color: colors.text }]}>{toast.title}</Text>
          )}
          <Text style={[styles.message, { color: colors.text }]} numberOfLines={3}>
            {toast.message}
          </Text>
        </View>
        <TouchableOpacity
          onPress={hideWithAnimation}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration: number = 5000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setToasts((prev) => [...prev, { id, type, message, title, duration }]);
    },
    []
  );

  const showSuccess = useCallback(
    (message: string, title?: string) => showToast('success', message, title),
    [showToast]
  );

  const showError = useCallback(
    (message: string, title?: string) => showToast('error', message, title),
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, title?: string) => showToast('info', message, title),
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, title?: string) => showToast('warning', message, title),
    [showToast]
  );

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider
      value={{ showToast, showSuccess, showError, showInfo, showWarning, hideToast }}
    >
      {children}
      <View
        style={[
          styles.toastWrapper,
          {
            top: Platform.OS === 'web' ? 16 : insets.top + 8,
          },
        ]}
        pointerEvents="box-none"
      >
        {toasts.map((toast, index) => (
          <ToastItem key={toast.id} toast={toast} onHide={hideToast} index={index} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastContainer: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    paddingRight: 8,
  },
  icon: {
    marginRight: 10,
    marginTop: 1,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default ToastProvider;
