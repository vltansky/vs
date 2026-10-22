//! vs explain-video on fframes: the stage and motion kit of assets/motion.js,
//! stage.html and captions.js, ported to Rust. A video crate (fframes/video,
//! copied by `fframes.mjs init`) writes only its scenes:
//!
//! ```ignore
//! fn scene<'a>(s: &mut S<'_, 'a, '_>) -> Svgr<'a> {
//!     match s.id {
//!         "intro" => { let h = s.words(160.0, 300.0, Type::H1, &["Search {mark:misses}"], 0.2); svgr!(<g>{h}</g>) }
//!         _ => Svgr::empty(),
//!     }
//! }
//! fn main() -> std::process::ExitCode { vs_fframes_kit::run(env!("CARGO_MANIFEST_DIR"), scene) }
//! ```
//!
//! Every frame is a pure function of time. Timing (scene starts, beats `s.b`,
//! caption pages) is read from timeline.json at startup, the stage draws the dot
//! field, scene handoffs, camera push, chapter, progress line and captions; the
//! narration is muxed by fframes.mjs afterwards, levelled as narrate.mjs left it.
pub mod lint;
pub mod motion;
pub mod style;
pub mod timeline;

pub use fframes::{self, Svgr, svgr};
pub use motion::*;
pub use style::*;
pub use timeline::Timeline;

use fframes::{AudioMap, Color, Duration, FFramesContext, FFramesSyncedVideoFrame, FontQuery, Frame, SyncVideoFrameInput, Video};
use std::sync::OnceLock;
use fframes::cli::clap;

pub const W: f32 = 1920.0;
pub const H: f32 = 1080.0;

static TL: OnceLock<Timeline> = OnceLock::new();
/// The loaded timeline (after `run` starts).
pub fn tl() -> &'static Timeline {
    TL.get().expect("timeline not loaded: call vs_fframes_kit::run")
}

/// A scene body: match on `s.id`, return the scene's SVG.
pub type SceneFn = for<'s, 'f, 'a, 'm> fn(&'s mut S<'f, 'a, 'm>) -> Svgr<'a>;

/// One line of a typed terminal (motion.js type()).
#[derive(Clone, Copy, Debug)]
pub struct Line<'a> {
    pub text: &'a str,
    pub tone: Tone,
    /// Pin this line's start (seconds into the scene).
    pub at: Option<f32>,
    /// Print the whole line at once (command output).
    pub instant: bool,
}
impl<'a> Line<'a> {
    pub fn cmd(text: &'a str) -> Self {
        Line { text, tone: Tone::Ink, at: None, instant: false }
    }
    pub fn out(text: &'a str, tone: Tone) -> Self {
        Line { text, tone, at: None, instant: true }
    }
    pub fn at(self, at: f32) -> Self {
        Line { at: Some(at), ..self }
    }
    pub fn tone(self, tone: Tone) -> Self {
        Line { tone, ..self }
    }
}

/// Smooth horizontal connector between two points (motion.js curve()).
#[derive(Clone, Copy, Debug)]
pub struct Curve {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
}
impl Curve {
    pub fn new(x1: f32, y1: f32, x2: f32, y2: f32) -> Self {
        Curve { x1, y1, x2, y2 }
    }
    fn at(&self, u: f32) -> (f32, f32) {
        let mx = (self.x1 + self.x2) / 2.0;
        let (p0, p1, p2, p3) = ((self.x1, self.y1), (mx, self.y1), (mx, self.y2), (self.x2, self.y2));
        let v = 1.0 - u;
        let b = |a: f32, b: f32, c: f32, d: f32| v * v * v * a + 3.0 * v * v * u * b + 3.0 * v * u * u * c + u * u * u * d;
        (b(p0.0, p1.0, p2.0, p3.0), b(p0.1, p1.1, p2.1, p3.1))
    }
    /// Points from the start to fraction k of the length.
    pub fn points(&self, k: f32) -> Vec<(f32, f32)> {
        const N: usize = 64;
        let pts: Vec<(f32, f32)> = (0..=N).map(|i| self.at(i as f32 / N as f32)).collect();
        let mut acc = vec![0.0f32];
        for i in 1..pts.len() {
            let (a, b) = (pts[i - 1], pts[i]);
            acc.push(acc[i - 1] + ((b.0 - a.0).powi(2) + (b.1 - a.1).powi(2)).sqrt());
        }
        let goal = acc[N] * clamp(k);
        let mut out = vec![pts[0]];
        for i in 1..pts.len() {
            if acc[i] <= goal {
                out.push(pts[i]);
            } else {
                let f = (goal - acc[i - 1]) / (acc[i] - acc[i - 1]).max(1e-6);
                out.push((lerp(pts[i - 1].0, pts[i].0, f), lerp(pts[i - 1].1, pts[i].1, f)));
                break;
            }
        }
        out
    }
    pub fn point_at(&self, k: f32) -> (f32, f32) {
        *self.points(k).last().unwrap()
    }
}

/// Clip window, seconds into the scene; a negative `to` counts back from the end.
#[derive(Clone, Copy, Debug)]
pub struct Window {
    pub from: f32,
    pub to: f32,
}
impl Default for Window {
    fn default() -> Self {
        Window { from: 0.7, to: -0.45 }
    }
}

/// The scene being drawn: its time `t` (seconds since it started), beat starts
/// `b`, length `d`, and the drawing helpers. Every helper returns SVG; compose
/// them in `svgr!(<g>{a}{b}</g>)`.
pub struct S<'f, 'a, 'm> {
    pub frame: &'f mut Frame,
    pub ctx: &'f FFramesContext<'a, 'm>,
    pub id: &'static str,
    pub i: usize,
    pub t: f32,
    pub b: &'static [f32],
    pub d: f32,
    /// Scene start on the video timeline.
    pub start: f32,
    overlays: Vec<Svgr<'a>>,
    fixed: bool,
    o: f32,
    block: u32,
    next_block: u32,
    uid: u32,
    overlap_next: bool,
}

fn fq(ty: Type) -> FontQuery<'static> {
    FontQuery { family: ty.font, size: ty.size.round() as usize, weight: ty.weight, ..Default::default() }
}

