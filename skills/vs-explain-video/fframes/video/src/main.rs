//! The scenes of one explainer, on the vs fframes kit. One arm per scene id in
//! script.json; every value comes from s.t (seconds into the scene) and the beat
//! starts s.b, so any frame renders on its own. Replace these example scenes
//! (assets/script.example.json) with yours; keep the shape.
//!
//! Layout is in 1920x1080 stage pixels. Keep text >= 20 px, out of the bottom
//! 150 px (captions) and inside 64 px of the edges.
use vs_fframes_kit::*;

fn scene<'a>(s: &mut S<'_, 'a, '_>) -> Svgr<'a> {
    let b = s.b;
    match s.id {
        "intro" => {
            // Heading words rise one by one; the {mark:...} words get the sweep at b[0] + 1.2.
            let title = s.words_with(160.0, 300.0, Type::H1, &["Why does search", "{mark:miss the cache?}"], 0.15, Some(b[0] + 1.2));
            let title = s.group(Tf::ID.dim(s.t, b[1] + 0.6), 160.0, 300.0, 1400.0, 250.0, |_| vec![title]);
            let example = s.card(1260.0, 560.0, 500.0, 260.0, s.pop(b[1]), Glow::None, |s| {
                vec![
                    s.label(1292.0, 588.0, "EXAMPLE REQUEST", Tf::ID),
                    s.text(1292.0, 640.0, Type::H3.size(36.0).weight(500).mono(), "GET /search?q=nile"),
                    s.chip(1292.0, 730.0, "840 ms", Tone::Ink, Tf::ID),
                    s.chip(1420.0, 730.0, "every time", Tone::Ink, Tf::ID),
                ]
            });
            svgr!(<g>{title}{example}</g>)
        }
        "miss" => {
            let term = s.terminal(120.0, 170.0, 860.0, 240.0, "browser", &[Line::cmd("$ GET /search?q=nile"), Line::cmd("  &t=1696339200").tone(Tone::Acc).at(b[0] + 1.4)], b[0], s.rise(0.0));
            let cdn_tf = s.rise_with(0.2, Rise { dx: 40.0, dy: 0.0, ..Default::default() });
            let glow = s.focus(1);
            let cdn = s.card(1160.0, 170.0, 640.0, 470.0, cdn_tf, glow, |s| {
                let (head, hh) = s.head_row(1160.0, 170.0, 640.0, "C", "CDN", "cache");
                let mut kids = vec![head];
                let mono = Type::ROW.size(24.0).mono();
                let top = 170.0 + hh + 28.0;
                let key_tf = s.rise_with(b[1] + 1.2, Rise { dx: -20.0, dy: 0.0, d: 0.5, ..Default::default() });
                kids.push(s.row(1192.0, top, 576.0, "", "key = path + full query", mono.tone(Tone::Acc), key_tf, Glow::None));
                for (i, k) in ["?q=nile&t=1001", "?q=nile&t=1002", "?q=nile&t=1003"].iter().enumerate() {
                    let at = b[2] + i as f32 * 0.45;
                    let tf = s.rise_with(at, Rise { dx: -20.0, dy: 0.0, d: 0.4, ..Default::default() });
                    let flash = s.flash(at);
                    kids.push(s.row(1192.0, top + (i as f32 + 1.0) * 76.0, 576.0, "", k, mono, tf, flash));
                }
                kids
            });
            let wire = Curve::new(980.0, 300.0, 1160.0, 300.0);
            let line = s.line(&wire, Tone::Acc, false, true, s.p(b[1], 0.7));
            let packet = s.dot_along(&wire, s.p_io(b[1] + 0.3, 0.9), 9.0, Tone::Acc);
            let miss = s.chip_sized(1160.0, 680.0, "MISS  x3", Tone::Bad, 30.0, s.pop(b[2] + 2.2));
            svgr!(<g>{term}{cdn}{line}{packet}{miss}</g>)
        }
        "fix" => {
            let key = Type::H3.mono();
            let before = s.card(120.0, 220.0, 780.0, 160.0, s.rise(0.1).dim(s.t, b[0] + 1.6), Glow::None, |s| {
                vec![s.label(152.0, 248.0, "CACHE KEY BEFORE", Tf::ID), s.text(152.0, 292.0, key, "/search?q=nile{bad:&t=…}")]
            });
            let after = s.card(120.0, 420.0, 780.0, 160.0, s.rise(b[0] + 0.8), s.flash(b[0] + 1.2), |s| {
                vec![s.label(152.0, 448.0, "CACHE KEY AFTER", Tf::ID), s.text(152.0, 492.0, key, "/search?q=nile")]
            });
            let ms = s.count(b[1] + 2.4, 840.0, 12.0, 1.2);
            let done = s.t > b[1] + 3.6;
            let hit_tf = s.rise_with(b[1], Rise { dx: 40.0, dy: 0.0, ..Default::default() });
            let hit = s.card(1100.0, 220.0, 700.0, 400.0, hit_tf, Glow::None, |s| {
                let big = Type::H2.mono().tone(if done { Tone::Ok } else { Tone::Ink });
                let w = s.measure(big, ms);
                vec![
                    s.label(1132.0, 248.0, "SECOND SEARCH FOR NILE", Tf::ID),
                    s.chip_sized(1132.0, 300.0, "HIT", Tone::Ok, 30.0, Tf::ID),
                    s.text(1132.0, 402.0, big, ms),
                    s.text(1132.0 + w, 402.0 + 24.0, Type::H3.tone(Tone::Mute), " ms"),
                ]
            });
            svgr!(<g>{before}{after}{hit}</g>)
        }
        _ => Svgr::empty(),
    }
}

fn main() -> std::process::ExitCode {
    vs_fframes_kit::run(env!("CARGO_MANIFEST_DIR"), scene)
}
