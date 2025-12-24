# JSync - Capture One Backup Tool

A lightweight macOS menubar application for automatically backing up Capture One sessions to multiple destinations.

## Features

- **Menubar Interface** - Compact, always-accessible menubar app with no dock icon
- **Smart Destination Detection** - Automatically identifies drive types (external, cloud, network, local)
- **Portable Session Settings** - Stores preferences, selections, and destination history in a `.jsync` sidecar file within the session folder.
- **Granular Sync** - Choose which session folders (Capture, Selects, Output, etc.) to include in backups using absolute path selection.
- **Scheduled Backups** - Configure automatic backups at custom intervals (5m, 15m, 30m, or custom)
- **Multiple Destinations** - Backup to multiple locations simultaneously
- **Progress Tracking** - Real-time backup progress with accurate file counts and transfer rates
- **Parallel Transfers** - Multi-threaded backups using rclone (4 concurrent file transfers)
- **System Notifications** - Optional alerts when backups complete
- **Auto-hide** - Window automatically hides when clicking away

## Installation

### Prerequisites

- macOS 10.15 or later
- Capture One installed
- Full Disk Access permission (required for accessing Capture One sessions)

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Run in development mode:
```bash
npm run tauri dev
```

3. Build for production:
```bash
npm run tauri build
```

## Usage

### Adding Backup Destinations

1. Click the menubar icon to open JSync
2. Click the **+** button next to "Locations"
3. Select a folder in the file picker
4. The destination will be automatically categorized (External Drive, Cloud, Network, or Local)

### Configuring Scheduled Backups

1. Toggle the schedule switch to enable automatic backups
2. Select an interval (5m, 15m, 30m) or click "Custom" for a custom interval
3. Backups will run automatically in the background

### Managing Session Contents

1. Click "Settings" in the footer
2. Select which folders to include in your backups.
3. Selections are saved automatically to the session's `.jsync` file and will persist even if you move the session folder or switch to another computer.

### Manual Backup

Click the circular arrow button in the header to trigger an immediate backup to all enabled destinations.

## Technical Details

### Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Rust + Tauri 2.0
- **Backup Engine**: rclone (bundled sidecar) with parallel transfers and real-time progress
- **Session Detection**: AppleScript integration for Capture One
- **Persistence**: Hybrid approach using `.jsync` sidecar files for session-specific settings and `tauri-plugin-store` for global application settings.

### Key Components

- **Session Sidecar (.jsync)**: A JSON-formatted metadata file stored in the session root. It tracks selected paths, backup destinations, and last sync timestamps, making settings portable across machines.
- **Advanced Location Options**: A refined UI for managing backup destinations, featuring an elastic stretching transition, ability to set global defaults, and manual backup deletion.
- **rclone Filtering**: Uses `--filter` rules (e.g., `+ /Capture/**`, `- /**`) to implement granular file selection based on the frontend tree view.
- **Manual Backup Management**: Users can delete session-specific backups from individual destinations directly through the UI, with automatic state verification.
- **Custom NSOpenPanel**: Direct macOS Cocoa bindings for native folder picker (eliminates sheet dimming effect).
- **Auto-hide**: Focus-loss detection for menubar UX.
- **Persistent State**: Tauri plugin-store for global settings (intervals, notifications).
- **rclone Integration**: Bundled sidecar binary for efficient, parallel file transfers with accurate progress tracking.

### File Structure

```
jsync-tauri/
├── src/                    # React frontend
│   ├── App.tsx            # Main application component
│   ├── lib/
│   │   ├── tauri.ts      # Tauri command bindings
│   │   └── types.ts      # TypeScript types
│   └── hooks/
│       ├── useStore.ts   # Persistent state hook
│       └── useScheduler.ts # Backup scheduler
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── commands/     # Tauri commands
│   │   │   ├── backup.rs        # rclone backup logic
│   │   │   ├── destinations.rs  # Folder picker & parsing
│   │   │   ├── session.rs       # Capture One session info & image counting
│   │   │   └── permissions.rs   # macOS permissions
│   │   ├── macos_window.rs      # Native window styling
│   │   └── macos_dialog.rs      # Singleton NSOpenPanel implementation
│   ├── binaries/
│   │   └── rclone-aarch64-apple-darwin  # Bundled rclone binary
│   └── Cargo.toml
└── Planning and documents/ # Design mockups and planning docs
```

## Development Notes

### rclone Backup Implementation

The app uses rclone as a bundled Tauri sidecar binary for file synchronization:
- **Parallel transfers**: 4 concurrent file transfers with 8 concurrent file checkers
- **Real-time progress**: Updates every 500ms with accurate percentage, file counts, and transfer rates
- **Sync behavior**: Mirrors source to destination, deleting extraneous files at the destination
- **Cancellation support**: Atomic boolean flag allows immediate backup cancellation
- **Progress parsing**: Regex-based parsing of rclone's plain-text stdout for progress updates

Command: `rclone sync <source> <dest> --check-first -P --stats 500ms --stats-log-level NOTICE --transfers 4 --checkers 8`

### macOS Dialog Implementation

The app uses a custom `NSOpenPanel` implementation via Cocoa/objc bindings.
- **Singleton Pattern**: The panel is instantiated and "warmed up" on app launch to load necessary frameworks.
- **Thread Safety**: Access is managed via a thread-safe singleton to prevent UI flashing and ensure configuration persistence.
- **UX**: This avoids the native sheet dimming effect and ensures instant responsiveness.

### Image Counting

The app recursively scans the "Capture" folder of the active session to provide an accurate count of all images, including those in subdirectories. This process is offloaded to a blocking thread to keep the UI responsive.

### Permissions

The app requires Full Disk Access to:
- Read Capture One session files
- Access external volumes
- Write to backup destinations

Grant this in: **System Settings → Privacy & Security → Full Disk Access**

## Troubleshooting

### Folder Picker Not Appearing
- Ensure Full Disk Access is granted
- Check that the app has focus
- Try restarting the app

### Backup Fails
- Verify destination paths are accessible
- Check available disk space
- Ensure Capture One session is not locked

### Auto-hide Not Working
- This is expected behavior when dialogs are open
- Window will hide after dialogs are dismissed

## License

Copyright © 2024 Jesse Morley

## AI Agent Onboarding

If you are an AI assistant working on this project, please refer to [AI_MEMORY.md](./AI_MEMORY.md) for a summarized context of the architecture, recent changes, and ongoing tasks.

## Credits

Built with:
- [Tauri](https://tauri.app/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
