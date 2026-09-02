# Recording a demo video

Shared by `vs-qa` and `vs-ship-it`. It defines how an agent captures a video
that actually proves an interaction, and the failure modes that quietly produce
a useless one.

Matched stills are the default proof. Record only when the behavior *is* the
motion: a multi-step flow, drag/resize, scroll, timing, transitions, or a mode
change whose cause is a click. A recording of a static state is worse than a
screenshot of it.

## Capture

Record through the browser automation the run already uses. With Playwright,
recording is a context option and the file only exists after the context closes:

```js
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();
// ... drive the flow ...
const video = page.video();
await context.close();          // flushes the file
const videoPath = await video.path();
```

Capture the stills in the same pass as the video, at the same moments in the
same flow. Two separate passes drift, and a caption that describes a state the
video never reaches is a fabricated claim.

## The two reasons clicks are invisible

A recorded demo routinely shows effects with no visible cause. There are two
independent causes and both must be fixed, or the video still looks haunted.

**1. The browser records the viewport, not the pointer.** Headless Chromium
composites no cursor into the video. Nothing you do to the page fixes this;
the pointer has to be drawn by the page itself.

**2. `element.click()` fires no pointer event.** A programmatic click dispatches
only a synthetic `click`, so there is no `mousemove` or `mousedown` to draw and
nothing travels to the control. Drive the flow with real coordinates instead:

```js
const box = await element.boundingBox();
// Move first and pause: the recording has to show the pointer arriving before
// the control fires, or the effect still reads as spontaneous.
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 });
await page.waitForTimeout(450);
await page.mouse.down();
await page.waitForTimeout(120);
await page.mouse.up();
```

Real mouse input is not always equivalent to a programmatic click. A control
that depends on the current text selection only survives a real press if it
calls `preventDefault()` on `mousedown`. Check before switching, and if the
product does not preventDefault, say so rather than recording a broken flow.

## Drawing the pointer

Use [`../scripts/cursor-overlay.mjs`](../scripts/cursor-overlay.mjs). Install it
before the first navigation so it survives every later one:

```js
import { cursorOverlayScript } from '<vs-internal-shared>/scripts/cursor-overlay.mjs';
await page.addInitScript(cursorOverlayScript);
await page.goto(url);
```

It draws an arrow at every `mousemove` and a red ring at every `mousedown`, from
real events only — which is also what forces cause (2) above to be fixed.

Two gotchas are baked into that file; they are repeated here because they look
like "the injection failed" and send the run down the wrong diagnosis:

- **The top layer beats every z-index.** An app that uses `popover` or
  `<dialog>` puts its own UI in the top layer, and top-layer paint order follows
  *promotion order*, not `z-index`. An overlay promoted after the cursor covers
  it exactly where the demo parks the pointer — `z-index: 2147483647` changes
  nothing. The fix is to re-promote the cursor (`hidePopover()` then
  `showPopover()`), rAF-throttled on mousemove.
- **UA `[popover]` styles apply the moment you promote.** They add
  `border: solid`, `padding: .25em`, and `inset: 0`, which draw a box around the
  cursor and re-anchor it. Neutralize with `border:0; padding:0; right:auto;
  bottom:auto`.

## Verify before claiming

An invisible cursor is silent: the script runs, the events fire, and the video
is simply wrong. Open a frame — screenshot mid-press and look at it — before
reporting that the recording proves anything.

When the element seems absent, check whether it is *painting underneath*
something rather than missing: temporarily size it large and give it a loud
background. A correct `getBoundingClientRect`, `opacity: 1`, and
`checkVisibility() === true` on an element you cannot see means a stacking
problem, not an injection problem.

## Publishing

Transcode WebM for broad playback when `ffmpeg` is available:

```bash
ffmpeg -y -i in.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart out.mp4
```

Upload and embed per the host workflow's media step. Video embeds as a bare URL
on its own line; `![]()` does not render GitHub's player.

State in the description that the pointer and click ring are drawn by the
recording harness and are not product UI. A reviewer who mistakes them for
rendered chrome will file a bug against them.
