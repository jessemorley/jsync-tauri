use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use log::{info, error};

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

#[derive(Debug, Deserialize)]
struct RcloneStats {
    bytes: u64,
    #[serde(rename = "totalBytes")]
    total_bytes: u64,
    transfers: u32,
    #[serde(rename = "totalTransfers")]
    total_transfers: u32,
    checks: u32,
    #[serde(rename = "totalChecks")]
    total_checks: u32,
    speed: f64,
}

#[derive(Debug, Deserialize)]
struct RcloneJsonLog {
    stats: Option<RcloneStats>,
    msg: Option<String>,
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

        if let Err(e) = run_rclone_backup(&app, &request.session_path, session_dest_str, dest.id).await {
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

// Helper functions for formatting
fn format_speed(bytes_per_sec: f64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;

    if bytes_per_sec >= GB {
        format!("{:.2} GB/s", bytes_per_sec / GB)
    } else if bytes_per_sec >= MB {
        format!("{:.2} MB/s", bytes_per_sec / MB)
    } else if bytes_per_sec >= KB {
        format!("{:.2} KB/s", bytes_per_sec / KB)
    } else {
        format!("{:.0} B/s", bytes_per_sec)
    }
}

async fn run_rclone_backup(
    app: &AppHandle,
    source: &str,
    dest_path: &str,
    dest_id: u64,
) -> Result<(), String> {
    // Ensure source and destination have trailing slashes for rclone sync
    let src = format!("{}/", source.trim_end_matches('/'));
    let dst = format!("{}/", dest_path.trim_end_matches('/'));

    info!("Starting rclone sync: {} -> {}", src, dst);

    // Ensure destination directory exists
    std::fs::create_dir_all(dest_path).map_err(|e| format!("Failed to create destination: {}", e))?;

    // Get rclone sidecar command
    let rclone_cmd = app.path().resolve("rclone", tauri::path::BaseDirectory::Resource)
        .map_err(|e| format!("Failed to resolve rclone path: {}", e))?;

    info!("Resolved rclone path: {:?}", rclone_cmd);

    let mut child = Command::new(rclone_cmd)
        .args([
            "sync",
            &src,
            &dst,
            "--check-first",
            "--use-json-log",
            "--stats", "500ms",
            "--stats-log-level", "NOTICE",
            "--transfers", "4",
            "--checkers", "8",
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn rclone: {}", e))?;

    // Read stderr (JSON logs)
    let stderr = child.stderr.take().unwrap();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut last_percent = 0.0;
    let mut total_files = 0u32;

    loop {
        // Check for cancellation
        if BACKUP_CANCELLED.load(Ordering::SeqCst) {
            info!("Cancellation requested. Killing rclone process...");
            let _ = child.kill().await;
            let _ = child.wait().await;
            return Err("Backup cancelled".to_string());
        }

        tokio::select! {
            stderr_line = stderr_reader.next_line() => {
                match stderr_line {
                    Ok(Some(line)) => {
                        if let Ok(log) = serde_json::from_str::<RcloneJsonLog>(&line) {
                            if let Some(stats) = log.stats {
                                let percent = if stats.total_bytes > 0 {
                                    (stats.bytes as f64 / stats.total_bytes as f64) * 100.0
                                } else if stats.total_checks > 0 {
                                    (stats.checks as f64 / stats.total_checks as f64) * 100.0
                                } else if stats.total_transfers > 0 {
                                    (stats.transfers as f64 / stats.total_transfers as f64) * 100.0
                                } else {
                                    100.0
                                };

                                total_files = stats.total_transfers + stats.total_checks;
                                let files_transferred = stats.transfers + stats.checks;

                                if (percent - last_percent).abs() >= 0.1 || percent == 100.0 {
                                    last_percent = percent;

                                    let _ = app.emit("backup-progress", BackupProgress {
                                        destination_id: dest_id,
                                        percent,
                                        current_file: String::new(),
                                        transfer_rate: format_speed(stats.speed),
                                        files_transferred,
                                        total_files,
                                    });
                                }
                            } else if let Some(msg) = log.msg {
                                if !msg.is_empty() {
                                    let trimmed = msg.trim();
                                    if !trimmed.is_empty() {
                                        info!("rclone: {}", trimmed);
                                    }
                                }
                            }
                        } else {
                            // If it's not JSON, it might be a raw message
                            let trimmed = line.trim();
                            if !trimmed.is_empty() {
                                info!("rclone raw: {}", trimmed);
                            }
                        }
                    }
                    Ok(None) => break, // stderr closed
                    Err(e) => error!("stderr read error: {}", e),
                }
            }
            _ = tokio::time::sleep(std::time::Duration::from_millis(200)) => {
                // Periodically wake up to check the cancellation flag
                continue;
            }
        }
    }

    let status = child.wait().await.map_err(|e| format!("rclone wait error: {}", e))?;
    if !status.success() {
        return Err(format!("rclone failed with status: {}", status));
    }

    info!("Backup completed successfully for destination {}", dest_id);

    // Emit completion event with final stats
    let _ = app.emit("backup-complete", BackupComplete {
        destination_id: dest_id,
        success: true,
        files_copied: total_files,
        size_transferred: String::new(), // Will be shown in final progress update
        error: None,
    });

    Ok(())
}
