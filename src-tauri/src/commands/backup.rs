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
    pub destinations: Vec<BackupDestination>,
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

    for dest in enabled_destinations {
        if BACKUP_CANCELLED.load(Ordering::SeqCst) {
            info!("Backup cancelled by user");
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
        if let Err(e) = run_rsync_backup(&app, &request.session_path, dest).await {
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
    info!("Backup cancel requested");
    BACKUP_CANCELLED.store(true, Ordering::SeqCst);
}

async fn run_rsync_backup(
    app: &AppHandle,
    source: &str,
    dest: &BackupDestination,
) -> Result<(), String> {
    // Ensure source path ends with trailing slash for rsync
    let source_with_slash = if source.ends_with('/') {
        source.to_string()
    } else {
        format!("{}/", source)
    };

    let dest_with_slash = format!("{}/", dest.path);

    let rsync_args = vec![
        "-av",
        "--delete",
        "--progress",
        "--stats",
        &source_with_slash,
        &dest_with_slash,
    ];

    info!("Executing rsync with args: {:?}", rsync_args);

    let mut child = Command::new("rsync")
        .args(&rsync_args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            error!("Failed to spawn rsync: {}", e);
            format!("Failed to spawn rsync: {}", e)
        })?;

    let stdout = child.stdout.take().expect("Failed to capture stdout");
    let mut reader = BufReader::new(stdout).lines();

    let progress_regex = Regex::new(r"(\d+)%").unwrap();
    let rate_regex = Regex::new(r"(\d+\.?\d*[KMG]B/s)").unwrap();
    let mut last_percent = 0.0;

    while let Ok(Some(line)) = reader.next_line().await {
        if BACKUP_CANCELLED.load(Ordering::SeqCst) {
            child.kill().await.ok();
            return Err("Backup cancelled".to_string());
        }

        // Parse progress percentage
        if let Some(caps) = progress_regex.captures(&line) {
            if let Some(percent_str) = caps.get(1) {
                if let Ok(percent) = percent_str.as_str().parse::<f64>() {
                    // Only emit if progress changed significantly
                    if (percent - last_percent).abs() > 1.0 {
                        last_percent = percent;

                        let rate = rate_regex.captures(&line)
                            .and_then(|c| c.get(1))
                            .map(|m| m.as_str().to_string())
                            .unwrap_or_default();

                        app.emit("backup-progress", BackupProgress {
                            destination_id: dest.id,
                            percent,
                            current_file: String::new(),
                            transfer_rate: rate,
                            files_transferred: 0,
                            total_files: 0,
                        }).ok();
                    }
                }
            }
        }
    }

    let status = child.wait().await.map_err(|e| format!("rsync process error: {}", e))?;

    if status.success() {
        info!("Backup completed successfully for destination {}", dest.id);
        app.emit("backup-complete", BackupComplete {
            destination_id: dest.id,
            success: true,
            files_copied: 0, // Could parse from rsync stats if needed
            size_transferred: "0".to_string(), // Could parse from rsync stats if needed
            error: None,
        }).ok();
        Ok(())
    } else {
        let error_msg = format!("rsync exited with status: {}", status);
        error!("{}", error_msg);
        Err(error_msg)
    }
}
