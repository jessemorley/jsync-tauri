pub mod backup;
pub mod destinations;
pub mod permissions;
pub mod session;

use tauri::Manager;

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[tauri::command]
pub fn relaunch_app(app: tauri::AppHandle) {
    app.restart();
}

#[tauri::command]
pub fn close_prefs_window(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("prefs") {
        let _ = w.hide();
    }
}

#[tauri::command]
pub async fn open_preferences(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("prefs") {
        w.show().map_err(|e: tauri::Error| e.to_string())?;
        w.set_focus().map_err(|e: tauri::Error| e.to_string())?;
        return Ok(());
    }

    let w = tauri::WebviewWindowBuilder::new(
        &app,
        "prefs",
        tauri::WebviewUrl::App("index.html?window=prefs".into()),
    )
    .title("JSync Preferences")
    .inner_size(400.0, 520.0)
    .decorations(false)
    .transparent(true)
    .skip_taskbar(true)
    .resizable(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    let w_clone = w.clone();
    app.run_on_main_thread(move || {
        crate::macos_window::set_window_corner_radius(&w_clone, 16.0, false);
    }).map_err(|e| e.to_string())?;

    Ok(())
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
