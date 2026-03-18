# JSync - Capture One Backup Tool

A lightweight macOS menubar application for automatically backing up Capture One sessions to multiple destinations.

## Features

- **Menubar Interface** - Compact, always-accessible menubar app with custom JSync logo and no dock icon
- **Smart Destination Detection** - Automatically identifies drive types (external, cloud, network, local)
- **Duplicate Prevention** - Prevents adding the same location twice with a subtle shake animation
- **Portable Session Settings** - Stores preferences, selections, and destination history in a `.jsync` sidecar file within the session folder.
- **Granular Sync** - Choose which session folders (Capture, Selects, Output, etc.) to include in backups using absolute path selection.
- **Scheduled Backups** - Configure automatic backups at custom intervals (5m, 15m, 30m, or custom)
- **Multiple Destinations** - Backup to multiple locations simultaneously
- **Progress Tracking** - Real-time backup progress with accurate file counts and transfer rates
- **Parallel Transfers** - Multi-threaded backups using rclone (4 concurrent file transfers)
- **System Notifications** - Optional alerts when backups complete
- **Auto-hide** - Window automatically hides when clicking away
- **Dynamic Layout** - Content area adapts to actual content size with smooth scrolling
- **Contextual Tooltips** - Smart tooltips with state-aware messaging for enhanced usability

## Installation

### Prerequisites

- macOS 10.15 or later
- Capture One installed
- Full Disk Access permission (required for accessing Capture One sessions)


## Technical Details

### Architecture

- **Frontend**: React + TypeScript + Tailwind CSS + Framer Motion
- **Backend**: Rust + Tauri 2.0
- **Backup Engine**: rclone (bundled sidecar) with parallel transfers and real-time progress
- **Session Detection**: AppleScript integration for Capture One
- **Persistence**: Hybrid approach using `.jsync` sidecar files for session-specific settings and `tauri-plugin-store` for global application settings.

## Development Notes

### rclone Backup Implementation

The app uses rclone as a bundled Tauri sidecar binary for file synchronization:
- **Parallel transfers**: 4 concurrent file transfers with 8 concurrent file checkers
- **Real-time progress**: Updates every 500ms with accurate percentage, file counts, and transfer rates
- **Sync behavior**: Mirrors source to destination, deleting extraneous files at the destination
- **Cancellation support**: Atomic boolean flag allows immediate backup cancellation
- **Progress parsing**: Regex-based parsing of rclone's plain-text stdout for progress updates

### Permissions

The app requires Full Disk Access to:
- Read Capture One session files
- Access external volumes
- Write to backup destinations

Grant this in: **System Settings → Privacy & Security → Full Disk Access**

## License

Copyright © 2024 Jesse Morley

## Credits

Built with:
- [Tauri](https://tauri.app/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)