//! The motion kit's math (assets/motion.js), as pure functions of time: every
//! frame is drawn from `t` alone, so frames render in any order and in parallel.
//!
//! Springs adapted from take-one's scripts/springs.js (github.com/talsiach/take-one),
//! Tal Siach, MIT; see THIRD_PARTY_NOTICES.md at the repo root.

pub fn clamp(x: f32) -> f32 {
    x.clamp(0.0, 1.0)
}
pub fn lerp(a: f32, b: f32, k: f32) -> f32 {
    a + (b - a) * k
}

/// Easing curves. Nothing that moves eases linearly; `linear` is for stepped progress.
#[derive(Clone, Copy, Debug)]
pub enum Ease {
    Linear,
    Out,
    InOut,
    Back,
}
impl Ease {
    pub fn at(self, x: f32) -> f32 {
        match self {
            Ease::Linear => x,
            Ease::Out => 1.0 - (1.0 - x).powi(3),
            Ease::InOut => {
                if x < 0.5 {
                    4.0 * x * x * x
                } else {
                    1.0 - (-2.0 * x + 2.0).powi(3) / 2.0
                }
            }
            Ease::Back => 1.0 + 2.5 * (x - 1.0).powi(3) + 1.5 * (x - 1.0).powi(2),
        }
    }
}

/// Eased progress 0..1 of a motion that starts at `s` and lasts `d` seconds.
pub fn p(t: f32, s: f32, d: f32, e: Ease) -> f32 {
    e.at(clamp((t - s) / d))
}

/// Spring presets: snappy (chips, ~0.25 s), camera (cards, ~0.5 s), heavy
/// (titles, ~0.75 s), playful (a pop with ~20% overshoot), or your own k/c.
#[derive(Clone, Copy, Debug)]
pub enum Spring {
    Snappy,
    Camera,
    Heavy,
    Playful,
    Custom { k: f32, c: f32 },
}
impl Spring {
    fn kc(self) -> (f32, f32) {
        match self {
            Spring::Snappy => (320.0, 30.0),
            Spring::Camera => (170.0, 26.0),
            Spring::Heavy => (120.0, 24.0),
            Spring::Playful => (180.0, 12.0),
            Spring::Custom { k, c } => (k, c),
        }
    }
}

/// 0 -> 1 step response of a spring released at `s` (0 before `s`). Closed form.
pub fn spring(t: f32, s: f32, preset: Spring) -> f32 {
    let (k, c) = preset.kc();
    let x = t - s;
    if x <= 0.0 {
        return 0.0;
    }
    let w = k.sqrt();
    let z = c / (2.0 * w);
    if z < 1.0 {
        let wd = w * (1.0 - z * z).sqrt();
        1.0 - (-z * w * x).exp() * ((wd * x).cos() + (z * w / wd) * (wd * x).sin())
    } else if z == 1.0 {
        1.0 - (-w * x).exp() * (1.0 + w * x)
    } else {
        let r = w * (z * z - 1.0).sqrt();
        let (r1, r2) = (-z * w + r, -z * w - r);
        1.0 - (r2 * (r1 * x).exp() - r1 * (r2 * x).exp()) / (r2 - r1)
    }
}

/// A value that springs through keys [(t0, v0), (t1, v1), ...]; a retarget keeps momentum.
pub fn spring_to(t: f32, keys: &[(f32, f32)], preset: Spring) -> f32 {
    let mut v = keys[0].1;
    for i in 1..keys.len() {
        v += (keys[i].1 - keys[i - 1].1) * spring(t, keys[i].0, preset);
    }
    v
}

/// Seconds a viewer needs to read on-screen text: 0.4 s + 0.2 s a word.
pub fn read_time(text: &str) -> f32 {
    0.4 + 0.2 * text.split_whitespace().count() as f32
}

/// Index of the beat playing at t (-1 before the first beat).
pub fn beat_at(t: f32, b: &[f32]) -> i32 {
    b.iter().enumerate().fold(-1, |found, (i, s)| if t >= *s { i as i32 } else { found })
}

