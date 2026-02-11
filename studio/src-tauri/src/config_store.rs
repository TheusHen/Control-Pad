use std::fs;
use std::path::PathBuf;

use crate::models::{sanitize_config, StudioConfig};

fn app_config_path() -> Result<PathBuf, String> {
    let base = dirs::config_dir().ok_or("Could not resolve config directory")?;
    let app_dir = base.join("ControlPadStudio");
    fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create config dir: {e}"))?;
    Ok(app_dir.join("studio-config.json"))
}

pub fn load_config() -> StudioConfig {
    let path = match app_config_path() {
        Ok(path) => path,
        Err(_) => return StudioConfig::default(),
    };

    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(_) => return StudioConfig::default(),
    };

    let config = serde_json::from_str::<StudioConfig>(&raw).unwrap_or_default();
    sanitize_config(config)
}

pub fn save_config_to_disk(config: &StudioConfig) -> Result<(), String> {
    let path = app_config_path()?;
    let raw =
        serde_json::to_string_pretty(config).map_err(|e| format!("Failed to serialize config: {e}"))?;
    fs::write(path, raw).map_err(|e| format!("Failed to write config file: {e}"))
}
