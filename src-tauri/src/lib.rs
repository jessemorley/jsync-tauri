use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, RunEvent,
};
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_positioner::{Position, WindowExt};
use log::info;

mod commands;
mod macos_window;
mod macos_dialog;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_log::Builder::default()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: Some("jsync.log".into()) }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .setup(|app| {
            info!("Setting up JSync application");

            // Hide from dock on macOS
            #[cfg(target_os = "macos")]
            {
                use tauri::ActivationPolicy;
                app.set_activation_policy(ActivationPolicy::Accessory);
                info!("Set activation policy to Accessory (no dock icon)");
                
                // Pre-initialize dialog components to reduce wait time on first use
                macos_dialog::warm_up();
            }

            // Setup system tray
            setup_tray(app)?;

            // Apply rounded corners to main window
            if let Some(window) = app.get_webview_window("main") {
                macos_window::set_window_corner_radius(&window, 16.0);
                info!("Applied rounded corners to main window");
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Focused(is_focused) = event {
                // Auto-hide when window loses focus
                if !is_focused {
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::session::get_capture_one_session,
            commands::session::get_session_contents,
            commands::session::load_session_config,
            commands::session::save_session_config,
            commands::destinations::open_folder_picker,
            commands::destinations::parse_destination,
            commands::destinations::delete_backup_folder,
            commands::backup::start_backup,
            commands::backup::cancel_backup,
            commands::permissions::check_full_disk_access,
            commands::quit_app,
            commands::send_notification,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                // Prevent exit when window closes - keep app running in tray
                api.prevent_exit();
            }
        });
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    info!("Setting up system tray");

    let quit_item = MenuItem::with_id(app, "quit", "Quit JSync", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quit_item])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            if event.id.as_ref() == "quit" {
                info!("Quit menu item clicked");
                app.exit(0);
            }
        })
        .on_tray_icon_event(move |tray, event| {
            tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);

            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        // Position window below tray icon before showing
                        let _ = window.move_window(Position::TrayCenter);
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.emit("refresh-session", ());
                    }
                }
            }
        })
        .build(app)?;

    info!("System tray setup complete");
    Ok(())
}
