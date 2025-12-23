use std::fs;
use log::{info, error};

#[tauri::command]
pub fn check_full_disk_access() -> bool {
    info!("Checking Full Disk Access permission");

    // Try to access a protected directory that requires Full Disk Access
    let test_paths = vec![
        "/Library/Application Support/com.apple.TCC".to_string(),
        format!("{}/Library/Safari", std::env::var("HOME").unwrap_or_default()),
    ];

    for path in test_paths {
        if let Ok(metadata) = fs::metadata(&path) {
            if metadata.is_dir() && fs::read_dir(&path).is_ok() {
                info!("Full Disk Access granted (verified via {})", path);
                return true;
            }
        }
    }

    error!("Full Disk Access not granted");
    false
}
