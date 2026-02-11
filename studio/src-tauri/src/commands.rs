use tauri::{AppHandle, State};

use crate::actions::execute_action;
use crate::config_store::save_config_to_disk;
use crate::hid_listener::{
    listener_running, list_hid_devices as hid_list_hid_devices, start_listener_internal,
    stop_listener_internal,
};
use crate::models::{map_input_to_action, sanitize_config, ListenerStatus, StudioConfig, INPUT_COUNT};
use crate::state::AppState;

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> StudioConfig {
    match state.config.lock() {
        Ok(config) => config.clone(),
        Err(_) => StudioConfig::default(),
    }
}

#[tauri::command]
pub fn save_config(state: State<'_, AppState>, config: StudioConfig) -> Result<(), String> {
    let sanitized = sanitize_config(config);
    save_config_to_disk(&sanitized)?;

    let mut lock = state
        .config
        .lock()
        .map_err(|_| "Config lock was poisoned".to_string())?;
    *lock = sanitized;
    Ok(())
}

#[tauri::command]
pub fn list_hid_devices() -> Result<Vec<crate::models::HidDeviceEntry>, String> {
    hid_list_hid_devices()
}

#[tauri::command]
pub fn start_hid_listener(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    start_listener_internal(&app, &state)
}

#[tauri::command]
pub fn stop_hid_listener(state: State<'_, AppState>) {
    stop_listener_internal(&state);
}

#[tauri::command]
pub fn get_listener_status(state: State<'_, AppState>) -> ListenerStatus {
    ListenerStatus {
        running: listener_running(&state),
    }
}

#[tauri::command]
pub fn set_active_profile(state: State<'_, AppState>, profile_id: String) -> Result<(), String> {
    let mut config = state
        .config
        .lock()
        .map_err(|_| "Config lock was poisoned".to_string())?;

    if !config.profiles.iter().any(|profile| profile.id == profile_id) {
        return Err("Profile not found".to_string());
    }

    config.active_profile_id = profile_id;
    let snapshot = config.clone();
    drop(config);

    save_config_to_disk(&snapshot)
}

#[tauri::command]
pub fn trigger_input(state: State<'_, AppState>, input_id: usize) -> Result<(), String> {
    if input_id >= INPUT_COUNT {
        return Err("Input id out of range".to_string());
    }

    let config = state
        .config
        .lock()
        .map_err(|_| "Config lock was poisoned".to_string())?
        .clone();
    let action = map_input_to_action(&config, input_id).ok_or("Missing input action".to_string())?;
    execute_action(&action)
}
