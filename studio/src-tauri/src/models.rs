use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

pub const INPUT_COUNT: usize = 15;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionKind {
    None,
    KeyCombo,
    Command,
}

impl Default for ActionKind {
    fn default() -> Self {
        Self::None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ActionConfig {
    #[serde(default)]
    pub kind: ActionKind,
    #[serde(default)]
    pub key_combo: String,
    #[serde(default)]
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub working_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub mappings: Vec<ActionConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudioConfig {
    pub selected_device_path: String,
    pub report_offset: usize,
    pub auto_detect_report_offset: bool,
    pub autostart_enabled: bool,
    pub profiles: Vec<Profile>,
    pub active_profile_id: String,
}

impl Default for StudioConfig {
    fn default() -> Self {
        let profile = default_profile("Default".to_string());
        Self {
            selected_device_path: String::new(),
            report_offset: 0,
            auto_detect_report_offset: true,
            autostart_enabled: false,
            active_profile_id: profile.id.clone(),
            profiles: vec![profile],
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HidDeviceEntry {
    pub path: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub usage_page: u16,
    pub usage: u16,
    pub manufacturer: String,
    pub product: String,
    pub serial_number: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HidStateEvent {
    pub mask: u16,
    pub pressed_inputs: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListenerStatus {
    pub running: bool,
}

pub fn profile_id() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("profile-{now}")
}

pub fn default_profile(name: String) -> Profile {
    Profile {
        id: profile_id(),
        name,
        mappings: vec![ActionConfig::default(); INPUT_COUNT],
    }
}

pub fn sanitize_config(mut config: StudioConfig) -> StudioConfig {
    if config.profiles.is_empty() {
        let profile = default_profile("Default".to_string());
        config.active_profile_id = profile.id.clone();
        config.profiles.push(profile);
    }

    for (index, profile) in config.profiles.iter_mut().enumerate() {
        if profile.id.trim().is_empty() {
            profile.id = format!("{}-{index}", profile_id());
        }
        if profile.name.trim().is_empty() {
            profile.name = format!("Profile {}", index + 1);
        }

        if profile.mappings.len() < INPUT_COUNT {
            profile
                .mappings
                .extend((0..(INPUT_COUNT - profile.mappings.len())).map(|_| ActionConfig::default()));
        } else if profile.mappings.len() > INPUT_COUNT {
            profile.mappings.truncate(INPUT_COUNT);
        }
    }

    if !config
        .profiles
        .iter()
        .any(|profile| profile.id == config.active_profile_id)
    {
        config.active_profile_id = config.profiles[0].id.clone();
    }

    config
}

pub fn map_input_to_action(config: &StudioConfig, input_id: usize) -> Option<ActionConfig> {
    let profile = config
        .profiles
        .iter()
        .find(|profile| profile.id == config.active_profile_id)?;
    profile.mappings.get(input_id).cloned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_config_fills_profile_fields() {
        let config = StudioConfig {
            selected_device_path: String::new(),
            report_offset: 0,
            auto_detect_report_offset: true,
            autostart_enabled: false,
            profiles: vec![Profile {
                id: String::new(),
                name: String::new(),
                mappings: vec![ActionConfig::default()],
            }],
            active_profile_id: "invalid".to_string(),
        };

        let fixed = sanitize_config(config);
        assert_eq!(fixed.profiles.len(), 1);
        assert!(!fixed.profiles[0].id.is_empty());
        assert_eq!(fixed.profiles[0].name, "Profile 1");
        assert_eq!(fixed.profiles[0].mappings.len(), INPUT_COUNT);
        assert_eq!(fixed.active_profile_id, fixed.profiles[0].id);
    }

    #[test]
    fn map_input_to_action_returns_expected_entry() {
        let mut config = StudioConfig::default();
        config.profiles[0].mappings[3].kind = ActionKind::Command;
        config.profiles[0].mappings[3].command = "notepad.exe".to_string();

        let action = map_input_to_action(&config, 3).expect("missing action");
        assert_eq!(action.kind, ActionKind::Command);
        assert_eq!(action.command, "notepad.exe");
    }
}
