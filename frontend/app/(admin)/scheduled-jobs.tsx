import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  useWindowDimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface ScheduledJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  schedule_display: string;
  enabled: boolean;
  last_run: string | null;
  last_status: 'success' | 'failed' | 'pending' | 'never';
  next_run: string | null;
  can_trigger_manually: boolean;
  settings?: {
    day_of_month?: number;
    hour?: number;
    minute?: number;
  };
}

// Default scheduled jobs configuration
const DEFAULT_JOBS: ScheduledJob[] = [
  {
    id: 'monthly_reports',
    name: 'Monthly Tax Reports',
    description: 'Generate monthly payment summary reports for all users with transactions',
    schedule: '0 2 1 * *',
    schedule_display: '1st of every month at 2:00 AM',
    enabled: true,
    last_run: null,
    last_status: 'never',
    next_run: null,
    can_trigger_manually: true,
    settings: { day_of_month: 1, hour: 2, minute: 0 }
  },
  {
    id: 'annual_1099_reports',
    name: 'Annual 1099 Reports',
    description: 'Generate annual tax documents (1099 equivalent) for all providers',
    schedule: '0 3 1 1 *',
    schedule_display: 'January 1st at 3:00 AM',
    enabled: true,
    last_run: null,
    last_status: 'never',
    next_run: null,
    can_trigger_manually: true,
    settings: { day_of_month: 1, hour: 3, minute: 0 }
  },
  {
    id: 'session_reminders',
    name: 'Session Reminders',
    description: 'Send reminder notifications for upcoming sessions (24h and 1h before)',
    schedule: '0 * * * *',
    schedule_display: 'Every hour',
    enabled: true,
    last_run: null,
    last_status: 'never',
    next_run: null,
    can_trigger_manually: true,
  },
  {
    id: 'kid_notifications',
    name: 'Kid Session Notifications',
    description: 'Send session reminders to kids via email/SMS',
    schedule: '0 8 * * *',
    schedule_display: 'Daily at 8:00 AM',
    enabled: true,
    last_run: null,
    last_status: 'never',
    next_run: null,
    can_trigger_manually: true,
    settings: { hour: 8, minute: 0 }
  },
  {
    id: 'expired_holds_cleanup',
    name: 'Expired Holds Cleanup',
    description: 'Remove expired booking holds from the system',
    schedule: '*/15 * * * *',
    schedule_display: 'Every 15 minutes',
    enabled: true,
    last_run: null,
    last_status: 'never',
    next_run: null,
    can_trigger_manually: false,
  },
  {
    id: 'referral_check',
    name: 'Referral Qualification Check',
    description: 'Check and process referral rewards for qualified users',
    schedule: '0 0 * * *',
    schedule_display: 'Daily at midnight',
    enabled: true,
    last_run: null,
    last_status: 'never',
    next_run: null,
    can_trigger_manually: true,
  },
];

