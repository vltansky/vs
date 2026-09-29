// Regenerates the merge-risk badges embedded in PR bodies:
//   node skills/vs-ship-it/scripts/generate-badges.mts
// Each badge carries its own solid background, so one file reads on GitHub light and dark
// themes without a <picture> pair.
import fs from 'node:fs';
import path from 'node:path';

type Badge = { file: string; label: string; value: string; color: string; icon: string; alt: string };

// 12x12 strokes drawn in white on the label segment.
const ICON = {
  twoWay: '<path d="M1 4h9M7 1l3 3-3 3M11 8H2M5 5L2 8l3 3"/>',
  oneWay: '<path d="M1 6h8M6 3l3 3-3 3M11 1v10"/>',
  wide: '<circle cx="6" cy="6" r="1.5" fill="#fff"/><circle cx="6" cy="6" r="3.5"/><circle cx="6" cy="6" r="5.5" stroke-dasharray="2 1.6"/>',
  narrow: '<circle cx="6" cy="6" r="1.5" fill="#fff"/><circle cx="6" cy="6" r="3.5"/>',
};

const BADGES: Badge[] = [
  { file: 'badge-two-way-door.svg', label: 'DOOR', value: 'two-way · easy to revert', color: '#1a7f64', icon: ICON.twoWay, alt: 'Two-way door: easy to revert' },
  { file: 'badge-one-way-door.svg', label: 'DOOR', value: 'one-way · review carefully', color: '#c62f3b', icon: ICON.oneWay, alt: 'One-way door: hard to reverse — review carefully' },
  { file: 'badge-wide-blast.svg', label: 'BLAST', value: 'wide · many consumers', color: '#c2530a', icon: ICON.wide, alt: 'Wide blast radius: many consumers' },
  { file: 'badge-narrow-blast.svg', label: 'BLAST', value: 'narrow · contained', color: '#57606a', icon: ICON.narrow, alt: 'Narrow blast radius: contained' },
];

// Widths measured in Chrome (SF, 11px). textLength pins them so a viewer with another system
// font still fits the box instead of overflowing it; new text needs a new measurement.
const TEXT_WIDTH = new Map<string, number>([
  ['DOOR', 36],
  ['BLAST', 40],
  ['two-way · easy to revert', 132],
  ['one-way · review carefully', 144],
  ['wide · many consumers', 129],
  ['narrow · contained', 103],
]);

const width = (text: string) => {
  const measured = TEXT_WIDTH.get(text);
  if (measured === undefined) throw new Error(`No measured width for "${text}"; add it to TEXT_WIDTH.`);
  return measured;
};

const render = (b: Badge) => {
  const h = 24, pad = 9, iconW = 12, gap = 6;
  const labelW = width(b.label), valueW = width(b.value);
  const leftW = pad + iconW + gap + labelW + pad;
  const rightW = pad + valueW + pad;
  const w = leftW + rightW;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${b.alt}">
<title>${b.alt}</title>
<clipPath id="r"><rect width="${w}" height="${h}" rx="6"/></clipPath>
<g clip-path="url(#r)"><rect width="${leftW}" height="${h}" fill="#24292f"/><rect x="${leftW}" width="${rightW}" height="${h}" fill="${b.color}"/></g>
<g transform="translate(${pad} 6)" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${b.icon}</g>
<g fill="#fff" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" font-size="11">
<text x="${pad + iconW + gap}" y="16" font-weight="700" letter-spacing=".5" textLength="${labelW}">${b.label}</text>
<text x="${leftW + pad}" y="16" font-weight="600" textLength="${valueW}">${b.value}</text>
</g></svg>
`;
};

const assets = path.join(import.meta.dirname, '..', 'assets');
for (const badge of BADGES) fs.writeFileSync(path.join(assets, badge.file), render(badge));
