use serde::{Deserialize, Serialize};
use std::path::Path;
use log::info;
use tauri::AppHandle;

#[derive(Debug, Serialize, Deserialize)]
pub struct Destination {
    pub id: u64,
    pub path: String,
    pub label: String,
    pub destination_type: String, // "external" | "cloud" | "local" | "network"
    pub enabled: bool,
}

#[tauri::command]
pub async fn open_folder_picker(_app: AppHandle) -> Result<Option<String>, String> {
    info!("Opening folder picker with custom NSOpenPanel");

    // Use custom macOS implementation to avoid sheet dimming effect
    let result = crate::macos_dialog::open_folder_picker().await;

    info!("Folder selection result: {:?}", result);
    Ok(result)
}

#[tauri::command]
pub fn parse_destination(path: String) -> Destination {
    info!("Parsing destination path: {}", path);

    let id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;

    let (label, destination_type) = detect_destination_type(&path);

    Destination {
        id,
        path,
        label,
        destination_type,
        enabled: true,
    }
}

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

fn detect_destination_type(path: &str) -> (String, String) {
    let path_lower = path.to_lowercase();

    // Check for cloud providers
    if path_lower.contains("dropbox") {
        return ("Dropbox".to_string(), "cloud".to_string());
    }
    if path_lower.contains("google drive") || path_lower.contains("googledrive") {
        return ("Google Drive".to_string(), "cloud".to_string());
    }
    if path_lower.contains("onedrive") {
        return ("OneDrive".to_string(), "cloud".to_string());
    }
    if path_lower.contains("icloud") {
        return ("iCloud".to_string(), "cloud".to_string());
    }

    // Check for external volumes
    if path.starts_with("/Volumes/") {
        let volume_name = path
            .strip_prefix("/Volumes/")
            .and_then(|s| s.split('/').next())
            .unwrap_or("External Drive")
            .to_string();
        return (volume_name, "external".to_string());
    }

    // Check for network paths
    if path.starts_with("/net/") || path.starts_with("smb://") || path.starts_with("afp://") {
        let label = Path::new(&path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or("Network".to_string());
        return (label, "network".to_string());
    }

    // Default to local
    let label = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or("Local".to_string());

    (label, "local".to_string())
}
