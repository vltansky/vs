// Example scenes for script.example.json. Replace them with your own; keep the
// shape: build the DOM once, return update(t, B, D), drive every change from
// t and the beat starts B. Helpers come from motion.js.

scene('intro', (R) => {
  const title = box(R, 160, 300, 0, 0, 'h1', 'Why does search<br><span class="acc">miss the cache?</span>');
  const example = box(R, 1260, 560, 500, 260, 'card pad',
    '<div class="lbl">example request</div>' +
    '<div class="h3 mono" style="margin:26px 0 22px">GET /search?q=nile</div>' +
    '<span class="chip">840 ms</span> <span class="chip">every time</span>');
  return (t, B) => {
    rise(title, t, 0.15, { dy: 60, d: 0.8 });
    pop(example, t, B[1]);
  };
});

scene('miss', (R) => {
  const svg = svgLayer(R);
  const term = terminal(R, 120, 170, 860, 240, 'browser');
  const cdn = box(R, 1160, 170, 640, 420, 'card');
  cdn.innerHTML = '<div class="head-row"><div class="glyph">C</div>CDN<span class="meta">cache</span></div><div class="pad"></div>';
  const keys = cdn.querySelector('.pad');
  const rows = ['?q=nile&t=1001', '?q=nile&t=1002', '?q=nile&t=1003'].map((k) => el(keys, 'row mono', k, { fontSize: '24px', marginBottom: '14px' }));
  const wire = path(svg, curve(980, 300, 1160, 300), 'ln acc arrow');
  const packet = dot(svg, 9);
  const miss = box(R, 1160, 640, 0, 0, 'chip bad', 'MISS  x3');
  miss.style.fontSize = '30px';
  return (t, B) => {
    rise(term.el, t, 0);
    rise(cdn, t, 0.2, { dx: 40, dy: 0 });
    type(term.body, [
      { text: '$ GET /search?q=nile', cls: '' },
      { text: '  &t=1696339200', cls: 'acc', at: B[0] + 1.4 },
    ], t, B[0]);
    draw(wire, P(t, B[1], 0.7));
    along(packet, wire, P(t, B[1] + 0.3, 0.9, ease.inOut));
    rows.forEach((r, i) => {
      rise(r, t, B[2] + i * 0.45, { dx: -20, dy: 0, d: 0.4 });
      flash(r, t, B[2] + i * 0.45);
    });
    pop(miss, t, B[2] + 2.2);
  };
});

scene('fix', (R) => {
  const before = box(R, 120, 220, 780, 0, 'card pad',
    '<div class="lbl">cache key before</div><div class="h3 mono" style="margin-top:18px">/search?q=nile<span class="bad strike">&amp;t=…</span></div>');
  const after = box(R, 120, 420, 780, 0, 'card pad',
    '<div class="lbl">cache key after</div><div class="h3 mono" style="margin-top:18px">/search?q=nile</div>');
  const hit = box(R, 1100, 220, 700, 400, 'card pad',
    '<div class="lbl">second search for nile</div><div class="chip ok" style="margin-top:24px;font-size:30px">HIT</div>' +
    '<div style="margin-top:36px"><span class="h2 mono ms">840</span><span class="h3 mute"> ms</span></div>');
  const ms = hit.querySelector('.ms');
  return (t, B) => {
    rise(before, t, 0.1);
    dim(before, t, B[0] + 1.6);
    rise(after, t, B[0] + 0.8);
    flash(after, t, B[0] + 1.2);
    rise(hit, t, B[1], { dx: 40, dy: 0 });
    count(ms, t, B[1] + 2.4, 840, 12, 1.2);
    ms.classList.toggle('ok', t > B[1] + 3.6);
  };
});
