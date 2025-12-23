# AI Context & Project Memory

This file serves as a shared context for AI assistants (Gemini, Claude, etc.) working on the JSync project.

## Project Overview
**JSync** is a lightweight macOS menubar application designed to automate backups for Capture One sessions.

- **Frontend**: React 19, TypeScript, Tailwind CSS 4.
- **Backend**: Rust, Tauri v2.
- **Backup Engine**: `rclone` (bundled as a sidecar binary).
- **Session Detection**: AppleScript integration with Capture One.

## Core Architecture & Patterns

### UI & UX
- **Menubar App**: Uses `tauri-plugin-positioner` for tray-relative windowing.
- **Native macOS Hooks**:
    - `src-tauri/src/macos_window.rs`: Sets window corner radius.
    - `src-tauri/src/macos_dialog.rs`: Implements a custom `NSOpenPanel` via `objc2` to avoid the "dimming sheet" effect common in menubar apps.
- **Styling**: Tailwind CSS with a dark, modern aesthetic (monospaced fonts for paths, high-contrast status colors).

### State Management & Persistence
- **Global Store**: Uses `tauri-plugin-store` for app-wide settings (notifications, schedule intervals).
- **Session Sidecar (.jsync)**: Primary persistence for session-specific data. Each session folder contains a `[Name].jsync` JSON file storing:
    - `selected_paths`: Specific folders selected for backup.
    - `destinations`: List of backup locations and their enabled state.
    - `last_synced`: ISO timestamp of the last successful backup.
- **Portability**: This sidecar ensures that settings follow the session folder if it is moved or renamed.

### Backup Logic (`src-tauri/src/commands/backup.rs`)
- Executes `rclone sync` with parallel transfers (4) and checkers (8).
- **Granular Filtering**: Converts frontend absolute path selections into rclone `--filter` rules (e.g., `+ /Capture/**`, `- /**`).
- **Empty Directories**: Uses `--create-empty-src-dirs` to preserve the folder structure even for empty folders.
- Parses rclone's JSON log output for real-time progress updates.
- Supports cancellation via an `AtomicBool` flag that kills the sidecar process.

## Recent Significant Changes (Dec 2025)
- **Session Sidecar Implementation**: Moved `destinations` and `selectedPaths` from global storage to a portable `.jsync` sidecar file. Implemented Rust commands for robust loading/saving.
- **Improved Selection Logic**: Fixed hierarchical linkage in the Preferences tree (root toggles children). Ticking the last unselected child now correctly promotes the state to "All Selected" (root path).
- **Empty Folder Preservation**: Added rclone flags to ensure empty source directories are created at the destination.
- **Performance Optimization**: Implemented a singleton `NSOpenPanel` in `macos_dialog.rs`. The panel is "warmed up" (instantiated) at app launch on the main thread.
- **Image Counting**: Updated `src-tauri/src/commands/session.rs` to recursively count images in the "Capture" folder.
- **TypeScript Stability**: Resolved several type errors and removed unused states (`hasBackedUpOnce`, `lastSessionPath`) after the sidecar migration.

## Ongoing Work & Known Issues
- **Cancel Button**: Needs verification for immediate responsiveness during high-IO transfers.
- **Unticked Item Policy**: Determine if unticked items should be deleted from the destination on subsequent syncs.
- **Manual Backup Management**: Add a way for users to delete backups directly from the UI.

## Dev Commands
- `npm run tauri dev`: Start development environment.
- `npm run build`: Check types and build frontend.
- `npm run tauri build`: Build the full application.