/// Opacity, offset and scale of one block. Scale is about the block centre, as CSS does.
#[derive(Clone, Copy, Debug)]
pub struct Tf {
    pub o: f32,
    pub x: f32,
    pub y: f32,
    pub s: f32,
}
impl Tf {
    pub const ID: Tf = Tf { o: 1.0, x: 0.0, y: 0.0, s: 1.0 };
    pub const HIDDEN: Tf = Tf { o: 0.0, x: 0.0, y: 0.0, s: 1.0 };
    pub fn css(&self, cx: f32, cy: f32) -> String {
        format!(
            "translate({:.3} {:.3}) translate({:.3} {:.3}) scale({:.5}) translate({:.3} {:.3})",
            self.x, self.y, cx, cy, self.s, -cx, -cy
        )
    }
    /// Fade to `to` opacity from `s`: keep old state visible but quiet.
    pub fn dim(self, t: f32, s: f32) -> Tf {
        self.dim_to(t, s, 0.35, 0.4)
    }
    pub fn dim_to(self, t: f32, s: f32, to: f32, d: f32) -> Tf {
        Tf { o: self.o * lerp(1.0, to, p(t, s, d, Ease::Out)), ..self }
    }
    /// Fade out from `s`.
    pub fn hide(self, t: f32, s: f32) -> Tf {
        Tf { o: self.o * (1.0 - p(t, s, 0.35, Ease::InOut)), ..self }
    }
    pub fn opacity(self, o: f32) -> Tf {
        Tf { o: self.o * o, ..self }
    }
}

/// Options for `rise`: slide dy/dx pixels into place; `d` picks the preset
/// (0.75 s or more: heavy; 0.45 s or less: snappy; else camera).
#[derive(Clone, Copy, Debug)]
pub struct Rise {
    pub d: f32,
    pub dy: f32,
    pub dx: f32,
    pub from: f32,
    pub spring: Option<Spring>,
}
impl Default for Rise {
    fn default() -> Self {
        Rise { d: 0.6, dy: 26.0, dx: 0.0, from: 1.0, spring: None }
    }
}

/// Fade in while sliding into place, on a spring.
pub fn rise(t: f32, s: f32) -> Tf {
    rise_with(t, s, Rise::default())
}
pub fn rise_with(t: f32, s: f32, o: Rise) -> Tf {
    let preset = o.spring.unwrap_or(if o.d >= 0.75 {
        Spring::Heavy
    } else if o.d <= 0.45 {
        Spring::Snappy
    } else {
        Spring::Camera
    });
    let k = spring(t, s, preset);
    Tf { o: clamp(k * 1.4), x: o.dx * (1.0 - k), y: o.dy * (1.0 - k), s: o.from + (1.0 - o.from) * k }
}

/// Scale in with an overshoot: chips, badges, a new state.
pub fn pop(t: f32, s: f32) -> Tf {
    pop_with(t, s, Spring::Playful)
}
pub fn pop_with(t: f32, s: f32, preset: Spring) -> Tf {
    let k = spring(t, s, preset);
    Tf { o: Ease::Out.at(clamp((t - s) / 0.25)), x: 0.0, y: 0.0, s: 0.6 + 0.4 * k }
}

/// Accent glow on a block: persistent (`focus`) or fading after a change (`flash`).
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Glow {
    None,
    /// Accent border and glow at this strength 0..1.
    Acc(f32),
}
/// "This just changed": an accent border and glow that fade out over 1.2 s from `s`.
pub fn flash(t: f32, s: f32) -> Glow {
    if t > s && t < s + 1.2 {
        Glow::Acc(1.0 - p(t, s, 1.2, Ease::InOut))
    } else {
        Glow::None
    }
}
/// Persistent highlight while beat i plays.
pub fn focus(t: f32, b: &[f32], i: usize) -> Glow {
    let on = t >= b[i] && b.get(i + 1).is_none_or(|next| t < *next);
    if on { Glow::Acc(1.0) } else { Glow::None }
}
impl Glow {
    pub fn or(self, other: Glow) -> Glow {
        match (self, other) {
            (Glow::Acc(a), Glow::Acc(b)) => Glow::Acc(a.max(b)),
            (Glow::Acc(a), _) | (_, Glow::Acc(a)) => Glow::Acc(a),
            _ => Glow::None,
        }
    }
}

/// A number that counts from `from` to `to` over `d` seconds from `s`, with thousands commas.
pub fn count(t: f32, s: f32, from: f32, to: f32, d: f32) -> String {
    let v = lerp(from, to, p(t, s, d, Ease::InOut)).round() as i64;
    let digits = v.abs().to_string();
    let mut out = String::new();
    for (i, ch) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(ch);
    }
    if v < 0 { format!("-{out}") } else { out }
}
