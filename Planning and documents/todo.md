# Todo

## Bugs
- [ ] Cancel transfer button doesn't seem to tbe working

## UI
- [ ] When no destination added: hover state should only be for plus button

## Functionality

- [ ] Location options
    - Option to set/unset as default, which will show it as a backup location for all sessions
    - Option to remove location
    - Option to delete backup at this location

- [ ] Determine behavior for unticked items on subsequent syncs (should they be removed from destination backups?)


# Completed

- [x] Portable Session Settings (.jsync sidecar): Implemented session-specific storage for selections and destinations, including auto-verification of existing backups on session change.

- [x] Dynamic session content selection in preferences and selection-based backups using rclone filters.

- [x] Image total subtitle doesn't accurately reflect no of images in capture folder (and subfolders)

- [x] Progress bar completion polish

- [x] BUG: If a backup has been made to a location, that location shows blue for backed up, even if the session changes or the backup is deleted

- [x] If the location section is collapsed during backup, the completion outline should show around the window

- [x] Add sync information to backup completion notification
    - "Backup Complete. Session successfully backed up to 4 locations. Total session size: 4.1 GB"

- [x] When no session is connected: "No Session" (No change) and "Open a session in Capture One to begin backup" (Replacing the session size subtitle)
