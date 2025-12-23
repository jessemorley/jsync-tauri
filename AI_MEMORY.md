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
- **Store**: Uses `tauri-plugin-store` via `src/hooks/useStore.ts`.
- **Hook**: `usePersistedState` wraps the store for easy React state persistence.
- **Session Awareness**: The UI resets backup-specific state (like which destinations have been backed up) when the Capture One session path changes.

### Backup Logic (`src-tauri/src/commands/backup.rs`)
- Executes `rclone sync` with parallel transfers (4) and checkers (8).
- Parses rclone's JSON log output for real-time progress updates.
- Supports cancellation via an `AtomicBool` flag that kills the sidecar process.

## Recent Significant Changes (Dec 2025)
- **Session-Aware Status**: Fixed a bug where "backed up" status (blue highlight) would persist even after switching to a different Capture One session.
- **TypeScript Stability**: Resolved several type errors related to `tauri-plugin-store` (missing `defaults`) and `useEffect` return types.
- **Progress Reporting**: Switched to `--use-json-log` for rclone to get more reliable progress data.

## Ongoing Work & Known Issues
- **Cancel Button**: Needs verification for immediate responsiveness during high-IO transfers.
- **Preference Tree**: `.cosessiondb` files are currently filtered out or not showing correctly in the session contents tree.
- **Backup Verification**: On session change, the app should ideally check the destination disk to see if a backup already exists rather than starting with a clean slate.
- **Notifications**: Polish the "Backup Complete" notification to include total size and destination count.

## Dev Commands
- `npm run tauri dev`: Start development environment.
- `npm run build`: Check types and build frontend.
- `npm run tauri build`: Build the full application.
