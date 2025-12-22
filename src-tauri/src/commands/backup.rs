use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use log::{info, error};
use regex::Regex;

static BACKUP_CANCELLED: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Serialize)]
pub struct BackupProgress {
    pub destination_id: u64,
    pub percent: f64,
    pub current_file: String,
    pub transfer_rate: String,
    pub files_transferred: u32,
    pub total_files: u32,
}

#[derive(Clone, Serialize)]
pub struct BackupComplete {
    pub destination_id: u64,
    pub success: bool,
    pub files_copied: u32,
    pub size_transferred: String,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BackupRequest {
    pub session_path: String,
    pub session_name: String,
    pub destinations: Vec<BackupDestination>,
    #[allow(dead_code)]
    pub selected_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct BackupDestination {
    pub id: u64,
    pub path: String,
    pub enabled: bool,
}

#[tauri::command]
pub async fn start_backup(app: AppHandle, request: BackupRequest) -> Result<(), String> {
    info!("Starting backup for session: {}", request.session_path);
    BACKUP_CANCELLED.store(false, Ordering::SeqCst);

    let enabled_destinations: Vec<_> = request.destinations.iter().filter(|d| d.enabled).collect();

    if enabled_destinations.is_empty() {
        return Err("No destinations enabled".to_string());
    }

    for (index, dest) in enabled_destinations.iter().enumerate() {
        info!("Processing destination {}/{} (ID: {})", index + 1, enabled_destinations.len(), dest.id);
        
        if BACKUP_CANCELLED.load(Ordering::SeqCst) {
            info!("Backup cancellation detected before destination {}", dest.id);
            return Err("Backup cancelled".to_string());
        }

        // Verify destination exists
        if !std::path::Path::new(&dest.path).exists() {
            error!("Destination not accessible: {}", dest.path);
            app.emit("backup-error", BackupComplete {
                destination_id: dest.id,
                success: false,
                files_copied: 0,
                size_transferred: "0".to_string(),
                error: Some(format!("Destination not accessible: {}", dest.path)),
            }).ok();
            continue;
        }

        info!("Running backup to destination: {}", dest.path);
        
        // Create a subfolder in the destination for this session
        let session_dest_path = std::path::Path::new(&dest.path).join(&request.session_name);
        let session_dest_str = session_dest_path.to_str().unwrap_or(&dest.path);

        if let Err(e) = run_rsync_backup(&app, &request.session_path, session_dest_str, dest.id).await {
            if e == "Backup cancelled" {
                info!("Backup loop aborted due to cancellation");
                return Err("Backup cancelled".to_string());
            }

            error!("Backup failed for {}: {}", dest.path, e);
            app.emit("backup-error", BackupComplete {
                destination_id: dest.id,
                success: false,
                files_copied: 0,
                size_transferred: "0".to_string(),
                error: Some(e),
            }).ok();
        }
    }

    Ok(())
}

#[tauri::command]
pub fn cancel_backup() {
    info!("COMMAND: cancel_backup received");
    BACKUP_CANCELLED.store(true, Ordering::SeqCst);
    info!("BACKUP_CANCELLED flag set to true");
}

async fn run_rsync_backup(
    app: &AppHandle,
    source: &str,
    dest_path: &str,
    dest_id: u64,
) -> Result<(), String> {
    // Ensure source and destination have trailing slashes so rsync mirrors the content
    let src = format!("{}/", source.trim_end_matches('/'));
    let dst = format!("{}/", dest_path.trim_end_matches('/'));

    info!("Starting rsync: {} -> {}", src, dst);

    // Ensure destination directory exists
    std::fs::create_dir_all(dest_path).map_err(|e| format!("Failed to create destination: {}", e))?;

    let mut child = Command::new("rsync")
        .args(&["-av", "--delete", "--progress", "--stats", &src, &dst])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn rsync: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let mut reader = BufReader::new(stdout).lines();

    let progress_regex = Regex::new(r"(\d+)%").unwrap();
    let rate_regex = Regex::new(r"(\d+\.?\d*[KMG]B/s)").unwrap();
    let mut last_percent = 0.0;

    loop {
        // Check for cancellation at the start of every loop iteration
        if BACKUP_CANCELLED.load(Ordering::SeqCst) {
            info!("Cancellation requested. Killing rsync process...");
            let _ = child.kill().await;
            let _ = child.wait().await; // Wait for it to actually die
            return Err("Backup cancelled".to_string());
        }

        tokio::select! {
            line_result = reader.next_line() => {
                match line_result {
                    Ok(Some(line)) => {
                        if let Some(caps) = progress_regex.captures(&line) {
                            if let Ok(percent) = caps[1].parse::<f64>() {
                                if (percent - last_percent).abs() >= 1.0 || percent == 100.0 {
                                    last_percent = percent;
                                    let rate = rate_regex.captures(&line)
                                        .map(|c| c[1].to_string())
                                        .unwrap_or_default();

                                    let _ = app.emit("backup-progress", BackupProgress {
                                        destination_id: dest_id,
                                        percent,
                                        current_file: String::new(),
                                        transfer_rate: rate,
                                        files_transferred: 0,
                                        total_files: 0,
                                    });
                                }
                            }
                        }
                    }
                    Ok(None) => break, // Rsync finished output
                    Err(e) => return Err(format!("Output error: {}", e)),
                }
            }
            _ = tokio::time::sleep(std::time::Duration::from_millis(200)) => {
                // Periodically wake up to check the cancellation flag even if no output
                continue;
            }
        }
    }

    let status = child.wait().await.map_err(|e| format!("rsync wait error: {}", e))?;
    if !status.success() {
        return Err(format!("rsync failed with status: {}", status));
    }

    info!("Backup completed successfully for destination {}", dest_id);
    let _ = app.emit("backup-complete", BackupComplete {
        destination_id: dest_id,
        success: true,
        files_copied: 0,
        size_transferred: "0".to_string(),
        error: None,
    });

    Ok(())
}
