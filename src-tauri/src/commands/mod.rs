pub mod session;
pub mod destinations;
pub mod backup;
pub mod permissions;
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn send_notification(_app: tauri::AppHandle, title: String, body: String) {
    // Direct AppleScript call as a definitive fallback for macOS dev environments
    let script = format!(
        "display notification \"{}\" with title \"{}\" sound name \"Default\"",
        body.replace("\"", "\\\""),
        title.replace("\"", "\\\"")
    );

    let _ = std::process::Command::new("osascript")
        .args(["-e", &script])
        .spawn();
}
