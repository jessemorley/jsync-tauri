Create a plan to build this mockup as a Tauri menubar app for macos. Add debugging and error handling.
React mockup: [text](react-mockup-v1.1.jsx)
Backup logic example: [text](main.applescript)

Implementation Plan: Capture One Backup (Tauri Menubar App)

1. Project Architecture

Framework: Tauri (Rust backend, React frontend)

UI Mode: Menubar/Tray-only application (decorations: false, transparent: true, always_on_top: true when visible).

Backend: Rust for file system operations, process monitoring, and native dialogs.

Frontend: The provided React + Tailwind CSS mockup.

2. Core Feature Implementation

A. Finder Dialog & Smart Destination Parsing

Trigger: Frontend addDefaultLocation calls a Rust command open_destination_picker.

Action: Use tauri-plugin-dialog to open a native folder picker.

Parsing Logic (Rust):

Volumes: If path starts with /Volumes/, extract the volume name.

Cloud Providers: Check path for strings like "Dropbox", "Google Drive", or "OneDrive". Assign corresponding icon type (cloud).

Local: Default to the folder name using std::path.

Result: Return a JSON object to React: { id, path, label, type, enabled: true }.

B. Backup Engine (Session-Level Copy)

Logic: The app must copy the entire Session folder into the destination.

Rust Implementation: - Use fs_extra::dir::copy or a progress-tracked buffer copy to handle large image files without blocking the UI.

AppleScript Integration: Execute the provided main.applescript via std::process::Command to ensure Capture One specific metadata is handled correctly if required.

Progress Tracking: Emit a Tauri event backup-progress from Rust to React to update the globalProgress bar.

C. Directory Discovery (Preferences)

Logic: Instead of hardcoded tree data, pull the root level of the active session.

Implementation: Rust command get_session_contents(path: String) returns a list of files/folders.

Requirement: Filter for standard C1 structures (Capture, Selects, Output, Trash, and .cosessiondb).

D. Menubar Icon States

Use tauri::SystemTray to update the icon dynamically:

Idle: Standard monochrome logo.

Backing Up: Animated SVG or alternating icons to show activity.

Success: Green checkmark overlay (reverts to Idle after 5 seconds).

3. Error Handling & Debugging

File System Permissions: Implement a "Grant Full Disk Access" check—essential for macOS Volumes access.

Disconnected Drives: Before starting RefreshCw logic, Rust must verify Path::new(dest).exists(). If false, trigger a frontend error state.

Logging: Integrate tauri-plugin-log to capture background sync errors into a local file for debugging.

4. State Persistence

Store destinations, selectedPaths, and intervalMinutes using tauri-plugin-store.

Hydrate the React app on useEffect mount.

5. Development Steps for Claude Opus

Environment Setup: Initialize Tauri project with the existing React files.

IPC Bridge: Create Rust commands for open_destination_picker and start_backup_process.

File Monitor: Implement a Rust-based notify watcher on the .cosessiondb file to trigger the "Just Now" sync status.

UI Integration: Replace mock setTimeout loops in App.jsx with actual Tauri event listeners.