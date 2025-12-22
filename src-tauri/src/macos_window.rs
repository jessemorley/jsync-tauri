#[cfg(target_os = "macos")]
pub fn set_window_corner_radius(window: &tauri::WebviewWindow, radius: f64) {
    use cocoa::base::id;
    use objc::{msg_send, sel, sel_impl, class};

    unsafe {
        let ns_window = window.ns_window().unwrap() as id;

        // Set window background to clear
        let clear_color: id = msg_send![class!(NSColor), clearColor];
        let _: () = msg_send![ns_window, setBackgroundColor: clear_color];
        let _: () = msg_send![ns_window, setOpaque: false];
        let _: () = msg_send![ns_window, setHasShadow: true];
        let _: () = msg_send![ns_window, invalidateShadow];

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
