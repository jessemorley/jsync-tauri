pub mod session;
pub mod destinations;
pub mod backup;
pub mod permissions;

#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}
