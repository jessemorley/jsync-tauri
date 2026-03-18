#[cfg(target_os = "macos")]
pub fn set_window_corner_radius(window: &tauri::WebviewWindow, radius: f64, stationary: bool) {
    use cocoa::base::id;
    use objc::{class, msg_send, sel, sel_impl};

    unsafe {
        let ns_window = window.ns_window().unwrap() as id;

        // Ensure window is non-opaque and background is clear
        let _: () = msg_send![ns_window, setOpaque: false];
        let clear_color: id = msg_send![class!(NSColor), clearColor];
        let _: () = msg_send![ns_window, setBackgroundColor: clear_color];
        let _: () = msg_send![ns_window, setAlphaValue: 1.0];

        // Disable native shadow and title bar related artifacts
        let _: () = msg_send![ns_window, setHasShadow: true];
        let _: () = msg_send![ns_window, invalidateShadow];

        // For overlay title bar windows, make the title bar transparent and
        // movable by background so dragging anywhere in the title bar area works
        if !stationary {
            let _: () = msg_send![ns_window, setTitlebarAppearsTransparent: true];
            let _: () = msg_send![ns_window, setMovableByWindowBackground: true];
        }

        // Set window level: tray popup stays above normal windows (level 20),
        // prefs window uses normal level (0) so it behaves like a regular app window
        let level: i64 = if stationary { 20 } else { 0 };
        let _: () = msg_send![ns_window, setLevel: level];

        // Ensure window behaves correctly with full-screen apps and spaces
        // NSWindowCollectionBehaviorCanJoinAllSpaces (1) | NSWindowCollectionBehaviorIgnoresCycle (64) = 65
        // Add NSWindowCollectionBehaviorStationary (16) for tray popup (non-draggable)
        let collection_behavior: u64 = if stationary { 81 } else { 65 };
        let _: () = msg_send![ns_window, setCollectionBehavior: collection_behavior];

        if stationary {
            let content_view: id = msg_send![ns_window, contentView];

            // Enable layer-backed view
            let _: () = msg_send![content_view, setWantsLayer: true];

            // Get the layer
            let layer: id = msg_send![content_view, layer];

            // Set corner radius
            let _: () = msg_send![layer, setCornerRadius: radius];

            // Set mask to bounds to clip the corners
            let _: () = msg_send![layer, setMasksToBounds: true];
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn set_window_corner_radius(_window: &tauri::WebviewWindow, _radius: f64, _stationary: bool) {
    // No-op on non-macOS platforms
}
