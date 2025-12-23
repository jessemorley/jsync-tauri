export interface Destination {
  id: number;
  path: string;
  label: string;
  destination_type: 'external' | 'cloud' | 'local' | 'network';
  enabled: boolean;
  has_existing_backup: boolean;
}

export interface SessionConfig {
  version: number;
  last_synced: string | null;
  selected_paths: string[];
  destinations: Destination[];
}

export interface SessionInfo {
  name: string;
  path: string;
  size: string;
  image_count: number;
}

export interface SessionItem {
  id: string;
  label: string;
  item_type: 'folder' | 'file';
}

export interface BackupProgress {
  destination_id: number;
  percent: number;
  current_file: string;
  transfer_rate: string;
  files_transferred: number;
  total_files: number;
}

export interface BackupComplete {
  destination_id: number;
  success: boolean;
  files_copied: number;
  size_transferred: string;
  error?: string;
}

export interface AppState {
  view: 'main' | 'prefs';
  backupState: 'idle' | 'running' | 'success' | 'error';
  globalProgress: number;
  scheduledBackup: boolean;
  intervalMinutes: number;
  destinations: Destination[];
  selectedPaths: string[];
  notificationsEnabled: boolean;
  session: SessionInfo | null;
}
