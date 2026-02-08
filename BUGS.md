# JSync Bug Report

Audit date: 2026-02-08

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
