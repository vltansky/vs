//! The layout record `fframes.mjs check` reads. With VS_FF_LINT=<file> set, every
//! text, card, media block and clip slot a scene draws is written as one JSON line
//! (layout boxes in stage pixels, before the scene's camera); check turns them into
//! SMALL / OVERLAP / OVERFLOW / SAFE / SUBTITLE / PHONE / DENSE / MEDIA findings.
//! Off (no cost) in a normal render.
use serde_json::{Value, json};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

static ON: AtomicBool = AtomicBool::new(false);
static ITEMS: Mutex<Vec<Value>> = Mutex::new(Vec::new());

pub fn enable() {
    ON.store(true, Ordering::Relaxed);
}
pub fn on() -> bool {
    ON.load(Ordering::Relaxed)
}
pub fn push(v: Value) {
    if on() {
        ITEMS.lock().unwrap().push(v);
    }
}
pub fn write(path: &str) -> std::io::Result<()> {
    let items = ITEMS.lock().unwrap();
    let text: String = items.iter().map(|v| format!("{v}\n")).collect();
    std::fs::write(path, text)
}

#[allow(clippy::too_many_arguments)]
pub fn text(frame: usize, scene: &str, x: f32, y: f32, w: f32, h: f32, size: f32, text: &str, opacity: f32, block: u32) {
    push(json!({ "kind": "text", "frame": frame, "scene": scene, "x": x, "y": y, "w": w, "h": h, "size": size, "text": text, "o": opacity, "block": block }));
}
pub fn rect(kind: &str, frame: usize, scene: &str, x: f32, y: f32, w: f32, h: f32, opacity: f32, block: u32) {
    push(json!({ "kind": kind, "frame": frame, "scene": scene, "x": x, "y": y, "w": w, "h": h, "o": opacity, "block": block }));
}
