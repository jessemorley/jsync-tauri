# Todo

## Bugs
- [ ] Session contents in preferences doesn't display the .cosessiondb file
- [ ] Cancel transfer button doesn't seem to tbe working

## UI
- When no destination added: hover state should only be for plus button

- [ ] On session change, actually check to see if backups exist at the defined locations when setting location state (backed up or not)
    - May entail a way of storing backup locations on a session-by-session basis. (Store in session folder?) or setting default backup locations
    - App could create config file in session?

- [ ] Add way for user to delete an actual backup, as well as the backup location

- [ ] Determine behavior for unticked items on subsequent syncs (should they be removed from destination backups?)



# Completed

- [x] Dynamic session content selection in preferences and selection-based backups using rclone filters.

- [x] Image total subtitle doesn't accurately reflect no of images in capture folder (and subfolders). The number is too low.


- [x] Progress bar completion polish
- [x] BUG: If a backup has been made to a location, that location shows blue for backed up, even if the session changes or the backup is deleted
- [x] If the location section is collapsed during backup, the completion outline should show around the window
- [x] Add sync information to backup completion notification
    - "Backup Complete. Session successfully backed up to 4 locations. Total session size: 4.1 GB"
- [x] When no session is connected: "No Session" (No change) and "Open a session in Capture One to begin backup" (Replacing the session size subtitle)
