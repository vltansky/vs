// How long each part of a recorded step stays on screen.
//
// A video is watched by a person, so every step reads as: caption appears -> the viewer reads
// it -> the pointer visibly travels -> the action happens -> the result holds. Stills-only runs
// (--no-video) have no viewer, so they keep only the short settle a screenshot needs.

// ~215 words per minute, the pace of reading an overlay while also watching the page.
const READ_MS_PER_WORD = 280;
const MIN_READ_MS = 1200;
// Cap so one long caption never stalls the clip; shorten the caption instead.
const MAX_READ_MS = 4000;

const VIDEO = {
  startMs: 1000,
  travelMs: 700,
  pressMs: 120,
  typeDelayMs: 90,
  resultMs: 1500,
  endMs: 2000,
};

// The settle a screenshot needs so it shows the result, not the press.
const STILLS = {
  startMs: 0,
  travelMs: 0,
  pressMs: 90,
  typeDelayMs: 45,
  resultMs: 250,
  endMs: 600,
};

export const captionHoldMs = (caption) => {
  const words = String(caption ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.min(MAX_READ_MS, Math.max(MIN_READ_MS, words * READ_MS_PER_WORD));
};

export const flowPacing = ({ video }) => (video ? VIDEO : STILLS);

// A step with a new caption holds it before acting; a step that moves the pointer spends
// travelMs doing so, so the cursor is seen arriving rather than teleporting.
export const stepPacing = (step, { video }) => {
  const pace = flowPacing({ video });
  const hasCaption = typeof step.caption === 'string' && step.caption.length > 0;
  const movesPointer = Boolean(step.click || step.hover || step.type);
  return {
    leadMs: video && hasCaption ? captionHoldMs(step.caption) : 0,
    travelMs: movesPointer ? pace.travelMs : 0,
    pressMs: pace.pressMs,
    typeDelayMs: pace.typeDelayMs,
    resultMs: step.still && !video ? 350 : pace.resultMs,
  };
};

// mouse.move with { steps } emits every step within a frame or two, so the cursor appears to
// teleport. Timed increments with ease-in-out make the travel visible in the recording.
export const travelPointer = async (page, from, to, travelMs) => {
  if (travelMs <= 0) {
    await page.mouse.move(to.x, to.y, { steps: 12 });
    return to;
  }
  const frames = Math.max(1, Math.round(travelMs / 16));
  for (let frame = 1; frame <= frames; frame += 1) {
    const t = frame / frames;
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    await page.mouse.move(from.x + (to.x - from.x) * ease, from.y + (to.y - from.y) * ease);
    await page.waitForTimeout(travelMs / frames);
  }
  return to;
};
