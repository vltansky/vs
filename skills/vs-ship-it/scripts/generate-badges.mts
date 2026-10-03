// Regenerates the merge-risk and Surfaces badges embedded in PR bodies:
//   node skills/vs-ship-it/scripts/generate-badges.mts
// Each badge carries its own solid background, so one file reads on GitHub light and dark
// themes without a <picture> pair.
import fs from 'node:fs';
import path from 'node:path';

type DoorBlastBadge = {
  file: string;
  label: string;
  value: string;
  color: string;
  icon: string;
  alt: string;
};

type SurfaceKind = {
  kind: string;
  label: string;
  color: string;
  icon: string;
  iconY: number;
  labelW: number;
  letterSpacing: string;
};

// 12x12 strokes drawn in white on the label segment.
const ICON = {
  twoWay: '<path d="M1 4h9M7 1l3 3-3 3M11 8H2M5 5L2 8l3 3"/>',
  oneWay: '<path d="M1 6h8M6 3l3 3-3 3M11 1v10"/>',
  wide: '<circle cx="6" cy="6" r="1.5" fill="#fff"/><circle cx="6" cy="6" r="3.5"/><circle cx="6" cy="6" r="5.5" stroke-dasharray="2 1.6"/>',
  narrow: '<circle cx="6" cy="6" r="1.5" fill="#fff"/><circle cx="6" cy="6" r="3.5"/>',
  endpoint:
    '<path d="M2 3h8v6H2z"/><path d="M5 1v2M7 1v2M5 9v2M7 9v2M1 5h2M1 7h2M9 5h2M9 7h2"/>',
  schema: '<rect x="1" y="1" width="10" height="11" rx="1"/><path d="M3.5 4.5h5M3.5 7.5h5M3.5 10.5h3"/>',
  ui: '<rect x="1" y="1" width="10" height="8" rx="1"/><path d="M4 12h4"/>',
  cli: '<path d="M2 3l4 3-4 3M7 10h5"/>',
  mcp: '<circle cx="3" cy="6" r="2"/><circle cx="9" cy="6" r="2"/><path d="M5 6h2"/>',
  infra: '<path d="M2 11V5l4-3 4 3v6"/><path d="M2 11h8M6 11V7"/>',
};

const DOOR_BLAST: DoorBlastBadge[] = [
  {
    file: 'badge-two-way-door.svg',
    label: 'DOOR',
    value: 'two-way · easy to revert',
    color: '#1a7f64',
    icon: ICON.twoWay,
    alt: 'Two-way door: easy to revert',
  },
  {
    file: 'badge-one-way-door.svg',
    label: 'DOOR',
    value: 'one-way · review carefully',
    color: '#c62f3b',
    icon: ICON.oneWay,
    alt: 'One-way door: hard to reverse — review carefully',
  },
  {
    file: 'badge-wide-blast.svg',
    label: 'BLAST',
    value: 'wide · many consumers',
    color: '#c2530a',
    icon: ICON.wide,
    alt: 'Wide blast radius: many consumers',
  },
  {
    file: 'badge-narrow-blast.svg',
    label: 'BLAST',
    value: 'narrow · contained',
    color: '#57606a',
    icon: ICON.narrow,
    alt: 'Narrow blast radius: contained',
  },
];

