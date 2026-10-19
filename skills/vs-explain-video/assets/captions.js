// Word captions on the stage: the page of up to 6 written words being spoken,
// with the word being said marked. Pages and word times come from
// timeline.js (TL.caps, written by narrate.mjs); the style from
// TL.captions.style: pill (default), colour, pop, or line (the plain caption
// line from TL.subs). A pure function of T, like every scene: motion.js calls
// VSCaptions.draw from seek(T).
(function (root) {
  const CSS = `
#sub.cap { bottom: 40px; }
#sub.cap > span { max-width: 1500px; padding: 8px 22px; line-height: 1.25; white-space: normal; }
#sub.cap .w { display: inline-block; padding: 0 7px; margin: 0 -1px; border-radius: 10px; }
#sub.cap .w.next { opacity: 0.62; }
#sub.cap-pill .w.on { background: var(--acc); color: #14100a; }
#sub.cap-colour .w.on { color: var(--acc); }
#sub.cap-pop > span { background: none; font-weight: 700; -webkit-text-stroke: 7px #000; paint-order: stroke; text-shadow: 0 3px 0 #000; }
#sub.cap-pop .w.past { opacity: 0.6; }
#sub.cap-pop .w.next { opacity: 1; }
#sub.cap-pop .w.on { color: var(--ok); transform: scale(1.12); }
`;

  // The page on screen at T (the latest page that has started and not ended),
  // and the word lit on it: the last word that has started, so a word holds
  // through the short gap before the next one.
  function state(caps, T) {
    let page = -1;
    for (let i = 0; i < caps.length; i += 1) {
      if (caps[i].from > T) break;
      if (T < caps[i].to) page = i;
    }
    if (page < 0) return { page: -1, word: -1 };
    const words = caps[page].words;
    let word = -1;
    for (let i = 0; i < words.length; i += 1) if (words[i][0] <= T) word = i;
    return { page, word };
  }

  function install(doc) {
    if (doc.getElementById('vs-captions-css')) return;
    const style = doc.createElement('style');
    style.id = 'vs-captions-css';
    style.textContent = CSS;
    doc.head.appendChild(style);
  }

  // Draws into the #sub span. Returns false when the stage should draw the
  // plain line instead (style "line", or a timeline without word pages).
  function draw(span, TL, T) {
    const style = (TL.captions && TL.captions.style) || 'pill';
    const box = span.parentElement;
    if (style === 'line' || !Array.isArray(TL.caps)) {
      box.className = '';
      return false;
    }
    install(span.ownerDocument);
    box.className = `cap cap-${style}`;
    const { page, word } = state(TL.caps, T);
    if (page < 0) {
      span.textContent = '';
      span.dataset.page = '';
      return true;
    }
    if (span.dataset.page !== String(page)) {
      span.textContent = '';
      TL.caps[page].words.forEach(([, , text], i) => {
        if (i) span.appendChild(span.ownerDocument.createTextNode(' '));
        const w = span.ownerDocument.createElement('span');
        w.className = 'w';
        w.textContent = text;
        span.appendChild(w);
      });
      span.dataset.page = String(page);
    }
    span.querySelectorAll('.w').forEach((w, i) => {
      w.className = `w ${i < word ? 'past' : i === word ? 'on' : 'next'}`;
    });
    return true;
  }

  root.VSCaptions = { state, draw, CSS };
})(typeof window !== 'undefined' ? window : globalThis);
