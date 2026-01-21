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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { useTheme, ThemeColors } from '@/src/context/ThemeContext';
import { useToast } from '@/src/context/ToastContext';
import { useTranslation } from '@/src/i18n';
import AppHeader from '@/src/components/AppHeader';
import { api } from '@/src/services/api';

interface JobSettings {
  day_of_month?: number;
  hour?: number;
  minute?: number;
}

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
  settings?: JobSettings;
}

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
    name: 'Kid Activity Updates',
    description: 'Send parents updates about their children\'s session activities',
    schedule: '0 18 * * *',
    schedule_display: 'Daily at 6:00 PM',
    enabled: true,
    last_run: null,
    last_status: 'never',
    next_run: null,
    can_trigger_manually: true,
    settings: { hour: 18, minute: 0 }
  },
  {
    id: 'referral_check',
    name: 'Referral Credit Processing',
    description: 'Process pending referral credits and bonuses',
    schedule: '0 0 * * *',
    schedule_display: 'Daily at midnight',
    enabled: true,
    last_run: null,
    last_status: 'never',
    next_run: null,
    can_trigger_manually: true,
    settings: { hour: 0, minute: 0 }
  },
];

export default function ScheduledJobsScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError, showInfo } = useToast();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  
  // Helper to safely get translation string
  const ts = (key: string, fallback: string): string => {
    const result = t(key);
    return typeof result === 'string' ? result : fallback;
  };
  
  // Translated job data
  const getTranslatedJobs = (): ScheduledJob[] => [
    {
      id: 'monthly_reports',
      name: ts('pages.admin.scheduled_jobs.monthly_reports', 'Monthly Tax Reports'),
      description: ts('pages.admin.scheduled_jobs.monthly_reports_desc', 'Generate monthly payment summary reports for all users with transactions'),
      schedule: '0 2 1 * *',
      schedule_display: ts('pages.admin.scheduled_jobs.1st_of_month', '1st of every month') + ' ' + ts('pages.admin.scheduled_jobs.at', 'at') + ' 2:00 ' + ts('pages.admin.scheduled_jobs.am', 'AM'),
      enabled: true,
      last_run: null,
      last_status: 'never',
      next_run: null,
      can_trigger_manually: true,
      settings: { day_of_month: 1, hour: 2, minute: 0 }
    },
    {
      id: 'annual_1099_reports',
      name: ts('pages.admin.scheduled_jobs.annual_1099_reports', 'Annual 1099 Reports'),
      description: ts('pages.admin.scheduled_jobs.annual_1099_reports_desc', 'Generate annual tax documents (1099 equivalent) for all providers'),
      schedule: '0 3 1 1 *',
      schedule_display: ts('calendar.months.january', 'January') + ' 1st ' + ts('pages.admin.scheduled_jobs.at', 'at') + ' 3:00 ' + ts('pages.admin.scheduled_jobs.am', 'AM'),
      enabled: true,
      last_run: null,
      last_status: 'never',
      next_run: null,
      can_trigger_manually: true,
      settings: { day_of_month: 1, hour: 3, minute: 0 }
    },
    {
      id: 'session_reminders',
      name: ts('pages.admin.scheduled_jobs.session_reminders', 'Session Reminders'),
      description: ts('pages.admin.scheduled_jobs.session_reminders_desc', 'Send reminder notifications for upcoming sessions (24h and 1h before)'),
      schedule: '0 * * * *',
      schedule_display: ts('pages.admin.scheduled_jobs.every_hour', 'Every hour'),
      enabled: true,
      last_run: null,
      last_status: 'never',
      next_run: null,
      can_trigger_manually: true,
    },
    {
      id: 'kid_notifications',
      name: ts('pages.admin.scheduled_jobs.kid_notifications', 'Kid Activity Updates'),
      description: ts('pages.admin.scheduled_jobs.kid_notifications_desc', 'Send parents updates about their children\'s session activities'),
      schedule: '0 18 * * *',
      schedule_display: ts('common.daily', 'Daily') + ' ' + ts('pages.admin.scheduled_jobs.at', 'at') + ' 6:00 ' + ts('pages.admin.scheduled_jobs.pm', 'PM'),
      enabled: true,
      last_run: null,
      last_status: 'never',
      next_run: null,
      can_trigger_manually: true,
      settings: { hour: 18, minute: 0 }
    },
    {
      id: 'referral_check',
      name: ts('pages.admin.scheduled_jobs.referral_check', 'Referral Credit Processing'),
      description: ts('pages.admin.scheduled_jobs.referral_check_desc', 'Process pending referral credits and bonuses'),
      schedule: '0 0 * * *',
      schedule_display: ts('common.daily', 'Daily') + ' ' + ts('pages.admin.scheduled_jobs.at', 'at') + ' 12:00 ' + ts('pages.admin.scheduled_jobs.am', 'AM'),
      enabled: true,
      last_run: null,
      last_status: 'never',
      next_run: null,
      can_trigger_manually: true,
    },
  ];

  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<string | null>(null);
  const [editSettings, setEditSettings] = useState<JobSettings>({});
  
  const isTablet = width >= 768;
  const styles = getStyles(colors, isTablet);

  const loadJobs = useCallback(async () => {
    const translatedJobs = getTranslatedJobs();
    try {
      const response = await api.get('/admin/scheduled-jobs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.jobs) {
        setJobs(response.data.jobs.map((j: any) => ({
          ...translatedJobs.find(d => d.id === j.id) || {},
          ...j
        })));
      } else {
        setJobs(translatedJobs);
      }
    } catch (error) {
      // Use translated defaults if API fails
      setJobs(translatedJobs);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, t]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleToggleJob = async (jobId: string, enabled: boolean) => {
    setJobs(prev => prev.map(job => 
      job.id === jobId ? { ...job, enabled } : job
    ));
    
    try {
      await api.patch(`/admin/scheduled-jobs/${jobId}`, 
        { enabled },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showSuccess(t('pages.admin.scheduled_jobs.job_updated'));
    } catch (error) {
      setJobs(prev => prev.map(job => 
        job.id === jobId ? { ...job, enabled: !enabled } : job
      ));
      showError(t('pages.admin.scheduled_jobs.update_failed'));
    }
  };

  const startEditing = (job: ScheduledJob) => {
    setEditingJob(job.id);
    setEditSettings(job.settings || {});
  };

  const cancelEditing = () => {
    setEditingJob(null);
    setEditSettings({});
  };

  const saveSettings = () => {
    if (!editingJob) return;
    
    // Validate
    if (editSettings.day_of_month !== undefined) {
      const day = editSettings.day_of_month;
      if (day < 1 || day > 31) {
        showError(t('pages.admin.scheduled_jobs.invalid_day'));
        return;
      }
    }
    
    if (editSettings.hour !== undefined) {
      const hour = editSettings.hour;
      if (hour < 0 || hour > 23) {
        showError(t('pages.admin.scheduled_jobs.invalid_hour'));
        return;
      }
    }
    
    // Update job
    setJobs(prev => prev.map(job => {
      if (job.id === editingJob) {
        const newSettings = { ...job.settings, ...editSettings };
        let scheduleDisplay = job.schedule_display;
        
        // Update display based on settings
        if (newSettings.day_of_month !== undefined && newSettings.hour !== undefined) {
          const suffix = getSuffix(newSettings.day_of_month);
          scheduleDisplay = `${newSettings.day_of_month}${suffix} of every month at ${formatHour(newSettings.hour)}`;
        } else if (newSettings.hour !== undefined) {
          scheduleDisplay = `Daily at ${formatHour(newSettings.hour)}`;
        }
        
        return { ...job, settings: newSettings, schedule_display: scheduleDisplay };
      }
      return job;
    }));
    
    showSuccess(t('pages.admin.scheduled_jobs.settings_saved'));
    setEditingJob(null);
    setEditSettings({});
  };

  const getSuffix = (day: number): string => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12:00 AM';
    if (hour === 12) return '12:00 PM';
    if (hour < 12) return `${hour}:00 AM`;
    return `${hour - 12}:00 PM`;
  };

  const handleRunNow = async (job: ScheduledJob) => {
    setRunningJob(job.id);
    try {
      let endpoint = '';
      
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
          showInfo(t('pages.admin.scheduled_jobs.cannot_trigger'));
          setRunningJob(null);
          return;
      }
      
      await api.post(endpoint, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      showSuccess(t('pages.admin.scheduled_jobs.job_completed'));
      
      setJobs(prev => prev.map(j => 
        j.id === job.id 
          ? { ...j, last_run: new Date().toISOString(), last_status: 'success' as const } 
          : j
      ));
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || t('pages.admin.scheduled_jobs.job_failed');
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
      case 'success': return colors.success;
      case 'failed': return colors.error;
      case 'pending': return colors.warning;
      default: return colors.textMuted;
    }
  };

  const getStatusIcon = (status: string): any => {
    switch (status) {
      case 'success': return 'checkmark-circle';
      case 'failed': return 'close-circle';
      case 'pending': return 'time';
      default: return 'ellipse';
    }
  };

  const formatLastRun = (dateStr: string | null) => {
    if (!dateStr) return t('pages.admin.scheduled_jobs.never');
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return t('pages.admin.scheduled_jobs.just_now');
    if (diffMins < 60) return `${diffMins}m ${t('pages.admin.scheduled_jobs.ago')}`;
    if (diffHours < 24) return `${diffHours}h ${t('pages.admin.scheduled_jobs.ago')}`;
    if (diffDays < 7) return `${diffDays}d ${t('pages.admin.scheduled_jobs.ago')}`;
    return date.toLocaleDateString();
  };

  const renderJobCard = (job: ScheduledJob) => {
    const isRunning = runningJob === job.id;
    const isEditing = editingJob === job.id;
    
    return (
      <View 
        key={job.id} 
        style={[styles.jobCard, !job.enabled && styles.jobDisabled]}
      >
        <View style={styles.jobHeader}>
          <View style={styles.jobTitleRow}>
            <View style={[styles.statusDot, { backgroundColor: getStatusColor(job.last_status) }]} />
            <Text style={styles.jobName}>{t(`pages.admin.scheduled_jobs.jobs.${job.id}.name`) || job.name}</Text>
          </View>
          <Switch
            value={job.enabled}
            onValueChange={(value) => handleToggleJob(job.id, value)}
            trackColor={{ false: colors.gray200, true: colors.primaryLight }}
            thumbColor={job.enabled ? colors.primary : colors.gray400}
          />
        </View>
        
        <Text style={styles.jobDescription}>{t(`pages.admin.scheduled_jobs.jobs.${job.id}.description`) || job.description}</Text>
        
        <View style={styles.jobMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>{t(`pages.admin.scheduled_jobs.jobs.${job.id}.schedule_display`) || job.schedule_display}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name={getStatusIcon(job.last_status)} size={14} color={getStatusColor(job.last_status)} />
            <Text style={styles.metaText}>{t('pages.admin.scheduled_jobs.last_run')}: {formatLastRun(job.last_run)}</Text>
          </View>
        </View>
        
        <View style={styles.jobActions}>
          {job.can_trigger_manually && (
            <TouchableOpacity
              style={[styles.runButton, isRunning && styles.buttonDisabled]}
              onPress={() => handleRunNow(job)}
              disabled={isRunning || !job.enabled}
            >
              {isRunning ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={styles.runButtonText}>{t('pages.admin.scheduled_jobs.run_now')}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          
          {job.settings && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => isEditing ? cancelEditing() : startEditing(job)}
            >
              <Ionicons name="settings-outline" size={16} color={colors.text} />
              <Text style={styles.editButtonText}>
                {isEditing ? t('common.close') : t('pages.admin.scheduled_jobs.settings')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        {isEditing && job.settings && (
          <View style={styles.settingsPanel}>
            <Text style={styles.settingsTitle}>{t('pages.admin.scheduled_jobs.schedule_settings')}</Text>
            
            {job.settings.day_of_month !== undefined && (
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>{t('pages.admin.scheduled_jobs.day_of_month')}</Text>
                <TextInput
                  style={styles.settingInput}
                  value={String(editSettings.day_of_month ?? job.settings.day_of_month)}
                  onChangeText={(val) => setEditSettings(prev => ({ 
                    ...prev, 
                    day_of_month: parseInt(val) || 1 
                  }))}
                  keyboardType="number-pad"
                  placeholder="1-31"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            )}
            
            {job.settings.hour !== undefined && (
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>{t('pages.admin.scheduled_jobs.hour_24h')}</Text>
                <TextInput
                  style={styles.settingInput}
                  value={String(editSettings.hour ?? job.settings.hour)}
                  onChangeText={(val) => setEditSettings(prev => ({ 
                    ...prev, 
                    hour: parseInt(val) || 0 
                  }))}
                  keyboardType="number-pad"
                  placeholder="0-23"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            )}
            
            <View style={styles.settingActions}>
              <TouchableOpacity style={styles.cancelSettingsButton} onPress={cancelEditing}>
                <Text style={styles.cancelSettingsText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveSettingsButton} onPress={saveSettings}>
                <Text style={styles.saveSettingsText}>{t('pages.admin.scheduled_jobs.save_changes')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <AppHeader showBack title={t('pages.admin.scheduled_jobs.title')} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader showBack title={t('pages.admin.scheduled_jobs.title')} />
      
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadJobs(); }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={24} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>{t('pages.admin.scheduled_jobs.automated_jobs')}</Text>
            <Text style={styles.infoText}>{t('pages.admin.scheduled_jobs.info_text')}</Text>
          </View>
        </View>

        {/* Job Cards */}
        {jobs.map(renderJobCard)}

        {/* Legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>{t('pages.admin.scheduled_jobs.status_legend')}</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>{t('common.success')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
              <Text style={styles.legendText}>{t('pages.admin.scheduled_jobs.failed')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
              <Text style={styles.legendText}>{t('pages.admin.scheduled_jobs.pending')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
              <Text style={styles.legendText}>{t('pages.admin.scheduled_jobs.never')}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isTablet: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: isTablet ? 32 : 16, paddingBottom: 40 },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  infoContent: { flex: 1, marginLeft: 12 },
  infoTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4 },
  infoText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  jobCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  jobDisabled: { opacity: 0.6 },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  jobTitleRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  jobName: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
  jobDescription: { fontSize: 14, color: colors.textMuted, marginBottom: 12, lineHeight: 20 },
  jobMeta: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16, marginBottom: 4 },
  metaText: { fontSize: 13, color: colors.textSecondary, marginLeft: 4 },
  jobActions: { flexDirection: 'row', gap: 12 },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  runButtonText: { color: '#fff', fontSize: 14, fontWeight: '500', marginLeft: 6 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: { color: colors.text, fontSize: 14, marginLeft: 6 },
  settingsPanel: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 16,
  },
  settingsTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 16 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  settingLabel: { fontSize: 14, color: colors.textSecondary },
  settingInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.text,
    width: 100,
    textAlign: 'center',
  },
  settingActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
  cancelSettingsButton: { paddingHorizontal: 16, paddingVertical: 8 },
  cancelSettingsText: { color: colors.textMuted, fontSize: 14 },
  saveSettingsButton: {
    backgroundColor: colors.success,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveSettingsText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  legend: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 12 },
  legendItems: { flexDirection: 'row', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 20, marginBottom: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 13, color: colors.textSecondary },
});