impl<'f, 'a, 'm> S<'f, 'a, 'm> {
    // ---------- time
    pub fn rise(&self, at: f32) -> Tf {
        rise(self.t, at)
    }
    pub fn rise_with(&self, at: f32, o: Rise) -> Tf {
        rise_with(self.t, at, o)
    }
    pub fn pop(&self, at: f32) -> Tf {
        pop(self.t, at)
    }
    pub fn flash(&self, at: f32) -> Glow {
        flash(self.t, at)
    }
    pub fn focus(&self, beat: usize) -> Glow {
        focus(self.t, self.b, beat)
    }
    /// Eased (out) progress 0..1 of a d-second motion from `at`.
    pub fn p(&self, at: f32, d: f32) -> f32 {
        p(self.t, at, d, Ease::Out)
    }
    pub fn p_io(&self, at: f32, d: f32) -> f32 {
        p(self.t, at, d, Ease::InOut)
    }
    /// Beat `i`'s start; past the last beat, the scene end (so b(n) never panics).
    pub fn beat(&self, i: usize) -> f32 {
        self.b.get(i).copied().unwrap_or(self.d)
    }
    pub fn count(&self, at: f32, from: f32, to: f32, d: f32) -> &'a str {
        Self::own(count(self.t, at, from, to, d))
    }
    /// A computed string (format!) as text this frame can draw and measure.
    /// It lives for the render: a few bytes a frame.
    pub fn own(text: String) -> &'a str {
        Box::leak(text.into_boxed_str())
    }
    fn id_for(&mut self, what: &str) -> String {
        self.uid += 1;
        format!("{}-{}-{}", self.id, what, self.uid)
    }

    // ---------- text
    /// Width of `text` in this style, letter-spacing included.
    pub fn measure(&mut self, ty: Type, text: &'a str) -> f32 {
        let w = self.frame.text_width(self.ctx, fq(ty), text).unwrap_or((text.chars().count() as f32 * ty.size * 0.55) as usize) as f32;
        w + ty.ls_px() * text.chars().count() as f32
    }
    fn space(&mut self, ty: Type) -> f32 {
        let a = self.frame.text_width(self.ctx, fq(ty), "a a").unwrap_or(0) as f32;
        let b = self.frame.text_width(self.ctx, fq(ty), "aa").unwrap_or(0) as f32;
        (a - b).max(ty.size * 0.2) + ty.ls_px()
    }
    /// Lay out marked-up words on one line: (x of each word, width of each word, total width).
    fn layout(&mut self, ty: Type, ws: &[Word<'a>]) -> (Vec<f32>, Vec<f32>, f32) {
        let gap = self.space(ty);
        let (mut xs, mut wd, mut x) = (Vec::new(), Vec::new(), 0.0);
        for (i, w) in ws.iter().enumerate() {
            if i > 0 && !w.glue {
                x += gap;
            }
            let ww = self.measure(ty, w.text);
            xs.push(x);
            wd.push(ww);
            x += ww;
        }
        (xs, wd, x)
    }
    fn record_text(&mut self, x: f32, top: f32, w: f32, ty: Type, text: &str, o: f32) {
        if lint::on() {
            let base = ty.baseline(top);
            lint::text(self.frame.index, self.id, x, base - 0.8 * ty.size, w, ty.size, ty.size, text, self.o * o, self.block);
        }
    }

    /// One line of marked-up text, its CSS line box starting at (x, top).
    /// Markup: `plain {acc:accent} {bad:cost} {ok:fix} {mute:quiet} {mark:highlit}`.
    pub fn text(&mut self, x: f32, top: f32, ty: Type, markup: &'a str) -> Svgr<'a> {
        self.text_tf(x, top, ty, markup, Tf::ID)
    }
    pub fn text_tf(&mut self, x: f32, top: f32, ty: Type, markup: &'a str, tf: Tf) -> Svgr<'a> {
        // A leading space keeps its gap, as an inline HTML span does (" ms" after a number).
        let x = if markup.starts_with(' ') { x + self.space(ty) } else { x };
        let ws = words(markup);
        let (xs, wd, total) = self.layout(ty, &ws);
        let base = ty.baseline(top);
        let plain_text = plain(markup);
        self.record_text(x, top, total, ty, &plain_text, tf.o);
        // One <text> with a run per word: the renderer spaces the words itself, so the
        // drawn line never disagrees with a measured gap. Measured widths feed lint only.
        let _ = (xs, wd);
        let runs: Vec<Svgr<'a>> = ws
            .iter()
            .enumerate()
            .map(|(i, w)| {
                let fill = w.tone.unwrap_or(ty.tone).color();
                let gap = ws.get(i + 1).is_some_and(|n| !n.glue);
                let body = if ty.upper { w.text.to_uppercase() } else { w.text.to_string() };
                let run = Self::own(if gap { format!("{body} ") } else { body });
                svgr!(<tspan fill={fill}>{run}</tspan>)
            })
            .collect();
        let fill = ty.tone.color();
        svgr!(<g opacity={tf.o} transform={tf.css(x + total / 2.0, top + ty.line_h() / 2.0)}>
            <text x={x} y={base} font-family={ty.font} font-weight={ty.weight} font-size={ty.size} letter-spacing={ty.ls_px()} fill={fill}>{runs}</text>
        </g>)
    }
    /// A computed string (a counter, a formatted value) as one plain run in `ty`.
    pub fn text_string(&mut self, x: f32, top: f32, ty: Type, text: String) -> Svgr<'a> {
        // fframes measures only strings that outlive the frame.
        let text = Self::own(text);
        let w = self.measure(ty, text);
        self.record_text(x, top, w, ty, text, 1.0);
        let (base, fill) = (ty.baseline(top), ty.tone.color());
        svgr!(<text x={x} y={base} font-family={ty.font} font-weight={ty.weight} font-size={ty.size} letter-spacing={ty.ls_px()} fill={fill}>{text}</text>)
    }
    /// A small uppercase mono label (.lbl). Write it in capitals.
    pub fn label(&mut self, x: f32, top: f32, text: &'a str, tf: Tf) -> Svgr<'a> {
        self.text_tf(x, top, Type::LBL, text, tf)
    }

    /// Heading lines whose words rise one by one out of their own mask
    /// (motion.js words(), heavy spring, 0.06 s apart), from scene time `at`.
    /// `{mark:...}` words get the highlighter sweep 0.5 s after the last word lands.
    pub fn words(&mut self, x: f32, top: f32, ty: Type, lines: &[&'a str], at: f32) -> Svgr<'a> {
        let n: usize = lines.iter().map(|l| words(l).len()).sum();
        let mark_at = at + (n.max(1) - 1) as f32 * 0.06 + 0.8;
        self.words_with(x, top, ty, lines, at, Some(mark_at))
    }
    /// Like `words`, with the highlighter sweep at `mark_at` (None: no sweep).
    pub fn words_with(&mut self, x: f32, top: f32, ty: Type, lines: &[&'a str], at: f32, mark_at: Option<f32>) -> Svgr<'a> {
        let mut out: Vec<Svgr<'a>> = Vec::new();
        let mut marks: Vec<Svgr<'a>> = Vec::new();
        let mut idx = 0usize;
        let shown = if self.t >= at { 1.0 } else { 0.0 };
        for (li, line) in lines.iter().enumerate() {
            let ws = words(line);
            let (xs, wd, total) = self.layout(ty, &ws);
            let ltop = top + li as f32 * ty.line_h();
            let base = ty.baseline(ltop);
            self.record_text(x, ltop, total, ty, &plain(line), shown);
            let (ctop, ch) = ty.content_box(base);
            let mut texts: Vec<Svgr<'a>> = Vec::new();
            // A run of consecutive mark words is one highlighter, swept left to right.
            let mut i = 0;
            while i < ws.len() {
                if ws[i].mark {
                    let j = (i..ws.len()).take_while(|k| ws[*k].mark).last().unwrap();
                    let (mx, mw) = (x + xs[i], xs[j] + wd[j] - xs[i]);
                    let k = mark_at.map_or(0.0, |m| self.p_io(m, 0.5));
                    if k > 0.0 {
                        // background-position 0 88%, background-size 40% of the inline box.
                        let hh = ch * 0.4;
                        let hy = ctop + 0.88 * (ch - hh);
                        let fill = mix(ACC, BG, 0.32);
                        marks.push(svgr!(<rect x={mx} y={hy} width={mw * k} height={hh} fill={fill} />));
                    }
                    i = j + 1;
                } else {
                    i += 1;
                }
            }
            for (i, w) in ws.iter().enumerate() {
                let k = spring(self.t, at + idx as f32 * 0.06, Spring::Heavy);
                let dy = (1.0 - k) * 1.1 * ty.size;
                let fill = w.tone.unwrap_or(ty.tone).color();
                let (tx, ty_) = (x + xs[i], base + dy);
                let t = w.text;
                texts.push(svgr!(<text x={tx} y={ty_} font-family={ty.font} font-weight={ty.weight} font-size={ty.size} letter-spacing={ty.ls_px()} fill={fill}>{t}</text>));
                idx += 1;
            }
            // Each line is its own mask: the line box, plus .kw's 0.08em of descender room.
            let id = self.id_for("w");
            let url = format!("url(#{id})");
            let (cx, cy, cw, chh) = (x - 0.1 * ty.size, ltop, total + 0.2 * ty.size, ty.line_h() + 0.08 * ty.size);
            out.push(svgr!(<g>
                <defs><clipPath id={id}><rect x={cx} y={cy} width={cw} height={chh} /></clipPath></defs>
                <g clip-path={url}>{texts}</g>
            </g>));
        }
        svgr!(<g opacity={shown}>{marks}{out}</g>)
    }

    // ---------- blocks
    /// A group of children that move together: `tf` about the box centre.
    pub fn group(&mut self, tf: Tf, x: f32, y: f32, w: f32, h: f32, f: impl FnOnce(&mut Self) -> Vec<Svgr<'a>>) -> Svgr<'a> {
        let (saved_o, saved_b) = (self.o, self.block);
        self.o *= tf.o;
        // A block is a top-level group: what VS.audit calls a block. Nested groups belong to it.
        if self.block == 0 {
            self.next_block += 1;
            self.block = self.next_block;
            if std::mem::take(&mut self.overlap_next) {
                lint::push(serde_json::json!({ "kind": "overlap-ok", "frame": self.frame.index, "block": self.block }));
            }
        }
        let kids = f(self);
        self.o = saved_o;
        self.block = saved_b;
        svgr!(<g opacity={tf.o} transform={tf.css(x + w / 2.0, y + h / 2.0)}>{kids}</g>)
    }

    /// Inside a group or card closure: this block may overlap others (data-overlap-ok).
    /// The block may overlap others on purpose (data-overlap-ok). Inside a group's
    /// closure it marks that block; at the top level, the next block drawn.
    pub fn allow_overlap(&mut self) {
        if self.block == 0 {
            self.overlap_next = true;
        } else {
            lint::push(serde_json::json!({ "kind": "overlap-ok", "frame": self.frame.index, "block": self.block }));
        }
    }

    fn card_frame(&self, x: f32, y: f32, w: f32, h: f32, rx: f32, fill: &'static str, fill_o: f32, glow: Glow) -> Svgr<'a> {
        let g = match glow {
            Glow::Acc(k) => k,
            Glow::None => 0.0,
        };
        let halo = if g > 0.0 {
            svgr!(<rect x={x - 6.0} y={y - 6.0} width={w + 12.0} height={h + 12.0} rx={rx + 6.0} fill="none" stroke={ACC} stroke-width="12" opacity={0.12 * g} />)
        } else {
            Svgr::empty()
        };
        let ring = if g > 0.0 {
            svgr!(<rect x={x - 0.5} y={y - 0.5} width={w + 1.0} height={h + 1.0} rx={rx} fill="none" stroke={ACC} stroke-width="2.5" opacity={g} />)
        } else {
            Svgr::empty()
        };
        svgr!(<g>
            {halo}
            <rect x={x + 6.0} y={y + 22.0} width={w - 12.0} height={h} rx={rx} fill="#000000" opacity="0.28" />
            <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} fill-opacity={fill_o} stroke={LINE} stroke-width="1.5" />
            <rect x={x + rx} y={y + 1.5} width={w - 2.0 * rx} height="1" fill="#ffffff" fill-opacity="0.04" />
            {ring}
        </g>)
    }

    /// A card (.card) with children drawn inside it in absolute stage pixels.
    /// `glow`: s.focus(i), s.flash(at), or Glow::None.
    #[allow(clippy::too_many_arguments)]
    pub fn card(&mut self, x: f32, y: f32, w: f32, h: f32, tf: Tf, glow: Glow, f: impl FnOnce(&mut Self) -> Vec<Svgr<'a>>) -> Svgr<'a> {
        let frame = self.card_frame(x, y, w, h, 20.0, CARD, CARD_OPACITY, glow);
        let (fi, id) = (self.frame.index, self.id);
        self.group(tf, x, y, w, h, move |s| {
            lint::rect("card", fi, id, x, y, w, h, s.o, s.block);
            let mut kids = vec![frame];
            kids.extend(f(s));
            kids
        })
    }

    /// The common card: a label over one h3 line (padding 28 32).
    #[allow(clippy::too_many_arguments)]
    pub fn info_card(&mut self, x: f32, y: f32, w: f32, label: &'a str, markup: &'a str, tf: Tf, glow: Glow) -> Svgr<'a> {
        self.card(x, y, w, 142.0, tf, glow, |s| vec![s.text(x + 32.0, y + 28.0, Type::LBL, label), s.text(x + 32.0, y + 28.0 + 26.4 + 14.0, Type::H3, markup)])
    }

    /// A card header (.head-row): glyph box, a 32 px title, a muted meta on the
    /// right, and the rule under it. Put it first inside `card`. Returns (svg, height).
    pub fn head_row(&mut self, x: f32, y: f32, w: f32, glyph: &'a str, title: &'a str, meta: &'a str) -> (Svgr<'a>, f32) {
        let ty = Type::H3.size(32.0).weight(600);
        let h = 20.0 + ty.line_h().max(38.0) + 20.0;
        let gy = y + (h - 38.0) / 2.0;
        let title_svg = self.text(x + 26.0 + 38.0 + 14.0, y + (h - ty.line_h()) / 2.0, ty, title);
        let mty = Type::CHIP.size(20.0).tone(Tone::Mute);
        let mw = self.measure(mty, meta);
        let meta_svg = self.text(x + w - 26.0 - mw, y + (h - mty.line_h()) / 2.0, mty, meta);
        (svgr!(<g>
            <rect x={x + 26.0} y={gy} width="38" height="38" rx="9" fill="none" stroke={INK} stroke-width="2" />
            <text x={x + 45.0} y={gy + 26.0} text-anchor="middle" font-family={MONO} font-weight="700" font-size="20" fill={INK}>{glyph}</text>
            {title_svg}{meta_svg}
            <rect x={x} y={y + h} width={w} height="1.5" fill={LINE} />
        </g>), h + 1.5)
    }

    /// A pill chip (.chip) sized to its text; acc/bad/ok tint its border and fill.
    pub fn chip(&mut self, x: f32, y: f32, text: &'a str, tone: Tone, tf: Tf) -> Svgr<'a> {
        self.chip_sized(x, y, text, tone, 21.0, tf)
    }
    #[allow(clippy::too_many_arguments)]
    pub fn chip_sized(&mut self, x: f32, y: f32, text: &'a str, tone: Tone, size: f32, tf: Tf) -> Svgr<'a> {
        let ty = Type::CHIP.size(size).tone(if tone == Tone::Line { Tone::Ink } else { tone });
        // Runs of spaces collapse to one, as in HTML.
        let text = if text.contains("  ") { Self::own(text.split_whitespace().collect::<Vec<_>>().join(" ")) } else { text };
        let tw = self.measure(ty, text);
        let (w, h) = (tw + 28.0 + 3.0, ty.line_h() + 14.0 + 3.0);
        let (fill, border) = (tone.chip_fill(), tone.chip_border());
        let base = ty.baseline(y + 8.5);
        let color = ty.tone.color();
        let (fi, id) = (self.frame.index, self.id);
        self.group(tf, x, y, w, h, move |s| {
            lint::text(fi, id, x + 15.5, base - 0.8 * size, tw, size, size, text, s.o, s.block);
            vec![svgr!(<g>
                <rect x={x} y={y} width={w} height={h} rx={h / 2.0} fill={fill} stroke={border} stroke-width="1.5" />
                <text x={x + 15.5} y={base} font-family={MONO} font-weight="500" font-size={size} fill={color}>{text}</text>
            </g>)]
        })
    }

    /// A step row (.row): a numbered glyph box and one line, 27 px 600 by default.
    #[allow(clippy::too_many_arguments)]
    pub fn row(&mut self, x: f32, y: f32, w: f32, glyph: &'a str, markup: &'a str, ty: Type, tf: Tf, glow: Glow) -> Svgr<'a> {
        let h = ty.line_h().max(38.0) + 28.0 + 3.0;
        let frame = self.card_frame(x, y, w, h, 14.0, CARD2, 1.0, glow);
        let (fi, id) = (self.frame.index, self.id);
        self.group(tf, x, y, w, h, move |s| {
            lint::rect("card", fi, id, x, y, w, h, s.o, s.block);
            let mut kids = vec![frame];
            let mut tx = x + 19.5;
            if !glyph.is_empty() {
                let gy = y + (h - 38.0) / 2.0;
                kids.push(svgr!(<g>
                    <rect x={tx} y={gy} width="38" height="38" rx="9" fill="none" stroke={INK} stroke-width="2" />
                    <text x={tx + 19.0} y={gy + 26.0} text-anchor="middle" font-family={MONO} font-weight="700" font-size="20" fill={INK}>{glyph}</text>
                </g>));
                tx += 38.0 + 14.0;
            }
            kids.push(s.text(tx, y + (h - ty.line_h()) / 2.0, ty, markup));
            kids
        })
    }

    /// A screenshot in a card, fitted inside w x h (never cropped), corners rounded like .card.shot.
    pub fn still(&mut self, file: &str, x: f32, y: f32, w: f32, h: f32, tf: Tf) -> Svgr<'a> {
        // media.json names files as media/<name>.png; the kit's media dir is that folder.
        let file = file.strip_prefix("media/").unwrap_or(file);
        let href = self.ctx.get_image(file).map(|i| i.href());
        let clip = self.id_for("still");
        let url = format!("url(#{clip})");
        let shadow = svgr!(<rect x={x + 6.0} y={y + 22.0} width={w - 12.0} height={h} rx="20" fill="#000000" opacity="0.28" />);
        let (fi, id) = (self.frame.index, self.id);
        self.group(tf, x, y, w, h, move |s| {
            lint::rect("media", fi, id, x, y, w, h, s.o, s.block);
            let img = match href {
                Some(h_) => svgr!(<image href={h_} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" />),
                None => {
                    lint::rect("missing-media", fi, id, x, y, w, h, s.o, s.block);
                    Svgr::empty()
                }
            };
            vec![svgr!(<g>
                {shadow}
                <defs><clipPath id={clip}><rect x={x} y={y} width={w} height={h} rx="20" /></clipPath></defs>
                <g clip-path={url}>
                    <rect x={x} y={y} width={w} height={h} fill={CARD} />
                    {img}
                </g>
                <rect x={x} y={y} width={w} height={h} rx="20" fill="none" stroke={LINE} stroke-width="1.5" />
            </g>)]
        })
    }

    /// A screen recording that plays in place (vs-explain-pr). Before the window the
    /// slot shows `<name>.first.png`, after it `<name>.last.png`; inside it the clip
    /// plays at the rate finish.mjs would pick (0.5x to 1x so it fills the window),
    /// then holds its last frame. It draws where you put it in the scene: blocks drawn
    /// after it (a label, a chip) sit on top. The scene's camera holds still while a
    /// clip is in it. Times are on the scene's own clock: the kit puts them on the
    /// video timeline for you.
    pub fn clip(&mut self, file: &'a str, x: f32, y: f32, w: f32, h: f32, tf: Tf) -> Svgr<'a> {
        self.clip_window(file, x, y, w, h, Window::default(), tf)
    }
    #[allow(clippy::too_many_arguments)]
    pub fn clip_window(&mut self, file: &'a str, x: f32, y: f32, w: f32, h: f32, win: Window, tf: Tf) -> Svgr<'a> {
        let file = file.strip_prefix("media/").unwrap_or(file);
        self.fixed = true;
        let end = if win.to < 0.0 { self.d + win.to } else { win.to };
        let stem = file.rsplit_once('.').map_or(file, |(a, _)| a);
        let key = format!("{}|{}", self.id, file);
        let prep = tl().clips.get(&key).cloned();
        if lint::on() {
            lint::push(serde_json::json!({ "kind": "clip", "frame": self.frame.index, "scene": self.id, "file": file, "x": x, "y": y, "w": w, "h": h,
                "from": self.start + win.from, "to": self.start + end, "prepared": prep.is_some(), "o": self.o * tf.o, "block": self.block }));
        }
        let mut href: Option<String> = None;
        if self.t >= win.from && self.t < end {
            if let Some(p) = &prep {
                if self.t < win.from + p.played {
                    // start_from is on the video's own timeline, not the scene's.
                    let input = SyncVideoFrameInput { start_from: self.start + win.from, looping: false, editor_fallback_image: None };
                    href = self.frame.get_synced_video_frame(self.ctx, p.file, &input).map(|v| v.into_image().href().to_string());
                    if href.is_none() && lint::on() {
                        lint::push(serde_json::json!({ "kind": "clip-missing", "frame": self.frame.index, "scene": self.id, "file": p.file }));
                    }
                }
            }
        }
        // Before the window: the first frame. During the hold after it played, or if
        // it never decoded (lint says CLIP-MISSING): the last frame.
        let still_name = if self.t < win.from { format!("{stem}.first.png") } else { format!("{stem}.last.png") };
        let href = href.or_else(|| self.ctx.get_image(&still_name).map(|i| i.href().to_string()));
        let img = match href {
            Some(h_) => svgr!(<image href={h_} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" />),
            None => Svgr::empty(),
        };
        let o = tf.o;
        let tr = tf.css(x + w / 2.0, y + h / 2.0);
        svgr!(<g opacity={o} transform={tr}>
            <rect x={x + 6.0} y={y + 22.0} width={w - 12.0} height={h} fill="#000000" opacity="0.28" />
            <rect x={x} y={y} width={w} height={h} fill={CARD} />
            {img}
            <rect x={x - 0.75} y={y - 0.75} width={w + 1.5} height={h + 1.5} fill="none" stroke={LINE} stroke-width="1.5" />
        </g>)
    }

    /// A terminal card (.term) that types `lines` from scene time `at`, 28 chars/s.
    #[allow(clippy::too_many_arguments)]
    pub fn terminal(&mut self, x: f32, y: f32, w: f32, h: f32, title: &'a str, lines: &[Line<'a>], at: f32, tf: Tf) -> Svgr<'a> {
        let frame = self.card_frame(x, y, w, h, 20.0, CARD, CARD_OPACITY, Glow::None);
        let t = self.t;
        let ty = Type::MONO;
        let cps = 28.0;
        let mut shown: Vec<(&'a str, Tone)> = Vec::new();
        let mut cursor = at;
        let mut typing = false;
        for line in lines {
            let start = line.at.unwrap_or(cursor);
            if t < start {
                break;
            }
            let len = line.text.chars().count();
            let n = if line.instant { len } else { ((t - start) * cps).floor().clamp(0.0, len as f32) as usize };
            let cut = line.text.char_indices().nth(n).map_or(line.text.len(), |(i, _)| i);
            shown.push((&line.text[..cut], line.tone));
            cursor = start + if line.instant { 0.0 } else { len as f32 / cps } + 0.25;
            if n < len {
                typing = true;
                break;
            }
        }
        let blink = (t * 2.2).floor() as i64 % 2 == 0;
        let caret_on = t >= at && (typing || blink);
        let body_top = y + 44.0 + 1.5 + 22.0;
        let mut kids: Vec<Svgr<'a>> = vec![frame];
        let bar_y = y + 22.0;
        let mut dots: Vec<Svgr<'a>> = (0..3).map(|i| svgr!(<circle cx={x + 26.0 + i as f32 * 21.0} cy={bar_y} r="6" fill="#2b313c" />)).collect();
        kids.append(&mut dots);
        let tbase = Type::CHIP.size(20.0).baseline(bar_y - 13.2);
        kids.push(svgr!(<text x={x + 20.0 + 3.0 * 12.0 + 2.0 * 9.0 + 12.0} y={tbase} font-family={MONO} font-weight="500" font-size="20" fill={MUTE}>{title}</text>));
        kids.push(svgr!(<rect x={x} y={y + 44.0} width={w} height="1.5" fill={LINE} />));
        let mut caret_pos = (x + 28.0, body_top);
        let rows = shown.len();
        let mut texts: Vec<(f32, f32, &'a str)> = Vec::new();
        for (i, (txt, tone)) in shown.into_iter().enumerate() {
            let top = body_top + i as f32 * ty.line_h();
            let base = ty.baseline(top);
            let tw = if txt.is_empty() { 0.0 } else { self.measure(ty, txt) };
            if !txt.is_empty() {
                texts.push((top, tw, txt));
                let fill = tone.color();
                kids.push(svgr!(<text x={x + 28.0} y={base} font-family={MONO} font-weight="500" font-size="30" fill={fill}>{txt}</text>));
            }
            caret_pos = if i + 1 == rows && typing { (x + 28.0 + tw + 2.0, top) } else { (x + 28.0, top + ty.line_h()) };
        }
        if t >= at {
            let (cx, ctop) = caret_pos;
            let cy = ty.baseline(ctop) - 30.0 + 5.0;
            kids.push(svgr!(<rect x={cx} y={cy} width="15" height="30" fill={ACC} opacity={if caret_on { 1.0 } else { 0.0 }} />));
        }
        let (fi, id) = (self.frame.index, self.id);
        self.group(tf, x, y, w, h, move |s| {
            lint::rect("card", fi, id, x, y, w, h, s.o, s.block);
            for (top, tw, txt) in texts {
                s.record_text(x + 28.0, top, tw, ty, txt, 1.0);
            }
            kids
        })
    }

    /// A connector drawn on to fraction k (motion.js path() + draw()): grey by
    /// default (Tone::Line) or acc/bad/ok; dashed; with an arrow head at the tip.
    pub fn line(&mut self, c: &Curve, tone: Tone, dash: bool, arrow: bool, k: f32) -> Svgr<'a> {
        if k <= 0.0 {
            return Svgr::empty();
        }
        let pts = c.points(k);
        let mut d = format!("M {:.2} {:.2}", pts[0].0, pts[0].1);
        for p in &pts[1..] {
            d.push_str(&format!(" L {:.2} {:.2}", p.0, p.1));
        }
        let color = tone.color();
        let dashes = if dash { "12 11" } else { "none" };
        let head = if arrow && pts.len() > 1 {
            let (a, b) = (pts[pts.len() - 2], pts[pts.len() - 1]);
            let ang = (b.1 - a.1).atan2(b.0 - a.0);
            let (l, wd) = (18.0f32, 8.0f32);
            let p1 = (b.0 - l * ang.cos() + wd * ang.sin(), b.1 - l * ang.sin() - wd * ang.cos());
            let p2 = (b.0 - l * ang.cos() - wd * ang.sin(), b.1 - l * ang.sin() + wd * ang.cos());
            let hd = format!("M {:.2} {:.2} L {:.2} {:.2} L {:.2} {:.2} Z", b.0 + 2.0 * ang.cos(), b.1 + 2.0 * ang.sin(), p1.0, p1.1, p2.0, p2.1);
            svgr!(<path d={hd} fill={color} />)
        } else {
            Svgr::empty()
        };
        svgr!(<g>
            <path d={d} fill="none" stroke={color} stroke-width="3" stroke-dasharray={dashes} stroke-linecap="butt" />
            {head}
        </g>)
    }
    /// A dot travelling along c at fraction k; hidden before the start and after arrival.
    pub fn dot_along(&self, c: &Curve, k: f32, r: f32, tone: Tone) -> Svgr<'a> {
        if k <= 0.0 || k >= 1.0 {
            return Svgr::empty();
        }
        let (x, y) = c.point_at(k);
        let fill = tone.color();
        svgr!(<circle cx={x} cy={y} r={r} fill={fill} />)
    }
}

// ---------- the stage
pub struct Explainer {
    pub scene: SceneFn,
    /// check.mjs's VS_CALM: no captions, chrome, dot field or camera push, so a
    /// still measures what the scene builds.
    pub calm: bool,
    pub dots: bool,
}
impl std::fmt::Debug for Explainer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Explainer")
    }
}

impl Video for Explainer {
    const FPS: usize = 30;
    const WIDTH: usize = 1920;
    const HEIGHT: usize = 1080;
    const BACKGROUND_COLOR: Color = Color::BLACK;

    fn duration(&self) -> Duration<'_> {
        Duration::Seconds(tl().total)
    }

    // The narration is muxed by fframes.mjs, at the level narrate.mjs left it.
    fn audio(&self) -> AudioMap<'_> {
        AudioMap(None)
    }

    fn render_frame<'a>(&'a self, frame: Frame, ctx: &FFramesContext<'a, '_>) -> Svgr<'a> {
        let mut frame = frame;
        let tl = tl();
        let big_t = frame.seconds();
        let n = tl.scenes.len();
        let mut layers: Vec<Svgr<'a>> = Vec::new();
        for (i, sc) in tl.scenes.iter().enumerate() {
            let t = big_t - sc.start;
            if !(t >= -0.001 && t <= sc.dur) {
                continue;
            }
            let mut s = S { frame: &mut frame, ctx, id: sc.id, i, t, b: sc.beats, d: sc.dur, start: sc.start, overlays: Vec::new(), fixed: false, o: 1.0, block: 0, next_block: 0, uid: 0, overlap_next: false };
            let body = (self.scene)(&mut s);
            let overlays = std::mem::take(&mut s.overlays);
            let fixed = s.fixed;
            // Handoff: fade in over 0.45 s while springing up from 97%; over the last
            // 0.4 s fade out while growing and lifting away. The camera pushes 1%
            // unless the scene holds a clip slot (or check runs calm).
            let first = i == 0;
            let last = i == n - 1;
            let fade_in = if first { 1.0 } else { p(t, 0.0, 0.45, Ease::Out) };
            let out = if last { 0.0 } else { p(t, sc.dur - 0.4, 0.4, Ease::InOut) };
            let enter = if first { 1.0 } else { spring(t, 0.0, Spring::Camera) };
            let push = if self.calm || fixed { 0.0 } else { 0.01 * Ease::InOut.at(clamp(t / sc.dur)) };
            let scale = (0.97 + 0.03 * enter) * (1.0 + push) * (1.0 + 0.03 * out);
            let tf = Tf { o: fade_in.min(1.0 - out), x: 0.0, y: 40.0 * (1.0 - enter) - 24.0 * out, s: scale };
            layers.push(svgr!(<g opacity={tf.o} transform={tf.css(960.0, 540.0)}>{body}{overlays}</g>));
        }
        let chrome = if self.calm { Svgr::empty() } else { chrome(&mut frame, ctx, big_t) };
        let dots = if self.dots && !self.calm { dot_field(big_t) } else { Svgr::empty() };
        let caption = if self.calm { Svgr::empty() } else { captions(&mut frame, ctx, big_t) };
        svgr!(
            <svg xmlns="http://www.w3.org/2000/svg" width={ctx.current_video_size.width} height={ctx.current_video_size.height} viewBox="0 0 1920 1080">
                <rect width="1920" height="1080" fill={BG} />
                {dots}
                {layers}
                {chrome}
                {caption}
            </svg>
        )
    }
}

/// Brand (top left), chapter "01 / 05  Title" (top right), progress line.
fn chrome<'a>(frame: &mut Frame, ctx: &FFramesContext<'a, '_>, big_t: f32) -> Svgr<'a> {
    let tl = tl();
    let n = tl.scenes.len();
    let (chap_n, title) = tl
        .scenes
        .iter()
        .enumerate()
        .rev()
        .find(|(_, s)| big_t >= s.start - 0.001)
        .map(|(i, s)| (format!("{:02} / {:02}  ", i + 1, n), s.title))
        .unwrap_or_default();
    let title_w = frame.text_width(ctx, fq(Type::CHIP.size(20.0).weight(600)), title).unwrap_or(0) as f32;
    let progress = (W * big_t / tl.total).max(0.5);
    let base = Type::CHIP.size(20.0).baseline(38.0);
    let brand = tl.brand;
    svgr!(<g>
        <rect x="0" y="0" width={progress} height="5" fill={ACC} />
        <text x="64" y={base} font-family={MONO} font-weight="500" font-size="20" fill={MUTE}>{brand}</text>
        <text x={1856.0 - title_w} y={base} text-anchor="end" font-family={MONO} font-weight="500" font-size="20" fill={MUTE}>{chap_n}</text>
        <text x="1856" y={base} text-anchor="end" font-family={MONO} font-weight="600" font-size="20" fill={INK}>{title}</text>
    </g>)
}

/// motion.js drawBg: a slow ring wave spreading over a 36 px dot grid.
fn dot_field<'a>(t: f32) -> Svgr<'a> {
    let cx = 1300.0 + (t * 0.13).sin() * 380.0;
    let cy = 380.0 + (t * 0.09).cos() * 200.0;
    let mut dots = Vec::with_capacity(1700);
    let mut y = 18.0_f32;
    while y < H {
        let mut x = 18.0_f32;
        while x < W {
            let d = ((x - cx).powi(2) + (y - cy).powi(2)).sqrt();
            let k = (d * 0.012 - t * 1.6).sin().max(0.0).powi(6) * (1.0 - d / 1500.0).max(0.0);
            let o = 0.07 + 0.55 * k;
            dots.push(svgr!(<circle cx={x} cy={y} r={1.4 + 1.8 * k} fill={DOTS} fill-opacity={o} />));
            x += 36.0;
        }
        y += 36.0;
    }
    svgr!(<g>{dots}</g>)
}

/// captions.js: the page of words being spoken, the spoken word marked. Styles
/// pill (accent pill), colour (accent text), pop (bold, outlined, no box) and line
/// (the plain subtitle line from TL.subs).
fn captions<'a>(frame: &mut Frame, ctx: &FFramesContext<'a, '_>, t: f32) -> Svgr<'a> {
    let tl = tl();
    let style = tl.caption_style;
    if style == "line" {
        let Some(cue) = tl.subs.iter().find(|(a, b, _)| t >= *a && t < *b + 0.15) else { return Svgr::empty() };
        let ty = Type { font: SANS, size: 38.0, weight: 500, ls: 0.0, lh: 1.3, upper: false, tone: Tone::Ink };
        let tw = frame.text_width(ctx, fq(ty), cue.2).unwrap_or(0) as f32;
        let (pw, ph) = (tw + 52.0, ty.line_h() + 24.0);
        let (px, py) = (960.0 - pw / 2.0, H - 52.0 - ph);
        let base = ty.baseline(py + 12.0);
        let text = cue.2;
        return svgr!(<g>
            <rect x={px} y={py} width={pw} height={ph} rx="12" fill="#000000" fill-opacity="0.753" />
            <text x="960" y={base} text-anchor="middle" font-family={SANS} font-weight="500" font-size="38" fill="#ffffff">{text}</text>
        </g>);
    }
    let mut page = None;
    for (i, pg) in tl.caps.iter().enumerate() {
        if pg.from > t {
            break;
        }
        if t < pg.to {
            page = Some(i);
        }
    }
    let Some(pi) = page else { return Svgr::empty() };
    let ws = tl.caps[pi].words;
    let on = ws.iter().rposition(|w| w.0 <= t);
    let pop_style = style == "pop";
    let ty = Type { font: SANS, size: 38.0, weight: if pop_style { 700 } else { 500 }, ls: 0.0, lh: 1.25, upper: false, tone: Tone::Ink };
    let fqq = fq(ty);
    let space = (frame.text_width(ctx, fqq, "a a").unwrap_or(0) as f32 - frame.text_width(ctx, fqq, "aa").unwrap_or(0) as f32).max(8.0);
    // .w: padding 0 7px, margin 0 -1px.
    let widths: Vec<f32> = ws.iter().map(|w| frame.text_width(ctx, fqq, w.2).unwrap_or(0) as f32 + 14.0).collect();
    let inner: f32 = widths.iter().sum::<f32>() - 2.0 * ws.len() as f32 + space * (ws.len() as f32 - 1.0);
    let (pw, ph) = (inner + 44.0, ty.line_h() + 16.0);
    let (px, py) = (960.0 - pw / 2.0, H - 40.0 - ph);
    let base = ty.baseline(py + 8.0);
    let mut x = px + 22.0 - 1.0;
    let mut items = Vec::new();
    for (i, w) in ws.iter().enumerate() {
        let ww = widths[i];
        let is_on = Some(i) == on;
        let past = on.is_some_and(|o| i < o);
        let next = !is_on && !past;
        let text = w.2;
        match style {
            "colour" => {
                let fill = if is_on { ACC } else { "#ffffff" };
                let op = if next { 0.62 } else { 1.0 };
                items.push(svgr!(<text x={x + 7.0} y={base} font-family={SANS} font-weight="500" font-size="38" fill={fill} opacity={op}>{text}</text>));
            }
            "pop" => {
                let fill = if is_on { OK } else { "#ffffff" };
                let op = if past { 0.6 } else { 1.0 };
                let sc = if is_on { 1.12 } else { 1.0 };
                let tr = Tf { o: 1.0, x: 0.0, y: 0.0, s: sc }.css(x + ww / 2.0, py + ph / 2.0);
                items.push(svgr!(<g opacity={op} transform={tr}>
                    <text x={x + 7.0} y={base + 3.0} font-family={SANS} font-weight="700" font-size="38" fill="#000000">{text}</text>
                    <text x={x + 7.0} y={base} font-family={SANS} font-weight="700" font-size="38" fill={fill} stroke="#000000" stroke-width="7" paint-order="stroke" stroke-linejoin="round">{text}</text>
                </g>));
            }
            _ => {
                if is_on {
                    items.push(svgr!(<rect x={x} y={py + 8.0} width={ww} height={ty.line_h()} rx="10" fill={ACC} />));
                }
                let fill = if is_on { BG } else { "#ffffff" };
                let op = if next { 0.62 } else { 1.0 };
                items.push(svgr!(<text x={x + 7.0} y={base} font-family={SANS} font-weight="500" font-size="38" fill={fill} opacity={op}>{text}</text>));
            }
        }
        x += ww - 2.0 + space;
    }
    let pill = if pop_style { Svgr::empty() } else { svgr!(<rect x={px} y={py} width={pw} height={ph} rx="12" fill="#000000" fill-opacity="0.753" />) };
    svgr!(<g>{pill}{items}</g>)
}

// ---------- the binary
#[derive(Debug, clap::Args)]
pub struct KitArgs {
    /// Skip the animated dot field.
    #[arg(long, global = true)]
    pub no_dots: bool,
}

/// The video binary's main: loads `<dir>/timeline.json` (and clips.json) and the
/// media in `<dir>/media`, then runs the fframes CLI (`render`, `frame`) with Skia
/// on the CPU unless `--renderer` asks for another backend. `dir` is the video
/// crate (pass env!("CARGO_MANIFEST_DIR")); VS_FF_DIR overrides it.
pub fn run(dir: &str, scene: SceneFn) -> std::process::ExitCode {
    use fframes::cli::{self, Renderer};
    use fframes::{EncoderOptions, MediaDirectory, RenderOptions};
    use fframes_skia_renderer::cli::SkiaRenderers;
    use fframes_skia_renderer::{SkiaPipelineConcurrencyPolicy, SkiaPipelineConfig};
    let dir = std::env::var("VS_FF_DIR").unwrap_or_else(|_| dir.to_string());
    let dir = std::path::PathBuf::from(dir);
    match timeline::load(&dir) {
        Ok(t) => {
            let _ = TL.set(t);
        }
        Err(e) => {
            eprintln!("vs-fframes: {e}");
            return std::process::ExitCode::from(2);
        }
    }
    let lint_out = std::env::var("VS_FF_LINT").ok().filter(|v| !v.is_empty());
    if lint_out.is_some() {
        lint::enable();
    }
    let args = cli::parse::<KitArgs>();
    let media_folder = match MediaDirectory::read_folder(dir.join("media")) {
        Ok(m) => m,
        Err(e) => {
            eprintln!("vs-fframes: cannot read {}: {e:?}", dir.join("media").display());
            return std::process::ExitCode::from(2);
        }
    };
    let media = match media_folder.process_media_source() {
        Ok(m) => m,
        Err(e) => {
            eprintln!("vs-fframes: cannot load media: {e:?}");
            return std::process::ExitCode::from(2);
        }
    };
    let video = Explainer { scene, calm: std::env::var("VS_CALM").is_ok_and(|v| v == "1"), dots: !args.app.no_dots };
    let mut renderers = SkiaRenderers::gpu(SkiaPipelineConfig { concurrency_policy: SkiaPipelineConcurrencyPolicy::MaxPerformance, ..Default::default() });
    renderers.default = Some(Renderer::SkiaCpu);
    let code = cli::new(
        &video,
        RenderOptions {
            media: Some(&media),
            default_font: SANS,
            video_encoder_options: EncoderOptions {
                preferred_encoder: Some("libx264"),
                codec_params: Some(&[("crf", "20"), ("preset", "medium")]),
                ..Default::default()
            },
            ..Default::default()
        },
    )
    .args(args)
    .renderers(renderers)
    .run();
    if let Some(path) = lint_out {
        if let Err(e) = lint::write(&path) {
            eprintln!("vs-fframes: cannot write {path}: {e}");
        }
    }
    code
}
