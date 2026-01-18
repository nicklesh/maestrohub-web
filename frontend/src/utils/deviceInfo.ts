import * as Device from 'expo-device';
import { Platform } from 'react-native';
import * as Application from 'expo-application';

export interface DeviceInfo {
  device_id: string;
  device_name: string | null;
  platform: string;
  model: string | null;
  os_version: string | null;
}

/**
 * Get comprehensive device information for tracking
 * This helps tie devices to user accounts
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  let deviceId = '';
  
  // Try to get a unique device identifier
  if (Platform.OS === 'android') {
    // On Android, use the Android ID
    deviceId = await Application.getAndroidId() || '';
  } else if (Platform.OS === 'ios') {
    // On iOS, use the installation ID (persists until app reinstall)
    deviceId = await Application.getIosIdForVendorAsync() || '';
  } else {
    // For web, generate a unique ID and store in localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      deviceId = localStorage.getItem('maestrohabitat_device_id') || '';
      if (!deviceId) {
        deviceId = `web_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        localStorage.setItem('maestrohabitat_device_id', deviceId);
      }
    } else {
      // Fallback for SSR or environments without localStorage
      deviceId = `unknown_${Date.now()}`;
    }
  }

  // Build device info object
  const deviceInfo: DeviceInfo = {
    device_id: deviceId,
    device_name: Device.deviceName,
    platform: Platform.OS,
    model: Device.modelName,
    os_version: Device.osVersion,
  };

  return deviceInfo;
}

/**
 * Get a short display name for the device
 */
export function getDeviceDisplayName(): string {
  if (Device.deviceName) {
    return Device.deviceName;
  }
  
  const modelName = Device.modelName || 'Unknown Device';
  const platform = Platform.OS.charAt(0).toUpperCase() + Platform.OS.slice(1);
  
  return `${modelName} (${platform})`;
}
