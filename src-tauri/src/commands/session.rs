use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use log::{info, error};

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionInfo {
    pub name: String,
    pub path: String,
    pub size: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionItem {
    pub id: String,
    pub label: String,
    pub item_type: String, // "folder" | "file"
}

#[tauri::command]
pub async fn get_capture_one_session(app: AppHandle) -> Result<SessionInfo, String> {
    info!("Getting Capture One session info");

    let script = r#"
        tell application "Capture One"
            if (count of documents) > 0 then
                tell front document
                    set sessionPath to path as text
                    set sessionName to name as text
                    return sessionPath & "|" & sessionName
                end tell
            else
                return "NO_SESSION"
            end if
        end tell
    "#;

    let shell = app.shell();
    let output = shell
        .command("osascript")
        .args(["-e", script])
        .output()
        .await
        .map_err(|e| {
            error!("Failed to execute AppleScript: {}", e);
            format!("Failed to execute AppleScript: {}", e)
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    info!("AppleScript output: {}", stdout);

    if stdout == "NO_SESSION" || stdout.is_empty() {
        return Err("No active Capture One session".to_string());
    }

    let parts: Vec<&str> = stdout.split('|').collect();
    if parts.len() != 2 {
        return Err("Invalid session response".to_string());
    }

    // Convert macOS path format (with colons) to POSIX
    let mac_path = parts[0];
    let session_name = parts[1].trim_end_matches(".cosessiondb").to_string();

    // Convert from "Macintosh HD:Users:..." to "/Users/..."
    let posix_path = mac_path
        .split(':')
        .skip(1) // Skip "Macintosh HD" or similar
        .collect::<Vec<&str>>()
        .join("/");
    let session_path = format!("/{}/{}", posix_path, session_name);

    // Calculate session size
    let size = get_folder_size(&session_path).await.unwrap_or_else(|_| "Unknown".to_string());

    Ok(SessionInfo {
        name: session_name,
        path: session_path,
        size,
    })
}

#[tauri::command]
pub async fn get_session_contents(path: String) -> Result<Vec<SessionItem>, String> {
    info!("Getting session contents for path: {}", path);

    let entries = std::fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut items = Vec::new();
    for entry in entries {
        if let Ok(entry) = entry {
            let file_name = entry.file_name().to_string_lossy().to_string();
            let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);

            // Filter for standard C1 structures
            let is_standard = matches!(
                file_name.as_str(),
                "Capture" | "Selects" | "Output" | "Trash"
            );

            let is_session_db = file_name.ends_with(".cosessiondb");

            if is_standard || is_session_db || is_dir {
                items.push(SessionItem {
                    id: format!("{}/{}", path, file_name),
                    label: file_name,
                    item_type: if is_dir { "folder".to_string() } else { "file".to_string() },
                });
            }
        }
    }

    Ok(items)
}

async fn get_folder_size(path: &str) -> Result<String, String> {
    let output = tokio::process::Command::new("du")
        .args(["-sh", path])
        .output()
        .await
        .map_err(|e| format!("Failed to get folder size: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let size = stdout.split_whitespace().next().unwrap_or("0B").to_string();
    Ok(size)
}
