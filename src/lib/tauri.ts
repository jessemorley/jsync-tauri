import { invoke } from '@tauri-apps/api/core';
import { load, Store } from '@tauri-apps/plugin-store';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import type { Destination, SessionInfo, SessionItem, BackupProgress, BackupComplete } from './types';

// Session commands
export async function getCaptureOneSession(): Promise<SessionInfo> {
  return invoke('get_capture_one_session');
}

export async function getSessionContents(path: string): Promise<SessionItem[]> {
  return invoke('get_session_contents', { path });
}

// Destination commands
export async function openFolderPicker(): Promise<string | null> {
  return invoke('open_folder_picker');
}

export async function parseDestination(path: string): Promise<Destination> {
  return invoke('parse_destination', { path });
}

// Backup commands
export async function startBackup(
  sessionPath: string,
  sessionName: string,
  destinations: Destination[],
  selectedPaths: string[]
): Promise<void> {
  return invoke('start_backup', {
    request: { 
      session_path: sessionPath, 
      session_name: sessionName,
      destinations, 
      selected_paths: selectedPaths 
    }
  });
}

export async function cancelBackup(): Promise<void> {
  return invoke('cancel_backup');
}

// Event listeners
export function onBackupProgress(callback: (progress: BackupProgress) => void): Promise<UnlistenFn> {
  return listen<BackupProgress>('backup-progress', (event) => callback(event.payload));
}

export function onBackupComplete(callback: (result: BackupComplete) => void): Promise<UnlistenFn> {
  return listen<BackupComplete>('backup-complete', (event) => callback(event.payload));
}

export function onBackupError(callback: (error: BackupComplete) => void): Promise<UnlistenFn> {
  return listen<BackupComplete>('backup-error', (event) => callback(event.payload));
}

export function onRefreshSession(callback: () => void): Promise<UnlistenFn> {
  return listen('refresh-session', callback);
}

// Permissions
export async function checkFullDiskAccess(): Promise<boolean> {
  return invoke('check_full_disk_access');
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === 'granted';
    }
    return granted;
  } catch (error) {
    return false;
  }
}

// Notifications
export async function sendBackupNotification(title: string, body: string): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (granted) {
      // Call our direct Rust command instead of the JS plugin for reliability on macOS
      await invoke('send_notification', { title, body });
    }
  } catch (error) {
    // Silent fail for notifications
  }
}

// Store
let store: Store | null = null;

export async function getStore(): Promise<Store> {
  if (!store) {
    store = await load('jsync-settings.json', { autoSave: true });
  }
  return store;
}

export async function saveState<T>(key: string, value: T): Promise<void> {
  const s = await getStore();
  await s.set(key, value);
  await s.save();
}

export async function loadState<T>(key: string, defaultValue: T): Promise<T> {
  const s = await getStore();
  const value = await s.get<T>(key);
  return value ?? defaultValue;
}
