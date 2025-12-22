# JSync - Capture One Backup Tool

A lightweight macOS menubar application for automatically backing up Capture One sessions to multiple destinations.

## Features

- **Menubar Interface** - Compact, always-accessible menubar app with no dock icon
- **Smart Destination Detection** - Automatically identifies drive types (external, cloud, network, local)
- **Scheduled Backups** - Configure automatic backups at custom intervals (5m, 15m, 30m, or custom)
- **Multiple Destinations** - Backup to multiple locations simultaneously
- **Progress Tracking** - Real-time backup progress with visual feedback
- **Selective Sync** - Choose which session folders to include in backups
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
2. Select which folders to include in your backups:
   - Session root
   - Capture folder
   - Selects folder
   - Output folder
   - Other custom folders

### Manual Backup

Click the circular arrow button in the header to trigger an immediate backup to all enabled destinations.

## Technical Details

### Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Rust + Tauri 2.0
- **Backup Engine**: rsync with progress tracking
- **Session Detection**: AppleScript integration for Capture One

### Key Components

- **Custom NSOpenPanel**: Direct macOS Cocoa bindings for native folder picker (eliminates sheet dimming effect)
- **Dispatch Queue**: Main thread execution for modal dialogs
- **Auto-hide**: Focus-loss detection for menubar UX
- **Persistent State**: Tauri plugin-store for settings and destinations

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
│   │   │   ├── backup.rs        # Backup logic
│   │   │   ├── destinations.rs  # Folder picker & parsing
│   │   │   ├── session.rs       # Capture One session info
│   │   │   └── permissions.rs   # macOS permissions
│   │   ├── macos_window.rs      # Native window styling
│   │   └── macos_dialog.rs      # Custom NSOpenPanel
│   └── Cargo.toml
└── Planning and documents/ # Design mockups and planning docs
```

## Development Notes

### macOS Dialog Implementation

The app uses a custom NSOpenPanel implementation via Cocoa/objc bindings to avoid the native sheet dimming effect that occurs with standard Tauri dialog plugin. This provides a cleaner UX for menubar apps.

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

## Credits

Built with:
- [Tauri](https://tauri.app/)
- [React](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
