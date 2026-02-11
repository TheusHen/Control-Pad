use std::ffi::CString;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use hidapi::HidApi;
use tauri::{AppHandle, Emitter};

use crate::actions::execute_action;
use crate::models::{map_input_to_action, HidDeviceEntry, HidStateEvent, INPUT_COUNT};
use crate::state::{AppState, ListenerWorker};

fn bitmask_from_report(report: &[u8], offset: usize) -> Option<u16> {
    if report.len() < offset + 2 {
        return None;
    }

    let low = report[offset] as u16;
    let high = report[offset + 1] as u16;
    Some((high << 8) | low)
}

fn decode_input_mask(report: &[u8], preferred_offset: usize, auto_detect: bool, last_mask: u16) -> u16 {
    let valid_bits = (1u16 << INPUT_COUNT) - 1;
    let mut candidates: Vec<u16> = Vec::new();

    if let Some(mask) = bitmask_from_report(report, preferred_offset) {
        candidates.push(mask & valid_bits);
    }

    if auto_detect {
        let max_offset = report.len().saturating_sub(2).min(8);
        for offset in 0..=max_offset {
            if offset == preferred_offset {
                continue;
            }
            if let Some(mask) = bitmask_from_report(report, offset) {
                candidates.push(mask & valid_bits);
            }
        }
    }

    if candidates.is_empty() {
        return 0;
    }

    if !auto_detect {
        return candidates[0];
    }

    candidates
        .into_iter()
        .min_by_key(|candidate| (candidate ^ last_mask).count_ones())
        .unwrap_or(0)
}

fn run_listener_loop(
    app: AppHandle,
    config_state: Arc<std::sync::Mutex<crate::models::StudioConfig>>,
    stop_flag: Arc<std::sync::atomic::AtomicBool>,
    device_path: String,
) {
    let api = match HidApi::new() {
        Ok(api) => api,
        Err(e) => {
            let _ = app.emit("hid-error", format!("Failed to initialize HID API: {e}"));
            return;
        }
    };

    let c_path = match CString::new(device_path.clone()) {
        Ok(path) => path,
        Err(e) => {
            let _ = app.emit("hid-error", format!("Invalid HID path: {e}"));
            return;
        }
    };

    let device = match api.open_path(c_path.as_c_str()) {
        Ok(device) => device,
        Err(e) => {
            let _ = app.emit(
                "hid-error",
                format!("Failed to open HID device at '{device_path}': {e}"),
            );
            return;
        }
    };

    let mut report = [0u8; 64];
    let mut last_mask: u16 = 0;

    while !stop_flag.load(Ordering::Relaxed) {
        match device.read_timeout(&mut report, 100) {
            Ok(size) if size > 0 => {
                let config = {
                    let lock = config_state.lock();
                    match lock {
                        Ok(config) => config.clone(),
                        Err(_) => {
                            let _ = app.emit("hid-error", "Config lock was poisoned");
                            break;
                        }
                    }
                };

                let next_mask = decode_input_mask(
                    &report[..size],
                    config.report_offset,
                    config.auto_detect_report_offset,
                    last_mask,
                );
                let pressed_mask = (!last_mask) & next_mask;

                if pressed_mask != 0 {
                    for input_id in 0..INPUT_COUNT {
                        if ((pressed_mask >> input_id) & 1) == 0 {
                            continue;
                        }

                        if let Some(action) = map_input_to_action(&config, input_id) {
                            let _ = execute_action(&action);
                        }
                    }
                }

                let pressed_inputs: Vec<u8> = (0..INPUT_COUNT)
                    .filter_map(|input_id| {
                        if ((next_mask >> input_id) & 1) == 1 {
                            Some(input_id as u8)
                        } else {
                            None
                        }
                    })
                    .collect();

                let _ = app.emit(
                    "hid-state",
                    HidStateEvent {
                        mask: next_mask,
                        pressed_inputs,
                    },
                );

                last_mask = next_mask;
            }
            Ok(_) => {}
            Err(e) => {
                let _ = app.emit("hid-error", format!("HID read failed: {e}"));
                thread::sleep(Duration::from_millis(400));
            }
        }
    }
}

pub fn list_hid_devices() -> Result<Vec<HidDeviceEntry>, String> {
    let api = HidApi::new().map_err(|e| format!("Failed to initialize HID API: {e}"))?;
    let mut list: Vec<HidDeviceEntry> = api
        .device_list()
        .map(|info| HidDeviceEntry {
            path: info.path().to_string_lossy().to_string(),
            vendor_id: info.vendor_id(),
            product_id: info.product_id(),
            usage_page: info.usage_page(),
            usage: info.usage(),
            manufacturer: info
                .manufacturer_string()
                .map(str::to_string)
                .unwrap_or_default(),
            product: info.product_string().map(str::to_string).unwrap_or_default(),
            serial_number: info
                .serial_number()
                .map(str::to_string)
                .unwrap_or_default(),
        })
        .collect();

    list.sort_by(|a, b| {
        a.vendor_id
            .cmp(&b.vendor_id)
            .then(a.product_id.cmp(&b.product_id))
            .then(a.product.cmp(&b.product))
    });
    Ok(list)
}

pub fn stop_listener_internal(state: &AppState) {
    let mut lock = match state.listener.lock() {
        Ok(lock) => lock,
        Err(_) => return,
    };

    if let Some(worker) = lock.take() {
        worker.stop.store(true, Ordering::Relaxed);
        let _ = worker.handle.join();
    }
}

pub fn start_listener_internal(app: &AppHandle, state: &AppState) -> Result<(), String> {
    stop_listener_internal(state);

    let config = state
        .config
        .lock()
        .map_err(|_| "Config lock was poisoned".to_string())?
        .clone();
    let path = config.selected_device_path.trim().to_string();
    if path.is_empty() {
        return Err("No HID device selected".to_string());
    }

    let stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let worker = ListenerWorker {
        stop: stop.clone(),
        handle: thread::spawn({
            let app_handle = app.clone();
            let config_state = state.config.clone();
            move || run_listener_loop(app_handle, config_state, stop, path)
        }),
    };

    let mut listener_lock = state
        .listener
        .lock()
        .map_err(|_| "Listener lock was poisoned".to_string())?;
    *listener_lock = Some(worker);
    Ok(())
}

pub fn listener_running(state: &AppState) -> bool {
    state
        .listener
        .lock()
        .ok()
        .and_then(|guard| guard.as_ref().map(|_| true))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_input_mask_reads_preferred_offset() {
        // mask 0b0000_0000_0001_0101 => inputs 0,2,4 pressed
        let report = [0xAA, 0x15, 0x00, 0xAA];
        let mask = decode_input_mask(&report, 1, false, 0);
        assert_eq!(mask, 0x0015);
    }

    #[test]
    fn decode_input_mask_auto_detect_chooses_closest_candidate() {
        let report = [0x00, 0x00, 0x03, 0x00, 0x00];
        let last_mask = 0x0003;
        let mask = decode_input_mask(&report, 0, true, last_mask);
        assert_eq!(mask, 0x0003);
    }
}
