use std::process::Command;

use crate::models::{ActionConfig, ActionKind};

fn send_windows_key_combo(combo: &str) -> Result<(), String> {
    let tokens: Vec<String> = combo
        .split('+')
        .map(|token| token.trim().to_uppercase())
        .filter(|token| !token.is_empty())
        .collect();

    if tokens.is_empty() {
        return Ok(());
    }

    let mut prefix = String::new();
    let mut main_key = String::new();

    for token in tokens {
        match token.as_str() {
            "CTRL" | "CONTROL" => prefix.push('^'),
            "ALT" => prefix.push('%'),
            "SHIFT" => prefix.push('+'),
            "ENTER" => main_key = "{ENTER}".to_string(),
            "TAB" => main_key = "{TAB}".to_string(),
            "ESC" | "ESCAPE" => main_key = "{ESC}".to_string(),
            "SPACE" => main_key = " ".to_string(),
            "BACKSPACE" => main_key = "{BACKSPACE}".to_string(),
            "DELETE" => main_key = "{DELETE}".to_string(),
            "UP" => main_key = "{UP}".to_string(),
            "DOWN" => main_key = "{DOWN}".to_string(),
            "LEFT" => main_key = "{LEFT}".to_string(),
            "RIGHT" => main_key = "{RIGHT}".to_string(),
            "HOME" => main_key = "{HOME}".to_string(),
            "END" => main_key = "{END}".to_string(),
            "PAGEUP" => main_key = "{PGUP}".to_string(),
            "PAGEDOWN" => main_key = "{PGDN}".to_string(),
            "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10" | "F11"
            | "F12" => {
                main_key = format!("{{{token}}}");
            }
            token if token.len() == 1 => {
                let special = "^%+~(){}[]";
                let c = token.chars().next().unwrap_or_default();
                if special.contains(c) {
                    main_key = format!("{{{c}}}");
                } else {
                    main_key = token;
                }
            }
            _ => {}
        }
    }

    if main_key.is_empty() {
        return Ok(());
    }

    let payload = format!("{prefix}{main_key}").replace('\'', "''");
    let script = format!(
        "$wshell = New-Object -ComObject WScript.Shell; $wshell.SendKeys('{}')",
        payload
    );

    Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-WindowStyle",
            "Hidden",
            "-Command",
            &script,
        ])
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Failed to dispatch key combo: {e}"))
}

pub fn execute_action(action: &ActionConfig) -> Result<(), String> {
    match action.kind {
        ActionKind::None => Ok(()),
        ActionKind::KeyCombo => {
            if action.key_combo.trim().is_empty() {
                return Ok(());
            }
            send_windows_key_combo(action.key_combo.trim())
        }
        ActionKind::Command => {
            let program = action.command.trim();
            if program.is_empty() {
                return Ok(());
            }

            let mut command = Command::new(program);
            if !action.args.is_empty() {
                command.args(action.args.iter().map(|arg| arg.trim()).filter(|arg| !arg.is_empty()));
            }
            if !action.working_dir.trim().is_empty() {
                command.current_dir(action.working_dir.trim());
            }

            command
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("Failed to run command '{program}': {e}"))
        }
    }
}
