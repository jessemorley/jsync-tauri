# Location Options Interface Implementation Plan

## Overview
Replace the trash icon with a settings icon on destination cards. Clicking it transforms the individual card into a 2x2 grid options menu with: Set/Unset Default, Remove Location, Delete Backup, and Return.

## User Requirements (from clarification)
- **Overlay scope**: Replace single card only (card-level expansion)
- **Default behavior**: Template for new sessions (stored globally, new sessions inherit)
- **Delete confirmation**: Yes, show confirmation step
- **State indicators**: Yes, show checkmarks and status

## 1. State Additions (App.tsx)

Add after line 89:

```tsx
// Options Menu State
const [showingOptionsFor, setShowingOptionsFor] = useState<number | null>(null);
const [confirmDeleteBackupFor, setConfirmDeleteBackupFor] = useState<number | null>(null);

// Default Destinations (Global Settings)
const [defaultDestinationIds, setDefaultDestinationIds] = usePersistedState<number[]>('defaultDestinations', []);
```

**Rationale:**
- `showingOptionsFor`: Tracks which card shows options (null = normal view)
- `confirmDeleteBackupFor`: Delete backup confirmation state
- `defaultDestinationIds`: Global array of default destination IDs for new sessions

## 2. Handler Functions

Add after line 386 (after removeDestination):

```tsx
const isDefault = (id: number) => defaultDestinationIds.includes(id);

const toggleDefault = (id: number) => {
  setDefaultDestinationIds(prev => {
    if (prev.includes(id)) {
      return prev.filter(dId => dId !== id);
    } else {
      return [...prev, id];
    }
  });
};

const handleConfirmDeleteBackup = async (dest: Destination) => {
  if (!session) return;

  try {
    await deleteBackupFolder(dest.path, session.name);

    // Update destination state
    setDestinations(prev => prev.map(d =>
      d.id === dest.id ? { ...d, has_existing_backup: false } : d
    ));

    setConfirmDeleteBackupFor(null);
    setShowingOptionsFor(null);
  } catch (error) {
    console.error('Failed to delete backup:', error);
  }
};
```

## 3. Replace Trash Icon with Settings Icon

**Location:** App.tsx lines 603-609

**Replace:**
```tsx
<button
  onClick={() => removeDestination(dest.id)}
  disabled={backupState === 'running'}
  className="z-10 p-1 transition-colors disabled:opacity-0 text-gray-600 hover:text-red-400"
>
  <Trash2 size={12} />
</button>
```

**With:**
```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    setShowingOptionsFor(dest.id);
  }}
  disabled={backupState === 'running'}
  className="z-10 p-1 transition-colors disabled:opacity-0 text-gray-600 hover:text-blue-400"
>
  <Settings size={12} />
</button>
```

**Note:** Settings icon already imported on line 16.

## 4. Options Menu UI Component

**Location:** Replace the entire destination card content (lines 572-611) with conditional rendering:

