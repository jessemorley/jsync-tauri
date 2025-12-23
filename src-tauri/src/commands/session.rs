use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use log::{info, error};

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionInfo {
    pub name: String,
    pub path: String,
    pub size: String,
    pub image_count: u32,
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
        if application "Capture One" is running then
            tell application "Capture One"
                if exists (front document) then
                    try
                        set docPath to path of front document
                        set docName to name of front document
                        return (POSIX path of docPath) & "|" & docName
                    on error err
                        return "ERROR|" & err
                    end try
                else
                    return "NO_SESSION|None"
                end if
            end tell
        else
            return "NOT_RUNNING|None"
        end if
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
    info!("AppleScript raw output: {}", stdout);

    let parts: Vec<&str> = stdout.split('|').collect();
    if parts.is_empty() {
        return Err("Empty response from AppleScript".to_string());
    }

    match parts[0] {
        "NO_SESSION" => return Err("No active Capture One session".to_string()),
        "NOT_RUNNING" => return Err("Capture One is not running".to_string()),
        "ERROR" => {
            let err_msg = parts.get(1).unwrap_or(&"Unknown error");
            error!("Capture One AppleScript error: {}", err_msg);
            return Err(format!("Capture One error: {}", err_msg));
        },
        _ => {}
    }

    if parts.len() < 2 {
        return Err("Invalid session response format".to_string());
    }

    let raw_path = parts[0];
    let doc_name = parts[1];
    
    // Clean up session name (remove common extensions)
    let session_name = doc_name
        .trim_end_matches(".cosessiondb")
        .trim_end_matches(".cocatalog")
        .to_string();

    let path_obj = std::path::Path::new(raw_path);
    let mut session_folder = if path_obj.is_dir() {
        // If it's a directory (like a Catalog), use it directly
        raw_path.to_string()
    } else {
        // If it's a file (like a .cosessiondb), the session folder is its parent
        path_obj.parent()
            .and_then(|p| p.to_str())
            .unwrap_or(raw_path)
            .to_string()
    };

    // Heuristic: If the folder we found doesn't match the session name, 
    // but there's a subfolder that DOES match the session name, use that.
    // This handles cases where the .cosessiondb is sitting next to the session folder
    // or when the user has a generic 'Capture One' parent folder.
    let folder_name = std::path::Path::new(&session_folder)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("");

    if folder_name != session_name {
        let subfolder = std::path::Path::new(&session_folder).join(&session_name);
        if subfolder.is_dir() {
            info!("Heuristic triggered: using subfolder matching session name: {:?}", subfolder);
            if let Some(s) = subfolder.to_str() {
                session_folder = s.to_string();
            }
        }
    }

    info!("Detected Session Name: {}", session_name);
    info!("Detected Session Folder: {}", session_folder);

    // Calculate session size
    let size = get_folder_size(&session_folder).await.unwrap_or_else(|e| {
        error!("Size calculation error for {}: {}", session_folder, e);
        "Unknown".to_string()
    });

    // Get image count
    let image_count = get_image_count(&session_folder).await;

    Ok(SessionInfo {
        name: session_name,
        path: session_folder,
        size,
        image_count,
    })
}

#[tauri::command]
pub async fn get_session_contents(path: String) -> Result<Vec<SessionItem>, String> {
    info!("Getting session contents for path: {}", path);

    let entries = std::fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut items = Vec::new();
    for entry in entries.flatten() {
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

    Ok(items)
}

async fn get_folder_size(path: &str) -> Result<String, String> {
    info!("Calculating size for path: '{}'", path);
    // Use du -sk for kilobytes to handle formatting ourselves
    let output = tokio::process::Command::new("du")
        .args(["-sk", path])
        .output()
        .await
        .map_err(|e| format!("Failed to get folder size: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    info!("du output: {}", stdout.trim());
    
    // Output format: "123456\t/path/to/folder"
    let kb_str = stdout.split_whitespace().next().unwrap_or("0");
    let kb: f64 = kb_str.parse().unwrap_or(0.0);

    if kb > 1024.0 * 1024.0 {
        Ok(format!("{:.2} GB", kb / (1024.0 * 1024.0)))
    } else if kb > 1024.0 {
        Ok(format!("{:.2} MB", kb / 1024.0))
    } else {
        Ok(format!("{:.0} KB", kb))
    }
}

async fn get_image_count(session_path: &str) -> u32 {
    let capture_path = std::path::Path::new(session_path).join("Capture");
    if !capture_path.exists() {
        return 0;
    }

    // Common raw extensions + standard image formats
    let extensions = [
        "cr3", "cr2", "nef", "arw", "raf", "dng", "iiq", "eip", 
        "jpg", "jpeg", "tif", "tiff", "mos", "3fr", "ari", "sr2", "srf", "rw2"
    ];

    let mut count = 0;
    
    // Using std::fs::read_dir since this is a local quick operation
    if let Ok(entries) = std::fs::read_dir(capture_path) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_file() {
                    let path = entry.path();
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                         if extensions.contains(&ext.to_lowercase().as_str()) {
                             count += 1;
                         }
                    }
                }
            }
        }
    }
    count
}
