// Draws a pointer and a click ripple into a page being recorded. Headless browsers record the
// viewport but never the cursor, so without this a demo video shows effects with no visible cause.
//
// Usage, before the first navigation so it survives every later goto:
//   import { cursorOverlayScript } from '<shared>/scripts/cursor-overlay.mjs';
//   await page.addInitScript(cursorOverlayScript);
//
// It only draws what real pointer events report. Driving the page with element.click() produces no
// pointer event, so the recording stays empty: use page.mouse at real coordinates.
export const cursorOverlayScript = () => {
  const install = () => {
    // An arrow whose tip is the event coordinate, not a filled dot: a dot covers the very control
    // it is pressing, which is the thing the frame has to show.
    const arrow =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="30" viewBox="0 0 24 30">' +
      '<path d="M2 1.5 L2 21 L7.2 16.2 L10.7 24.5 L14.2 23 L10.8 15 L17.5 14.6 Z" ' +
      'fill="#111" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>';

    const cursor = document.createElement('div');
    cursor.dataset.demoCursor = 'true';
    cursor.style.cssText = [
      'position:fixed',
      'z-index:2147483647',
      'width:24px',
      'height:30px',
      // Neutralize the UA [popover] rules (border:solid, padding:.25em, inset:0) that would draw a
      // box around the arrow and re-anchor it once it is promoted to the top layer.
      'border:0',
      'padding:0',
      'right:auto',
      'bottom:auto',
      // No offset: the arrow tip sits at the box origin, so left/top are the real hotspot.
      'margin:0',
      `background:url("data:image/svg+xml,${encodeURIComponent(arrow)}") no-repeat`,
      'filter:drop-shadow(0 1px 3px rgba(0,0,0,.45))',
      'pointer-events:none',
      'opacity:0',
      'transition:opacity .15s ease',
      'left:0',
      'top:0',
    ].join(';');

    const style = document.createElement('style');
    style.textContent = `@keyframes demo-cursor-ripple {
      from { transform: scale(.35); opacity: .9; }
      to   { transform: scale(1);   opacity: 0; }
    }`;
    document.head.appendChild(style);

    // An app that uses popover or <dialog> puts its own UI in the top layer, which no z-index can
    // beat. Top-layer order follows promotion order, so the cursor has to re-enter the layer after
    // the app or it is painted over exactly where the demo parks the pointer.
    const raise = (element) => {
      try {
        if (element.matches(':popover-open')) element.hidePopover();
        element.showPopover();
      } catch {
        // No top-layer support: the element still paints, just below same-z-index app UI.
      }
    };

    document.body.appendChild(cursor);
    cursor.popover = 'manual';
    raise(cursor);

    let queued = false;
    const keepOnTop = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        raise(cursor);
      });
    };

    // Capture phase on window: app UI inside a shadow root retargets its events, but they still
    // reach window, so one listener covers both the page and any overlay.
    window.addEventListener(
      'mousemove',
      (event) => {
        cursor.style.opacity = '1';
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
        keepOnTop();
      },
      true,
    );

    window.addEventListener(
      'mousedown',
      (event) => {
        const ripple = document.createElement('div');
        ripple.style.cssText = [
          'position:fixed',
          'z-index:2147483646',
          'width:46px',
          'height:46px',
          'padding:0',
          'right:auto',
          'bottom:auto',
          'margin:-23px 0 0 -23px',
          'border-radius:50%',
          'border:3px solid #e5484d',
          'background:rgba(229,72,77,.18)',
          'pointer-events:none',
          `left:${event.clientX}px`,
          `top:${event.clientY}px`,
          'animation:demo-cursor-ripple .55s ease-out forwards',
        ].join(';');
        document.body.appendChild(ripple);
        ripple.popover = 'manual';
        raise(ripple);
        // The ripple was promoted last, so put the cursor back above it.
        raise(cursor);
        setTimeout(() => ripple.remove(), 600);
      },
      true,
    );
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
};