// Surfaces chips: black body, kind accent strip + kind-colored count pill.
// Count = # of deployable-module bullets under that kind (not severity/files/blast).
// Colors (locked): Endpoint teal, Schema purple, UI blue; CLI slate, MCP teal-green, Infra orange.
const SURFACES: SurfaceKind[] = [
  {
    kind: 'endpoint',
    label: 'ENDPOINT',
    color: '#1a7f64',
    icon: ICON.endpoint,
    iconY: 6,
    labelW: 76,
    letterSpacing: '.3',
  },
  {
    kind: 'schema',
    label: 'SCHEMA',
    color: '#8250df',
    icon: ICON.schema,
    iconY: 5.5,
    labelW: 62,
    letterSpacing: '.3',
  },
  {
    kind: 'ui',
    label: 'UI',
    color: '#0969da',
    icon: ICON.ui,
    iconY: 5.5,
    labelW: 28,
    letterSpacing: '.5',
  },
  {
    kind: 'cli',
    label: 'CLI',
    color: '#57606a',
    icon: ICON.cli,
    iconY: 6,
    labelW: 34,
    letterSpacing: '.5',
  },
  {
    kind: 'mcp',
    label: 'MCP',
    color: '#0e8a7d',
    icon: ICON.mcp,
    iconY: 6,
    labelW: 40,
    letterSpacing: '.5',
  },
  {
    kind: 'infra',
    label: 'INFRA',
    color: '#c2530a',
    icon: ICON.infra,
    iconY: 5.5,
    labelW: 48,
    letterSpacing: '.3',
  },
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
  ['1', 14],
  ['2', 14],
  ['3', 14],
  ['4', 14],
  ['5', 14],
  ['6', 14],
]);

const width = (text: string) => {
  const measured = TEXT_WIDTH.get(text);
  if (measured === undefined) throw new Error(`No measured width for "${text}"; add it to TEXT_WIDTH.`);
  return measured;
};

const renderDoorBlast = (b: DoorBlastBadge) => {
  const h = 24,
    pad = 9,
    iconW = 12,
    gap = 6;
  const labelW = width(b.label),
    valueW = width(b.value);
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

const titleCase = (kind: string) =>
  kind === 'ui' ? 'UI' : kind === 'mcp' ? 'MCP' : kind === 'cli' ? 'CLI' : kind[0].toUpperCase() + kind.slice(1);

const renderSurface = (s: SurfaceKind, n: number) => {
  const h = 24,
    iconPad = 12,
    iconW = 12,
    labelX = 32,
    countPill = 30,
    countTextW = width(String(n));
  const leftW = labelX + s.labelW + 10;
  const w = leftW + countPill;
  const countX = leftW + (countPill - countTextW) / 2;
  const modulesWord = n === 1 ? 'module' : 'modules';
  const alt = `Surface: ${titleCase(s.kind)} · ${n} ${modulesWord}`;
  const file = `badge-surface-${s.kind}-${n}.svg`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${alt}">
<title>Surface: ${titleCase(s.kind)} · ${n}</title>
<clipPath id="r"><rect width="${w}" height="${h}" rx="6"/></clipPath>
<g clip-path="url(#r)"><rect width="${leftW}" height="${h}" fill="#24292f"/><rect x="${leftW}" width="${countPill}" height="${h}" fill="${s.color}"/><rect width="4" height="${h}" fill="${s.color}"/></g>
<g transform="translate(${iconPad} ${s.iconY})" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${s.icon}</g>
<g fill="#fff" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" font-size="11">
<text x="${labelX}" y="16" font-weight="700" letter-spacing="${s.letterSpacing}" textLength="${s.labelW}">${s.label}</text>
<text x="${countX}" y="16" font-weight="700" textLength="${countTextW}">${n}</text>
</g></svg>
`;
  return { file, svg };
};

const assets = path.join(import.meta.dirname, '..', 'assets');

// Drop prior surface chips so renamed/uncounted files cannot linger.
for (const name of fs.readdirSync(assets)) {
  if (name.startsWith('badge-surface-') && name.endsWith('.svg')) {
    fs.unlinkSync(path.join(assets, name));
  }
}

for (const badge of DOOR_BLAST) {
  fs.writeFileSync(path.join(assets, badge.file), renderDoorBlast(badge));
}

for (const surface of SURFACES) {
  for (let n = 1; n <= 6; n++) {
    const { file, svg } = renderSurface(surface, n);
    fs.writeFileSync(path.join(assets, file), svg);
  }
}
