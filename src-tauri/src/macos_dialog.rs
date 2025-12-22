#[cfg(target_os = "macos")]
use cocoa::base::{id, nil, YES, NO};
use cocoa::foundation::NSString;
use objc::{class, msg_send, sel, sel_impl};
use log::info;

#[cfg(target_os = "macos")]
pub async fn open_folder_picker() -> Option<String> {
    info!("Opening native macOS folder picker");

    let (tx, rx) = tokio::sync::oneshot::channel();

    // Use dispatch to run on main queue
    dispatch::Queue::main().exec_async(move || {
        unsafe {
            // Create NSOpenPanel
            let open_panel: id = msg_send![class!(NSOpenPanel), openPanel];

            // Configure panel for directory selection
            let _: () = msg_send![open_panel, setCanChooseFiles: NO];
            let _: () = msg_send![open_panel, setCanChooseDirectories: YES];
            let _: () = msg_send![open_panel, setAllowsMultipleSelection: NO];
            let _: () = msg_send![open_panel, setCanCreateDirectories: YES];

            // Set title
            let title = NSString::alloc(nil).init_str("Select Backup Destination");
            let _: () = msg_send![open_panel, setTitle: title];

            // Set prompt button text
            let prompt = NSString::alloc(nil).init_str("Select");
            let _: () = msg_send![open_panel, setPrompt: prompt];

            // Run modal - safe on main thread
            let response: isize = msg_send![open_panel, runModal];

            info!("Dialog response: {:?}", response);

            let result = if response == 1 { // NSModalResponseOK = 1
                let urls: id = msg_send![open_panel, URLs];
                let count: usize = msg_send![urls, count];

                info!("Selected URLs count: {}", count);

                if count > 0 {
                    let url: id = msg_send![urls, objectAtIndex: 0usize];
                    let path: id = msg_send![url, path];

                    // Convert NSString to Rust String
                    let utf8: *const i8 = msg_send![path, UTF8String];
                    let path_str = std::ffi::CStr::from_ptr(utf8)
                        .to_string_lossy()
                        .into_owned();

                    info!("Selected path: {}", path_str);
                    Some(path_str)
                } else {
                    None
                }
            } else {
                None
            };

            let _ = tx.send(result);
        }
    });

    // Wait for completion
    rx.await.ok().flatten()
}

#[cfg(not(target_os = "macos"))]
pub async fn open_folder_picker() -> Option<String> {
    None
}