export default function ScheduledJobsScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { width } = useWindowDimensions();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<ScheduledJob[]>(DEFAULT_JOBS);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<string | null>(null);

  const isTablet = width >= 768;

  const loadJobs = useCallback(async () => {
    try {
      // Try to load jobs from backend, fall back to defaults
      const response = await api.get('/admin/scheduled-jobs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.jobs) {
        setJobs(response.data.jobs);
      }
    } catch (error) {
      // Use default jobs if endpoint doesn't exist yet
      console.log('Using default scheduled jobs configuration');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleToggleJob = async (jobId: string, enabled: boolean) => {
    // Update locally first for instant feedback
    setJobs(prev => prev.map(job => 
      job.id === jobId ? { ...job, enabled } : job
    ));
    
    try {
      await api.patch(`/admin/scheduled-jobs/${jobId}`, 
        { enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showSuccess(`Job ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      // Revert on error
      setJobs(prev => prev.map(job => 
        job.id === jobId ? { ...job, enabled: !enabled } : job
      ));
      showError('Failed to update job status');
    }
  };

  const handleRunNow = async (job: ScheduledJob) => {
    setRunningJob(job.id);
    try {
      let endpoint = '';
      let params = {};
      
      // Map job to actual API endpoint
      switch (job.id) {
        case 'monthly_reports':
          const now = new Date();
          const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
          const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
          endpoint = `/admin/tax-reports/generate-monthly?year=${year}&month=${lastMonth}`;
          break;
        case 'annual_1099_reports':
          endpoint = `/admin/tax-reports/generate-annual?year=${new Date().getFullYear() - 1}`;
          break;
        case 'session_reminders':
          endpoint = '/admin/send-session-reminders';
          break;
        case 'kid_notifications':
          endpoint = '/admin/send-kid-notifications';
          break;
        case 'referral_check':
          endpoint = '/admin/process-referrals';
          break;
        default:
          showInfo('This job cannot be triggered manually');
          setRunningJob(null);
          return;
      }
      
      const response = await api.post(endpoint, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      showSuccess(`${job.name} completed successfully!`, 'Job Executed');
      
      // Update last run status
      setJobs(prev => prev.map(j => 
        j.id === job.id 
          ? { ...j, last_run: new Date().toISOString(), last_status: 'success' as const } 
          : j
      ));
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to run job';
      showError(errorMsg);
      
      setJobs(prev => prev.map(j => 
        j.id === job.id 
          ? { ...j, last_run: new Date().toISOString(), last_status: 'failed' as const } 
          : j
      ));
    } finally {
      setRunningJob(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return colors.success;
      case 'failed':
        return colors.error;
      case 'pending':
        return colors.warning;
      default:
        return colors.textMuted;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return 'checkmark-circle';
      case 'failed':
        return 'close-circle';
      case 'pending':
        return 'time';
      default:
        return 'help-circle';
    }
  };

  const formatLastRun = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderJobCard = (job: ScheduledJob) => {
    const isRunning = runningJob === job.id;
    const isEditing = editingJob === job.id;
    
    return (
      <View 
        key={job.id} 
        style={[
          styles.jobCard, 
          { backgroundColor: colors.surface, borderColor: colors.border },
          !job.enabled && styles.jobDisabled
        ]}
      >
        <View style={styles.jobHeader}>
          <View style={styles.jobTitleRow}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(job.last_status) }]} />
            <Text style={[styles.jobName, { color: colors.text }]}>{job.name}</Text>
          </View>
          <Switch
            value={job.enabled}
            onValueChange={(value) => handleToggleJob(job.id, value)}
            trackColor={{ false: colors.gray200, true: colors.primaryLight }}
            thumbColor={job.enabled ? colors.primary : colors.gray400}
          />
        </View>
        
        <Text style={[styles.jobDescription, { color: colors.textMuted }]}>
          {job.description}
        </Text>
        
        <View style={styles.jobMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {job.schedule_display}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name={getStatusIcon(job.last_status)} size={14} color={getStatusColor(job.last_status)} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              Last: {formatLastRun(job.last_run)}
            </Text>
          </View>
        </View>
        
        <View style={styles.jobActions}>
          {job.can_trigger_manually && (
            <TouchableOpacity
              style={[
                styles.runButton,
                { backgroundColor: colors.primary },
                isRunning && styles.buttonDisabled
              ]}
              onPress={() => handleRunNow(job)}
              disabled={isRunning || !job.enabled}
            >
              {isRunning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={styles.runButtonText}>Run Now</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          
          {job.settings && (
            <TouchableOpacity
              style={[styles.editButton, { borderColor: colors.border }]}
              onPress={() => setEditingJob(isEditing ? null : job.id)}
            >
              <Ionicons name="settings-outline" size={16} color={colors.text} />
              <Text style={[styles.editButtonText, { color: colors.text }]}>
                {isEditing ? 'Close' : 'Settings'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {isEditing && job.settings && (
          <View style={[styles.settingsPanel, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.settingsTitle, { color: colors.text }]}>Schedule Settings</Text>
            
            {job.settings.day_of_month !== undefined && (
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>Day of Month</Text>
                <TextInput
                  style={[styles.settingInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={String(job.settings.day_of_month)}
                  keyboardType="number-pad"
                  placeholder="1-31"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            )}
            
            {job.settings.hour !== undefined && (
              <View style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>Hour (24h)</Text>
                <TextInput
                  style={[styles.settingInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  value={String(job.settings.hour)}
                  keyboardType="number-pad"
                  placeholder="0-23"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            )}
            
            <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.success }]}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader showBack title="Scheduled Jobs" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader showBack title="Scheduled Jobs" />
      
      <ScrollView
        contentContainerStyle={[styles.content, isTablet && styles.contentTablet]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadJobs(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Info Banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Automated Jobs</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              These jobs run automatically on their schedules. You can enable/disable them or trigger them manually.
            </Text>
          </View>
        </View>

        {/* Job Cards */}
        {jobs.map(renderJobCard)}

        {/* Legend */}
        <View style={[styles.legend, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.legendTitle, { color: colors.text }]}>Status Legend</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{t('common.success')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Failed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Pending</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Never Run</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  contentTablet: { maxWidth: 800, alignSelf: 'center', width: '100%' },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  infoText: { fontSize: 13, lineHeight: 18 },
  jobCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  jobDisabled: { opacity: 0.6 },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  jobName: { fontSize: 16, fontWeight: '600' },
  jobDescription: { fontSize: 13, lineHeight: 18, marginBottom: 12 },
  jobMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  jobActions: { flexDirection: 'row', gap: 10 },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  runButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  editButtonText: { fontWeight: '500', fontSize: 13 },
  buttonDisabled: { opacity: 0.7 },
  settingsPanel: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  settingsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  settingLabel: { fontSize: 13 },
  settingInput: {
    width: 80,
    height: 36,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    textAlign: 'center',
    fontSize: 14,
  },
  saveButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  legend: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
  },
  legendTitle: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  legendItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12 },
});
