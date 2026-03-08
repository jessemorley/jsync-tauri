use log::info;
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::AppHandle;

#[derive(Debug, Serialize)]
pub struct DiskInfo {
    pub total_bytes: u64,
    pub available_bytes: u64,
}

#[tauri::command]
pub fn get_disk_info(path: String) -> Result<DiskInfo, String> {
    let output = std::process::Command::new("df")
        .args(["-k", &path])
        .output()
        .map_err(|e| format!("Failed to run df: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout.lines().nth(1).ok_or("No df output")?;
    let parts: Vec<&str> = line.split_whitespace().collect();

    if parts.len() < 4 {
        return Err("Unexpected df output format".to_string());
    }

    let total_1k: u64 = parts[1].parse().map_err(|_| "Failed to parse total".to_string())?;
    let available_1k: u64 = parts[3].parse().map_err(|_| "Failed to parse available".to_string())?;

    Ok(DiskInfo {
        total_bytes: total_1k * 1024,
        available_bytes: available_1k * 1024,
    })
}

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
pub async fn delete_backup_folder(
    destination_path: String,
    session_name: String,
) -> Result<(), String> {
    info!(
        "Deleting backup folder for session '{}' at '{}'",
        session_name, destination_path
    );

    let backup_path = Path::new(&destination_path).join(&session_name);

    if !backup_path.exists() {
        return Err(format!("Backup folder does not exist: {:?}", backup_path));
    }

    std::fs::remove_dir_all(&backup_path).map_err(|e| format!("Failed to delete backup: {}", e))?;

    info!("Successfully deleted backup at {:?}", backup_path);
    Ok(())
}

#[tauri::command]
pub fn check_path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub fn create_directory(path: String) -> Result<(), String> {
    info!("Creating directory: {}", path);
    std::fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory: {}", e))
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
