# JSync Bug Report

Audit date: 2026-02-08

---

## BUG-1: Multi-destination backup prematurely reports success

**Severity:** HIGH
**Files:** `src/App.tsx:433-468`, `src-tauri/src/commands/backup.rs:347`

### Description

The `backup-complete` event fires per-destination from the Rust backend, but the frontend handler treats each event as if the entire backup is finished. It sets `backupState` to `"success"`, sends a notification claiming all locations are done, and starts a 3-second timeout to reset the UI to idle.

### Reproduction

1. Add 2+ backup destinations
2. Start a backup
3. Observe the UI flicker between "success" and "idle" as each destination completes sequentially

### Symptoms

- UI shows "success" after only the first destination finishes
- 3s timeout resets state to "idle" while later destinations are still syncing
- User receives N duplicate notifications, each incorrectly stating all N locations are backed up
- Progress bar resets to 0 mid-backup

### Root Cause

The `onBackupComplete` listener has no awareness of how many destinations are in-flight. Each per-destination completion event triggers the full "backup done" sequence:

```javascript
unlistenComplete = await onBackupComplete((result) => {
  if (result.success) {
    setBackupState("success");
    setLastSynced(new Date().toISOString());
    sendBackupNotification(...); // says "backed up to N locations"
    setTimeout(() => {
      setBackupState("idle");
      setGlobalProgress(0);
    }, 3000);
  }
});
```

### Suggested Fix

Track the number of expected completions vs actual completions. Only transition to "success" and send the notification when all enabled destinations have reported back. Alternatively, emit a single "all-complete" event from the Rust backend after the loop finishes.

---

## BUG-2: Stale timeout can reset state during a new backup

**Severity:** MEDIUM
**Files:** `src/App.tsx:533-536`

### Description

After a backup is cancelled or errors out, a `setTimeout` resets `backupState` to `"idle"` and `globalProgress` to `0` after 3 seconds. If the user starts a new backup within that 3-second window, the stale timeout fires and incorrectly resets the active backup's UI state.

### Reproduction

1. Start a backup
2. Cancel it
3. Immediately start a new backup
4. After ~3 seconds, the UI reverts to "idle" despite the backup running

### Root Cause

The timeout reference is not tracked or cleared when a new backup begins:

```javascript
} catch (error) {
  if (error === "Backup cancelled") {
    setBackupState("idle");
  } else {
    setBackupState("error");
  }
  setTimeout(() => {        // <-- no ref stored, never cleared
    setBackupState("idle");
    setGlobalProgress(0);
  }, 3000);
}
```

The same pattern exists in the completion handler (BUG-1).

### Suggested Fix

Store timeout IDs in a ref and clear them at the start of `handleStartBackup`.

---

## BUG-3: rclone sync deletes previously-synced folders when deselected

**Severity:** MEDIUM
**Files:** `src-tauri/src/commands/backup.rs:129-143`

### Description

When a user deselects a session folder that was previously backed up, the rclone filter rules cause `rclone sync` to delete that folder from the backup destination. This is because `rclone sync` makes the destination match the source (as filtered), and excluded folders are treated as "not present" in the source.

### Reproduction

1. Back up a session with all folders selected (Capture, Selects, Output)
2. Go to preferences and deselect "Output"
3. Run another backup
4. The "Output" folder is deleted from the backup destination

### Root Cause

The filter generation produces rules like:

```
+ /Capture
+ /Capture/**
+ /Selects
+ /Selects/**
- /**
```

The `- /**` catch-all exclude, combined with `rclone sync`, causes anything not explicitly included to be removed from the destination.

### Suggested Fix

Consider using `rclone copy` instead of `rclone sync` to avoid deletions entirely, or add `--ignore-existing`/`--no-delete` flags. Alternatively, warn the user that deselecting a folder will remove it from backup destinations.

---

## BUG-4: Stale closure in getFolderStatus inside state updater

**Severity:** LOW
**Files:** `src/App.tsx:722-728`

### Description

Inside the `setSelectedPaths` state updater function, `getFolderStatus` reads `selectedPaths` from component state instead of from the updater's `prev` argument. If React batches state updates, this could produce incorrect results.

### Root Cause

```javascript
setSelectedPaths((prev) => {
  if (isRoot) {
    if (getFolderStatus(rootPath) === "all") { // reads component-level selectedPaths
      return [];
    }
  }
  // ...
});
```

`getFolderStatus` at line 699 references the outer `selectedPaths` state variable, not the `prev` parameter.

### Suggested Fix

Pass `prev` into the folder status check, or inline the logic using `prev` instead of calling `getFolderStatus`.

---

## BUG-5: Destination ID collision risk

**Severity:** LOW
**Files:** `src-tauri/src/commands/destinations.rs:30-33`

### Description

Destination IDs are generated from `SystemTime::now().as_millis() as u64`. Two destinations created within the same millisecond receive the same ID, which would break all ID-based operations (toggle, remove, pin, progress tracking, animations).

### Root Cause

```rust
let id = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap()
    .as_millis() as u64;
```

### Suggested Fix

Use an `AtomicU64` counter, or combine the timestamp with a random component (e.g., `as_nanos()` or a random suffix).

---

## BUG-6: Scheduler fires backup ~60s after every app launch

**Severity:** LOW
**Files:** `src/hooks/useScheduler.ts:14-19`

### Description

The scheduler's `lastBackupRef` starts as `null`. The first interval check (at 60 seconds) sees no previous backup and immediately triggers one, regardless of the configured interval. This means every app launch results in an automatic backup after ~1 minute, even if the interval is set to 30 minutes.

### Root Cause

```javascript
const checkInterval = setInterval(() => {
  const lastBackup = lastBackupRef.current;
  if (!lastBackup || ...) {   // null on first check = always triggers
    lastBackupRef.current = now;
    onTrigger();
  }
}, 60000);
```

### Suggested Fix

Initialize `lastBackupRef` to `new Date()` on mount so the first scheduled backup respects the configured interval. Or persist the last backup timestamp and restore it on launch.

---

## BUG-7: Incorrect #[allow(dead_code)] annotation

**Severity:** COSMETIC
**Files:** `src-tauri/src/commands/backup.rs:34`

### Description

The `selected_paths` field on `BackupRequest` is annotated with `#[allow(dead_code)]` but is actively used at line 122. The annotation should be removed.