```tsx
{showingOptionsFor === dest.id ? (
  confirmDeleteBackupFor === dest.id ? (
    // CONFIRMATION UI (54px height maintained)
    <div className="flex flex-col gap-1.5 p-2 justify-center h-full">
      <p className="text-[9px] text-gray-300 font-bold text-center">
        Delete backup at this location?
      </p>
      <div className="flex gap-1.5">
        <button
          onClick={() => handleConfirmDeleteBackup(dest)}
          className="flex-1 py-1 rounded-lg border bg-red-600 border-red-500 text-white hover:bg-red-700 text-[9px] font-bold uppercase"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirmDeleteBackupFor(null)}
          className="flex-1 py-1 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 text-[9px] font-bold uppercase"
        >
          Cancel
        </button>
      </div>
    </div>
  ) : (
    // OPTIONS GRID (2x2, 54px height maintained)
    <div className="grid grid-cols-2 gap-1.5 p-2 h-full">
      {/* Top-left: Set/Unset Default */}
      <button
        onClick={() => toggleDefault(dest.id)}
        className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border transition-all ${
          isDefault(dest.id)
            ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.3)]'
            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-blue-400'
        }`}
      >
        <Check size={10} strokeWidth={3} />
        <span className="text-[8px] font-bold uppercase tracking-wide">
          {isDefault(dest.id) ? 'Default' : 'Set Default'}
        </span>
      </button>

      {/* Top-right: Remove Location */}
      <button
        onClick={() => {
          removeDestination(dest.id);
          setShowingOptionsFor(null);
        }}
        className="flex flex-col items-center justify-center gap-0.5 rounded-lg border bg-white/5 border-white/10 text-gray-400 hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 transition-all"
      >
        <Trash2 size={10} />
        <span className="text-[8px] font-bold uppercase tracking-wide">Remove</span>
      </button>

      {/* Bottom-left: Delete Backup */}
      <button
        onClick={() => setConfirmDeleteBackupFor(dest.id)}
        disabled={!dest.has_existing_backup}
        className={`flex flex-col items-center justify-center gap-0.5 rounded-lg border transition-all ${
          dest.has_existing_backup
            ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-400'
            : 'bg-black/20 border-white/5 text-gray-600 opacity-50 cursor-not-allowed'
        }`}
      >
        <Database size={10} />
        <span className="text-[8px] font-bold uppercase tracking-wide">
          {dest.has_existing_backup ? 'Delete Backup' : 'No Backup'}
        </span>
      </button>

      {/* Bottom-right: Return */}
      <button
        onClick={() => setShowingOptionsFor(null)}
        className="flex flex-col items-center justify-center gap-0.5 rounded-lg border bg-white/5 border-white/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all"
      >
        <X size={10} />
        <span className="text-[8px] font-bold uppercase tracking-wide">Return</span>
      </button>
    </div>
  )
) : (
  // NORMAL CARD CONTENT (existing implementation, keep as-is)
  <>
    {/* Progress bar overlay */}
    {isBackingUp && (
      <div
        className={`absolute inset-y-0 left-0 bg-blue-600 transition-all duration-300 ease-out z-0 ${
          backupState === 'success' ? 'animate-fill-fade opacity-40' : 'opacity-40'
        }`}
        style={{ width: backupState === 'success' ? '100%' : `${globalProgress}%` }}
      />
    )}

    {/* Icon button */}
    <button
      onClick={() => toggleDestination(dest.id)}
      disabled={backupState === 'running'}
      className={`group/icon z-10 relative flex items-center justify-center w-8 h-8 rounded-lg border transition-all overflow-hidden flex-shrink-0 ${
        dest.enabled ? 'bg-white/5 border-white/10 hover:bg-black/10 shadow-sm' : 'bg-white/[0.02] border-white/[0.08] hover:bg-white/5'
      } disabled:cursor-default`}
    >
      {getDestinationIcon(dest.destination_type, dest.enabled)}
    </button>

    {/* Content */}
    <div className="z-10 flex-1 min-w-0">
      <p className={`text-[11px] font-bold leading-none truncate ${dest.enabled ? 'text-gray-200' : 'text-gray-500'}`}>
        {dest.label}
      </p>
      <p className="text-[9.5px] font-mono truncate text-gray-500 mt-1">{dest.path}</p>
    </div>

    {/* Settings button (modified trash button) */}
    <button
      onClick={(e) => {
        e.stopPropagation();
        setShowingOptionsFor(dest.id);
      }}
      disabled={backupState === 'running'}
      className="z-10 p-1 transition-colors disabled:opacity-0 text-gray-600 hover:text-blue-400"
    >
      <Settings size={12} />
    </button>
  </>
)}
```

## 5. Backend: New Rust Command

**File:** `src-tauri/src/commands/destinations.rs`

Add after line 44 (after parse_destination function):

```rust
#[tauri::command]
pub async fn delete_backup_folder(destination_path: String, session_name: String) -> Result<(), String> {
    info!("Deleting backup folder for session '{}' at '{}'", session_name, destination_path);

    let backup_path = Path::new(&destination_path).join(&session_name);

    if !backup_path.exists() {
        return Err(format!("Backup folder does not exist: {:?}", backup_path));
    }

    std::fs::remove_dir_all(&backup_path)
        .map_err(|e| format!("Failed to delete backup: {}", e))?;

    info!("Successfully deleted backup at {:?}", backup_path);
    Ok(())
}
```

**File:** `src-tauri/src/commands/mod.rs`

Update exports line to include new command:
```rust
pub use destinations::{open_folder_picker, parse_destination, delete_backup_folder};
```

**File:** `src/lib/tauri.ts`

Add after line 31:

```tsx
export async function deleteBackupFolder(destinationPath: string, sessionName: string): Promise<void> {
  return invoke('delete_backup_folder', { destinationPath, sessionName });
}
```

## 6. Design Language Matching

**Color Scheme Used:**
- Default active: `bg-blue-600 border-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.3)]`
  - Matches preferences checkbox selected state (App.tsx line 742)
- Option hover: `hover:bg-white/10 hover:text-blue-400`
  - Matches existing button hover states
- Remove hover: `hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400`
  - Matches trash button hover (App.tsx line 606)
- Delete backup hover: `hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-400`
  - Custom warning state, consistent with amber external drive icon
- Disabled: `bg-black/20 border-white/5 text-gray-600 opacity-50`
  - Matches disabled destination card (App.tsx line 574)

**Typography:**
- Button text: `text-[8px] font-bold uppercase tracking-wide`
  - Consistent with section headers and schedule buttons
- Icons: 10px size
  - Proportional to 54px card height and 8px text

**Spacing:**
- Grid gap: `gap-1.5` (6px)
  - Matches existing component spacing
- Padding: `p-2` (8px)
  - Maintains 54px total height with grid content

## 7. Additional Features

**Close on Session Change:**

Add to useEffect that handles session changes (around line 153):

```tsx
useEffect(() => {
  // Reset options menu when session changes
  setShowingOptionsFor(null);
  setConfirmDeleteBackupFor(null);

  // ... existing session change logic
}, [session?.path]);
```

**Reset Options on Backup Start:**

Add to handleStartBackup function:

```tsx
const handleStartBackup = useCallback(async () => {
  // Close any open options menus
  setShowingOptionsFor(null);
  setConfirmDeleteBackupFor(null);

  // ... existing backup logic
}, [...]);
```

## 8. Implementation Sequence

1. **Add state variables** (3 new useState/usePersistedState)
2. **Add handler functions** (isDefault, toggleDefault, handleConfirmDeleteBackup)
3. **Add backend Rust command** (delete_backup_folder in destinations.rs)
4. **Add frontend wrapper** (deleteBackupFolder in tauri.ts)
5. **Update exports** (mod.rs)
6. **Replace trash icon** with Settings icon (1 line change)
7. **Add conditional rendering** for options menu (wrap existing card content)
8. **Add session change cleanup** (reset options state)
9. **Test thoroughly** (all 4 options, confirmation, state indicators)

## 9. Files to Modify

1. **`src/App.tsx`** (PRIMARY)
   - Lines 89: Add state variables
   - Lines 386: Add handler functions
   - Lines 572-611: Replace destination card rendering with conditional options menu
   - Lines 153: Add session change cleanup

2. **`src-tauri/src/commands/destinations.rs`**
   - Line 44: Add delete_backup_folder command

3. **`src-tauri/src/commands/mod.rs`**
   - Update exports to include delete_backup_folder

4. **`src/lib/tauri.ts`**
   - Line 31: Add deleteBackupFolder wrapper function

## 10. Visual State Indicators

**Default Status:**
- Active: Blue background with checkmark icon, blue glow shadow
- Inactive: Gray background, "Set Default" text
- Pattern: Matches preferences checkbox

**Backup Existence:**
- Exists: "Delete Backup" enabled, amber hover
- Missing: "No Backup" disabled, gray with opacity-50
- Pattern: Matches disabled destination cards

**Options Active:**
- Settings icon hover: Blue color (instead of red for trash)
- No card border change (keeps existing state borders)

## 11. Edge Cases Handled

1. **Backup in progress:** Settings button disabled when `backupState === 'running'`
2. **Session change:** Options menu closed automatically
3. **Backup start:** Options menu closed on backup start
4. **Default destination removed:** Automatically removed from defaultDestinationIds via removeDestination
5. **Delete backup fails:** Error logged to console, confirmation stays open
6. **No backup exists:** Delete button disabled and shows "No Backup"

## Testing Checklist

- [ ] Settings icon appears instead of trash icon
- [ ] Click settings icon opens 2x2 options grid
- [ ] "Set Default" toggles blue active state with checkmark
- [ ] "Remove" removes destination and closes options
- [ ] "Delete Backup" shows confirmation when backup exists
- [ ] "Delete Backup" disabled when no backup exists
- [ ] Confirmation "Confirm" deletes backup and updates state
- [ ] Confirmation "Cancel" returns to options grid
- [ ] "Return" closes options and shows normal card
- [ ] Options close on session change
- [ ] Options close on backup start
- [ ] New sessions inherit default destinations
- [ ] Settings button disabled during backup
