use serde::{Deserialize, Serialize};
use std::path::Path;
use log::info;

#[derive(Debug, Serialize, Deserialize)]
pub struct Destination {
    pub id: u64,
    pub path: String,
    pub label: String,
    pub destination_type: String, // "external" | "cloud" | "local" | "network"
    pub enabled: bool,
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
