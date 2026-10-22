//! timeline.js, as `fframes.mjs` writes it to ff/timeline.json: scene starts and
//! lengths, beat starts, word caption pages, subtitle lines. Read at startup, so a
//! new narration needs no recompile. Leaked once to 'static: it lives as long as
//! the render anyway.
use serde_json::Value;
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug)]
pub struct SceneTl {
    pub id: &'static str,
    pub title: &'static str,
    pub start: f32,
    pub dur: f32,
    pub beats: &'static [f32],
}

#[derive(Debug)]
pub struct CapPage {
    pub from: f32,
    pub to: f32,
    pub words: &'static [(f32, f32, &'static str)],
}

/// A clip slot's recording, prepared by `fframes.mjs` at the rate finish.mjs
/// would play it: `file` is the pre-slowed copy, `played` its length.
#[derive(Debug, Clone)]
pub struct ClipPrep {
    pub file: &'static str,
    pub played: f32,
}

#[derive(Debug)]
pub struct Timeline {
    pub title: &'static str,
    pub brand: &'static str,
    pub fps: usize,
    pub total: f32,
    pub scenes: &'static [SceneTl],
    pub caps: &'static [CapPage],
    pub subs: &'static [(f32, f32, &'static str)],
    /// pill (default), colour, pop, or line.
    pub caption_style: &'static str,
    pub clips: HashMap<String, ClipPrep>,
}

fn leak(s: &str) -> &'static str {
    Box::leak(s.to_string().into_boxed_str())
}
fn f(v: &Value) -> f32 {
    v.as_f64().unwrap_or(0.0) as f32
}
fn s(v: &Value) -> &'static str {
    leak(v.as_str().unwrap_or(""))
}

pub fn parse(json: &Value, clips: Option<&Value>) -> Result<Timeline, String> {
    let scenes: Vec<SceneTl> = json["scenes"]
        .as_array()
        .ok_or("timeline.json has no scenes")?
        .iter()
        .map(|sc| SceneTl {
            id: s(&sc["id"]),
            title: if sc["title"].is_string() { s(&sc["title"]) } else { s(&sc["id"]) },
            start: f(&sc["start"]),
            dur: f(&sc["dur"]),
            beats: Box::leak(
                sc["beats"].as_array().map(|b| b.iter().map(|x| if x.is_object() { f(&x["t"]) } else { f(x) }).collect::<Vec<_>>()).unwrap_or_default().into_boxed_slice(),
            ),
        })
        .collect();
    let caps: Vec<CapPage> = json["caps"]
        .as_array()
        .map(|pages| {
            pages
                .iter()
                .map(|pg| CapPage {
                    from: f(&pg["from"]),
                    to: f(&pg["to"]),
                    words: Box::leak(
                        pg["words"].as_array().map(|w| w.iter().map(|x| (f(&x[0]), f(&x[1]), s(&x[2]))).collect::<Vec<_>>()).unwrap_or_default().into_boxed_slice(),
                    ),
                })
                .collect()
        })
        .unwrap_or_default();
    let subs: Vec<(f32, f32, &'static str)> =
        json["subs"].as_array().map(|l| l.iter().map(|x| (f(&x[0]), f(&x[1]), s(&x[2]))).collect()).unwrap_or_default();
    let mut map = HashMap::new();
    if let Some(Value::Object(o)) = clips {
        for (k, v) in o {
            map.insert(k.clone(), ClipPrep { file: s(&v["file"]), played: f(&v["played"]) });
        }
    }
    let style = json["captions"]["style"].as_str().unwrap_or("pill");
    Ok(Timeline {
        title: s(&json["title"]),
        brand: s(&json["brand"]),
        fps: json["fps"].as_u64().unwrap_or(30) as usize,
        total: f(&json["total"]),
        scenes: Box::leak(scenes.into_boxed_slice()),
        caps: Box::leak(caps.into_boxed_slice()),
        subs: Box::leak(subs.into_boxed_slice()),
        caption_style: if json["caps"].is_array() { leak(style) } else { "line" },
        clips: map,
    })
}

pub fn load(dir: &Path) -> Result<Timeline, String> {
    let read = |name: &str| -> Result<Option<Value>, String> {
        let p = dir.join(name);
        if !p.exists() {
            return Ok(None);
        }
        let text = std::fs::read_to_string(&p).map_err(|e| format!("{}: {e}", p.display()))?;
        serde_json::from_str(&text).map(Some).map_err(|e| format!("{}: {e}", p.display()))
    };
    let tl = read("timeline.json")?.ok_or_else(|| format!("{} has no timeline.json: run node fframes.mjs prep <work>", dir.display()))?;
    let clips = read("clips.json")?;
    parse(&tl, clips.as_ref())
}
