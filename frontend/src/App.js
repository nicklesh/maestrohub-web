import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { I18nProvider } from './i18n';

// Components
import BottomNav from './components/BottomNav';

// Auth Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

// Consumer Pages
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import ProfilePage from './pages/ProfilePage';
import BookingsPage from './pages/BookingsPage';
import KidsPage from './pages/KidsPage';
import TutorDetailPage from './pages/TutorDetailPage';
import BillingPage from './pages/BillingPage';
import ReferralsPage from './pages/ReferralsPage';
import ReviewsPage from './pages/ReviewsPage';
import FAQPage from './pages/FAQPage';
import ContactPage from './pages/ContactPage';
import NotificationsSettingsPage from './pages/NotificationsSettingsPage';
import EditProfilePage from './pages/EditProfilePage';
import LanguagePage from './pages/LanguagePage';
import NotificationsPage from './pages/NotificationsPage';
import SubscriptionPage from './pages/SubscriptionPage';
import RemindersPage from './pages/RemindersPage';
import ReportsPage from './pages/ReportsPage';
import TaxReportsPage from './pages/TaxReportsPage';
import InviteParentPage from './pages/InviteParentPage';
import InviteProviderPage from './pages/InviteProviderPage';
import BecomeTutorPage from './pages/BecomeTutorPage';

// Tutor Pages
import TutorDashboardPage from './pages/TutorDashboardPage';
import TutorCalendarPage from './pages/TutorCalendarPage';

// Admin Pages
import AdminDashboardPage from './pages/AdminDashboardPage';

// Protected Route Wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'var(--background)'
      }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (user.role === 'tutor') {
      return <Navigate to="/tutor/dashboard" replace />;
    }
    return <Navigate to="/home" replace />;
  }

  return children;
};

// Auth Route (redirect if already logged in)
const AuthRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'var(--background)'
      }}>
        <div className="spinner" />
      </div>
    );
  }

  if (user) {
    // Redirect based on role
    if (user.role === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (user.role === 'tutor') {
      return <Navigate to="/tutor/dashboard" replace />;
    }
    return <Navigate to="/home" replace />;
  }

  return children;
};

// Theme loader component
const ThemeLoader = ({ children }) => {
  const { user, loading } = useAuth();
  const { loadUserTheme, resetToDefault } = useTheme();

  useEffect(() => {
    if (user?.user_id) {
      loadUserTheme(user.user_id);
    } else if (!loading) {
      resetToDefault();
    }
  }, [user?.user_id, loading, loadUserTheme, resetToDefault]);

  return children;
};

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  
  // Hide bottom nav on auth pages
  const hideBottomNav = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'].includes(location.pathname);
  
  return (
    <ThemeLoader>
      <div className="app-container">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
          <Route path="/register" element={<AuthRoute><RegisterPage /></AuthRoute>} />
          <Route path="/forgot-password" element={<AuthRoute><ForgotPasswordPage /></AuthRoute>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* Consumer routes */}
          <Route path="/home" element={<ProtectedRoute allowedRoles={['consumer', 'parent']}><HomePage /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute allowedRoles={['consumer', 'parent']}><SearchPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/bookings" element={<ProtectedRoute><BookingsPage /></ProtectedRoute>} />
          <Route path="/kids" element={<ProtectedRoute allowedRoles={['consumer', 'parent']}><KidsPage /></ProtectedRoute>} />
          <Route path="/tutor/:tutorId" element={<ProtectedRoute><TutorDetailPage /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute><BillingPage /></ProtectedRoute>} />
          <Route path="/referrals" element={<ProtectedRoute><ReferralsPage /></ProtectedRoute>} />
          <Route path="/reviews" element={<ProtectedRoute><ReviewsPage /></ProtectedRoute>} />
          <Route path="/faq" element={<ProtectedRoute><FAQPage /></ProtectedRoute>} />
          <Route path="/contact" element={<ProtectedRoute><ContactPage /></ProtectedRoute>} />
          <Route path="/notifications-settings" element={<ProtectedRoute><NotificationsSettingsPage /></ProtectedRoute>} />
          <Route path="/edit-profile" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
          <Route path="/language" element={<ProtectedRoute><LanguagePage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
          <Route path="/reminders" element={<ProtectedRoute><RemindersPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/tax-reports" element={<ProtectedRoute><TaxReportsPage /></ProtectedRoute>} />
          <Route path="/invite-parent" element={<ProtectedRoute><InviteParentPage /></ProtectedRoute>} />
          <Route path="/invite-provider" element={<ProtectedRoute><InviteProviderPage /></ProtectedRoute>} />
          <Route path="/become-tutor" element={<ProtectedRoute allowedRoles={['consumer', 'parent']}><BecomeTutorPage /></ProtectedRoute>} />

          {/* Tutor routes */}
          <Route path="/tutor/dashboard" element={<ProtectedRoute allowedRoles={['tutor', 'admin']}><TutorDashboardPage /></ProtectedRoute>} />
          <Route path="/tutor/calendar" element={<ProtectedRoute allowedRoles={['tutor', 'admin']}><TutorCalendarPage /></ProtectedRoute>} />
          <Route path="/tutor/billing" element={<ProtectedRoute allowedRoles={['tutor', 'admin']}><BillingPage /></ProtectedRoute>} />
          <Route path="/tutor/reviews" element={<ProtectedRoute allowedRoles={['tutor', 'admin']}><ReviewsPage /></ProtectedRoute>} />

          {/* Admin routes */}
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboardPage /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        
        {/* Bottom Navigation - shown on all authenticated pages */}
        {user && !hideBottomNav && <BottomNav />}
      </div>
    </ThemeLoader>
  );
}

function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

export default App;
