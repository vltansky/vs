//! The stage look (assets/stage.html): colours, the type scale, and the
//! `{tone:text}` markup the text helpers take.

pub const BG: &str = "#08090a";
pub const INK: &str = "#f1f2ee";
pub const MUTE: &str = "#868a80";
pub const LINE: &str = "#25272a";
pub const CARD: &str = "#0f1011";
pub const CARD_OPACITY: f32 = 0.9;
pub const CARD2: &str = "#17191a";
pub const ACC: &str = "#c6f432";
pub const BAD: &str = "#ff5a5f";
pub const OK: &str = "#4fe3a1";
pub const STROKE: &str = "#3a4250";
pub const DOTS: &str = "#78dcff";
pub const SANS: &str = "Space Grotesk";
pub const MONO: &str = "JetBrains Mono";

/// One meaning per colour for the whole video: acc = the subject or change,
/// bad = the problem or cost, ok = the fix or success. Everything else is ink.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Tone {
    Ink,
    Mute,
    Acc,
    Bad,
    Ok,
    /// Grey connector strokes (path.ln).
    Line,
}
impl Tone {
    pub fn color(self) -> &'static str {
        match self {
            Tone::Ink => INK,
            Tone::Mute => MUTE,
            Tone::Acc => ACC,
            Tone::Bad => BAD,
            Tone::Ok => OK,
            Tone::Line => STROKE,
        }
    }
    /// `.chip.<tone>` background: the tone mixed 14% into card2.
    pub fn chip_fill(self) -> String {
        match self {
            Tone::Acc | Tone::Bad | Tone::Ok => mix(self.color(), CARD2, 0.14),
            _ => CARD2.to_string(),
        }
    }
    pub fn chip_border(self) -> &'static str {
        match self {
            Tone::Acc | Tone::Bad | Tone::Ok => self.color(),
            _ => LINE,
        }
    }
}

fn rgb(hex: &str) -> (f32, f32, f32) {
    let v = u32::from_str_radix(hex.trim_start_matches('#'), 16).unwrap_or(0);
    (((v >> 16) & 255) as f32, ((v >> 8) & 255) as f32, (v & 255) as f32)
}
/// color-mix(in srgb, a k, b).
pub fn mix(a: &str, b: &str, k: f32) -> String {
    let (a, b) = (rgb(a), rgb(b));
    let m = |x: f32, y: f32| (x * k + y * (1.0 - k)).round() as u8;
    format!("#{:02x}{:02x}{:02x}", m(a.0, b.0), m(a.1, b.1), m(a.2, b.2))
}

/// A text style from the type scale. Nothing on screen below 20 px.
#[derive(Clone, Copy, Debug)]
pub struct Type {
    pub font: &'static str,
    pub size: f32,
    pub weight: u16,
    /// letter-spacing in em.
    pub ls: f32,
    /// line-height as a multiple of size.
    pub lh: f32,
    pub upper: bool,
    pub tone: Tone,
}
impl Type {
    pub const H1: Type = Type { font: SANS, size: 120.0, weight: 700, ls: -0.03, lh: 1.02, upper: false, tone: Tone::Ink };
    pub const H2: Type = Type { font: SANS, size: 72.0, weight: 700, ls: -0.02, lh: 1.05, upper: false, tone: Tone::Ink };
    pub const H3: Type = Type { font: SANS, size: 40.0, weight: 600, ls: 0.0, lh: 1.15, upper: false, tone: Tone::Ink };
    pub const BODY: Type = Type { font: SANS, size: 30.0, weight: 400, ls: 0.0, lh: 1.4, upper: false, tone: Tone::Ink };
    pub const ROW: Type = Type { font: SANS, size: 27.0, weight: 600, ls: 0.0, lh: 1.2, upper: false, tone: Tone::Ink };
    /// .lbl: 600 20px mono, 0.14em tracking, uppercase, muted. Write it in capitals.
    pub const LBL: Type = Type { font: MONO, size: 20.0, weight: 600, ls: 0.14, lh: 1.32, upper: true, tone: Tone::Mute };
    pub const MONO: Type = Type { font: MONO, size: 30.0, weight: 500, ls: 0.0, lh: 1.5, upper: false, tone: Tone::Ink };
    pub const CHIP: Type = Type { font: MONO, size: 21.0, weight: 500, ls: 0.0, lh: 1.32, upper: false, tone: Tone::Ink };

