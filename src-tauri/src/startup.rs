use std::{sync::atomic::{AtomicBool, Ordering}, time::Instant};
use tauri::State;

// Explicit test-profile instrumentation; no files, accounts or paths are logged.
pub struct Trace {
    started: Instant,
    enabled: bool,
    reported: AtomicBool,
}
impl Trace {
    pub fn new() -> Self {
        Self {
            started: Instant::now(),
            enabled: std::env::var("CHEST_STARTUP_TRACE").as_deref()==Ok("1")
                && std::env::var_os("CHEST_TEST_PROFILE").is_some(),
            reported: AtomicBool::new(false),
        }
    }
    pub fn enabled(&self) -> bool { self.enabled }
    pub fn mark(&self, stage: &str) {
        if self.enabled {
            eprintln!("CHEST_STARTUP {}", serde_json::json!({"stage":stage,"elapsed_ms":self.started.elapsed().as_secs_f64()*1000.}));
        }
    }
}
#[tauri::command]
pub fn report_startup_ready(trace: State<'_, Trace>, core: crate::App<'_>) {
    if core.store.is_test_profile() && !trace.reported.swap(true, Ordering::Relaxed) {
        trace.mark("library-rendered");
    }
}
