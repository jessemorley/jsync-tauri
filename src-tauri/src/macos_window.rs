#[cfg(target_os = "macos")]
pub fn set_window_corner_radius(window: &tauri::WebviewWindow, radius: f64) {
    use cocoa::base::id;
    use objc::{msg_send, sel, sel_impl, class};

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

        // Set window level to stay above normal windows but below the menubar
        // NSMainMenuWindowLevel = 24, so we use 20 to stay just below it
        let _: () = msg_send![ns_window, setLevel: 20];

        // Ensure window behaves correctly with full-screen apps and spaces
        // NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorStationary | NSWindowCollectionBehaviorIgnoresCycle
        // 1 | 16 | 64 = 81
        let _: () = msg_send![ns_window, setCollectionBehavior: 81];

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

#[cfg(not(target_os = "macos"))]
pub fn set_window_corner_radius(_window: &tauri::WebviewWindow, _radius: f64) {
    // No-op on non-macOS platforms
}