    pub fn size(self, size: f32) -> Type {
        Type { size, ..self }
    }
    pub fn tone(self, tone: Tone) -> Type {
        Type { tone, ..self }
    }
    /// The same size and weight in the mono face (`.mono`).
    pub fn mono(self) -> Type {
        Type { font: MONO, ..self }
    }
    pub fn weight(self, weight: u16) -> Type {
        Type { weight, ..self }
    }
    fn metrics(self) -> (f32, f32) {
        // hhea ascent/descent of the bundled fonts, per em.
        if self.font == MONO { (1.02, 0.30) } else { (0.984, 0.292) }
    }
    /// Baseline of a line whose CSS line box starts at `top`.
    pub fn baseline(self, top: f32) -> f32 {
        let (asc, desc) = self.metrics();
        top + (self.lh * self.size - (asc + desc) * self.size) / 2.0 + asc * self.size
    }
    /// Height of one line box.
    pub fn line_h(self) -> f32 {
        self.lh * self.size
    }
    pub fn ls_px(self) -> f32 {
        self.ls * self.size
    }
    /// Top and height of the font's content box around a baseline (where a
    /// CSS inline background, such as mark(), is painted).
    pub fn content_box(self, baseline: f32) -> (f32, f32) {
        let (asc, desc) = self.metrics();
        (baseline - asc * self.size, (asc + desc) * self.size)
    }
}

/// One word of marked-up text.
#[derive(Clone, Copy, Debug)]
pub struct Word<'a> {
    pub text: &'a str,
    pub tone: Option<Tone>,
    /// Inside `{mark:...}`: accent text over a highlighter sweep.
    pub mark: bool,
    /// Joined to the word before with no space: `nile{bad:&t=}` is one word in two tones.
    pub glue: bool,
}

/// Split `{acc:queue} the {bad:lost} job` into words. Tones: acc, bad, ok,
/// mute, ink, mark (accent plus the highlighter sweep). Braces do not nest.
pub fn words(markup: &str) -> Vec<Word<'_>> {
    let mut out: Vec<Word<'_>> = Vec::new();
    // Whether the text just before the next run ended in whitespace.
    let mut after_space = true;
    let mut rest = markup;
    fn push<'m>(out: &mut Vec<Word<'m>>, text: &'m str, tone: Option<Tone>, mark: bool, after_space: &mut bool) {
        let lead = text.starts_with(char::is_whitespace);
        for (i, w) in text.split_whitespace().enumerate() {
            let glue = i == 0 && !lead && !*after_space && !out.is_empty();
            out.push(Word { text: w, tone, mark, glue });
        }
        if !text.is_empty() {
            *after_space = text.ends_with(char::is_whitespace);
        }
    }
    while !rest.is_empty() {
        match rest.find('{') {
            Some(open) => {
                push(&mut out, &rest[..open], None, false, &mut after_space);
                let after = &rest[open + 1..];
                let close = after.find('}').unwrap_or(after.len());
                let inner = &after[..close];
                let (tag, body) = inner.split_once(':').unwrap_or(("", inner));
                let (tone, mark) = match tag.trim() {
                    "acc" => (Some(Tone::Acc), false),
                    "bad" => (Some(Tone::Bad), false),
                    "ok" => (Some(Tone::Ok), false),
                    "mute" => (Some(Tone::Mute), false),
                    "ink" => (Some(Tone::Ink), false),
                    "mark" => (Some(Tone::Acc), true),
                    _ => (None, false),
                };
                push(&mut out, body, tone, mark, &mut after_space);
                rest = if close < after.len() { &after[close + 1..] } else { "" };
            }
            None => {
                push(&mut out, rest, None, false, &mut after_space);
                rest = "";
            }
        }
    }
    out
}

/// The markup with the braces taken out: what the viewer reads.
pub fn plain(markup: &str) -> String {
    let mut out = String::new();
    for w in words(markup) {
        if !out.is_empty() && !w.glue {
            out.push(' ');
        }
        out.push_str(w.text);
    }
    out
}
