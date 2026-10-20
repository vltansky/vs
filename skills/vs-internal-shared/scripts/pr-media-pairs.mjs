// Missing media remains an explicit evidence gap; unrelated gaps never excuse it.
// The caller counts distinct hosted URLs and excludes risk/surface badge assets.
export function checkMediaPairs({ body, images, videos, frontend, functional }) {
  const noVisualChange = /No (?:visual|UI|user-visible) change:\s*\S.+/i.test(body);
  const screenshotGap = /Still unverified:?(?:\*\*)?\s*(?:visual proof|screenshots?);\s*\S.+/i.test(body);
  const videoGap = /Still unverified:?(?:\*\*)?\s*video;\s*\S.+/i.test(body);
  const reasons = [];
  if (frontend && !noVisualChange) {
    if (images < 2 && !screenshotGap) reasons.push('Before/After screenshots require two distinct hosted images or an exact screenshots gap');
    if (functional && videos < 2 && !videoGap) reasons.push('Functional UI changes require two distinct hosted Before/After videos or an exact video gap');
  }
  return { ok: reasons.length === 0, functional, screenshotGap, videoGap, reasons };
}
