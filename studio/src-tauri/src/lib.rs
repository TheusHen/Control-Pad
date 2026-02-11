mod actions;
mod commands;
mod config_store;
mod hid_listener;
mod models;
mod state;

use tauri::{Manager, State};

use crate::config_store::load_config;
use crate::hid_listener::start_listener_internal;
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let config = load_config();
            app.manage(AppState::new(config.clone()));

            if !config.selected_device_path.trim().is_empty() {
                let state: State<'_, AppState> = app.state();
                let _ = start_listener_internal(&app.handle(), &state);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::save_config,
            commands::list_hid_devices,
            commands::start_hid_listener,
            commands::stop_hid_listener,
            commands::get_listener_status,
            commands::set_active_profile,
            commands::trigger_input
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
