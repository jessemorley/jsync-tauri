#[cfg(target_os = "macos")]
use cocoa::base::{id, nil, YES, NO};
use cocoa::foundation::NSString;
use objc::{class, msg_send, sel, sel_impl};
use objc::runtime::Object;
use std::sync::atomic::{AtomicPtr, Ordering};
use log::info;

#[cfg(target_os = "macos")]
static PANEL_INSTANCE: AtomicPtr<Object> = AtomicPtr::new(std::ptr::null_mut());

#[cfg(target_os = "macos")]
unsafe fn get_shared_panel() -> id {
    let ptr = PANEL_INSTANCE.load(Ordering::SeqCst);
    if !ptr.is_null() {
        return ptr as id;
    }

    // Create new instance
    let panel: id = msg_send![class!(NSOpenPanel), openPanel];
    
    // Retain it so it persists globally (openPanel usually returns autoreleased)
    let _: () = msg_send![panel, retain];

    // Configure persistent settings
    let _: () = msg_send![panel, setCanChooseFiles: NO];
    let _: () = msg_send![panel, setCanChooseDirectories: YES];
    let _: () = msg_send![panel, setAllowsMultipleSelection: NO];
    let _: () = msg_send![panel, setCanCreateDirectories: YES];

    // Set title
    let title = NSString::alloc(nil).init_str("Select Backup Destination");
    let _: () = msg_send![panel, setTitle: title];

    // Set prompt button text
    let prompt = NSString::alloc(nil).init_str("Select");
    let _: () = msg_send![panel, setPrompt: prompt];

    PANEL_INSTANCE.store(panel as *mut Object, Ordering::SeqCst);
    panel
}

#[cfg(target_os = "macos")]
pub fn warm_up() {
    info!("Warming up macOS dialog components");
    dispatch::Queue::main().exec_async(move || {
        unsafe {
            let _ = get_shared_panel();
        }
    });
}

#[cfg(not(target_os = "macos"))]
pub fn warm_up() {}

#[cfg(target_os = "macos")]
pub async fn open_folder_picker() -> Option<String> {
    info!("Opening native macOS folder picker");

    let (tx, rx) = tokio::sync::oneshot::channel();

    // Use dispatch to run on main queue
    dispatch::Queue::main().exec_async(move || {
        unsafe {
            // Get shared panel instance
            let open_panel = get_shared_panel();

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
