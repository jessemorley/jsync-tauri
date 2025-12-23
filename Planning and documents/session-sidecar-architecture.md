# Session Sidecar Architecture (.jsync)

## Overview
To provide portability and session-specific settings, JSync will move away from global local storage for session-related data and instead use a custom sidecar file located within the Capture One session folder.

## File Specification
- **Format:** JSON (UTF-8)
- **Extension:** `.jsync`
- **Naming Convention:** `[SessionName].jsync` (e.g., `Production_Day_01.jsync`)
- **Location:** Root of the Capture One session folder.

## Data Schema
```json
{
  "version": 1,
  "last_session_path": "Absolute path for validation",
  "last_synced": "ISO-8601 Timestamp",
  "selected_paths": [
    "Absolute path 1",
    "Absolute path 2"
  ],
  "destinations": [
    {
      "id": 123456789,
      "path": "/Volumes/Drive/Backup",
      "label": "Backup Drive",
      "destination_type": "external",
      "enabled": true,
      "has_existing_backup": true
    }
  ]
}
```

## Logic Flow
1. **Detection:** When the app detects an active Capture One session via AppleScript, it identifies the session path and name.
2. **Loading:**
   - Look for `[SessionPath]/[SessionName].jsync`.
   - If found, deserialize and populate the frontend state.
   - If NOT found, create a new config with defaults (all folders selected) and save it immediately.
3. **Synchronization:**
   - Any change to selections or destinations in the UI triggers an immediate "auto-save" to the `.jsync` file.
   - Backup status (last synced, destination check) is updated in the file after a successful sync.
4. **Portability:** Moving the session folder in Finder preserves the `.jsync` file, allowing JSync to recognize the settings on any machine.

## Technical Requirements
- **Rust Backend:** 
  - Struct `SessionConfig` with `serde` support.
  - Commands: `load_session_config(path: String)`, `save_session_config(path: String, config: SessionConfig)`.
- **Frontend:**
  - Logic to switch between "Global Settings" (Interval, Notifications) and "Session Settings" (Selections, Destinations).
  - Effect hooks to trigger saves on state changes.
