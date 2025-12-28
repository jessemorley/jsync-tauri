# AI Context & Project Memory

This file serves as a shared context for AI assistants (Gemini, Claude, etc.) working on the JSync project.

## Project Overview
**JSync** is a lightweight macOS menubar application designed to automate backups for Capture One sessions.

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, Framer Motion.
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
- **Animations**: Framer Motion for high-fidelity spring physics. Uses `AnimatePresence` for mounting/unmounting state-aware rows (Options, Confirmation).
- **Tooltips**: Custom system using Framer Motion with smart viewport-aware positioning, portal rendering, 500ms delay, and state-aware messaging. Provides contextual help on 7 key buttons with full keyboard accessibility.

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
- **Custom Tooltip System**: Implemented a lightweight tooltip system using existing Framer Motion:
    - **Components**: `src/components/Tooltip.tsx` (reusable component) and `src/hooks/useTooltip.ts` (positioning hook).
    - **Smart Positioning**: Auto-detects viewport boundaries and positions above/below with 8px padding.
    - **State-Aware Messaging**: Sync button shows "Start backup" / "Cancel backup" / "Backup complete" based on `backupState`.
    - **7 Tooltips Added**: Chevron (expand/collapse), sync button, add location, location options, pin toggle, remove, and delete backup buttons.
    - **Accessibility**: Full ARIA support, keyboard focus handling, portal rendering for proper z-index management.
    - **Performance**: 500ms show delay, immediate hide, requestAnimationFrame for smooth positioning, no new dependencies.
- **Refactored Location Transitions**: Implemented conditional entry logic based on previous state:
    - Card → Options: slides in from right (`x: "100%"`)
    - Options ↔ Confirmation: pure fade and scale (`opacity: 0, scale: 0.95`) with no sliding
    - Options → Card: slides out to right while card slides in from left
- **Refactored Location Options UI**: Replaced CSS-based stretching with Framer Motion spring animations (`stiffness: 700`, `damping: 40`). Transitions now slide in from the right.
- **Integrated Deletion Confirmation**: Unified the "Delete" workflow into the sliding menu system. Confirmation row uses a scale/fade transition to/from the options row while maintaining perfect element alignment (`flex-1 basis-0`).
- **Menubar Icon Update**: Switched to a template-compatible PNG implementation of the `folder-sync` icon, ensuring native-like appearance across light and dark macOS themes.
- **Manual Backup Deletion**: Added a "Delete" option to destinations that removes the session backup folder from that specific location and updates the UI state.
- **Session Sidecar Implementation**: Moved `destinations` and `selectedPaths` from global storage to a portable `.jsync` sidecar file. Implemented Rust commands for robust loading/saving.
- **UI Refinements**:
    - Synchronized button sizes across all menus for seamless transitions.
    - Updated icons: Header image icon to `FileImage`, Remove icon to `Delete`.
    - Improved backup completion flash to cover the entire location card including settings toggle.
- **Standardized Formatting**: Applied Prettier across the codebase to ensure consistent indentation and style.
- **Improved Selection Logic**: Fixed hierarchical linkage in the Preferences tree (root toggles children). Ticking the last unselected child now correctly promotes the state to "All Selected" (root path).
- **TypeScript Stability**: Resolved several type errors and removed unused states (`hasBackedUpOnce`, `lastSessionPath`, `backedUpDestinations` - though the latter was restored for transient animations).

## Ongoing Work & Known Issues
- **Cancel Button**: Needs verification for immediate responsiveness during high-IO transfers.
- **Unticked Item Policy**: Determine if unticked items should be deleted from the destination on subsequent syncs.

## Dev Commands
- `npm run tauri dev`: Start development environment.
- `npm run build`: Check types and build frontend.
- `npm run tauri build`: Build the full application.


