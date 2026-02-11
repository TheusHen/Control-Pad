use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;

use crate::models::StudioConfig;

pub struct ListenerWorker {
    pub stop: Arc<AtomicBool>,
    pub handle: JoinHandle<()>,
}

pub struct AppState {
    pub config: Arc<Mutex<StudioConfig>>,
    pub listener: Mutex<Option<ListenerWorker>>,
}

impl AppState {
    pub fn new(config: StudioConfig) -> Self {
        Self {
            config: Arc::new(Mutex::new(config)),
            listener: Mutex::new(None),
        }
    }
}
