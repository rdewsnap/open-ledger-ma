// Renders public/og.png (1200×630) from an authored SVG. Run: pnpm og
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import wawoff2 from 'wawoff2';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = {
  paper: '#F7F3EA', paper2: '#EFE9DC', rule: '#D9D1C2', ink: '#2B2824', ink2: '#6B655C',
  clay: '#B5542D', slate: '#4A5A6A', sand1: '#C9A27E', sand2: '#D9BE9C', sand3: '#E6D3B8',
};

// --- tiny sankey: 3 columns, proportional links (illustrative shape only) ---
const W = 1200, H = 630;
const top = 318, bottom = 572, nodeW = 12, pad = 9;
const cols = [
  { x: 72, vals: [30, 17, 8, 7, 6, 4, 3], colors: ['#4A5A6A', '#5B6A79', '#6E7C89', '#828E99', '#96A0A9', '#A9B2B9', '#BCC5CD'] },
  { x: 588, vals: [35, 13, 7, 5, 3, 2, 2, 1.6, 1.4], colors: [C.clay, '#BC6A45', '#C3815E', C.sand1, '#CFAE8B', C.sand2, '#DCC3A3', '#E1CBAD', C.sand3] },
  { x: 1116, vals: [], colors: [] },
];
const total = cols[0].vals.reduce((a, b) => a + b, 0);
const midTotal = cols[1].vals.reduce((a, b) => a + b, 0);
// right column: each mid node splits into 1–3 programs
const splits = [[0.34, 0.22, 0.44], [0.55, 0.45], [0.6, 0.4], [1], [1], [1], [1], [1], [1]];
const right = [];
cols[1].vals.forEach((v, i) => splits[i].forEach((s) => right.push({ v: v * s, from: i })));
cols[2].vals = right.map((r) => r.v);
cols[2].colors = right.map((r) => cols[1].colors[r.from]);

function stack(vals, scaleTotal) {
  const span = bottom - top - pad * (vals.length - 1);
  const k = span / scaleTotal;
  let y = top;
  return vals.map((v) => { const n = { y0: y, y1: y + v * k, k }; y = n.y1 + pad; return n; });
}
const L = stack(cols[0].vals, total);
const M = stack(cols[1].vals, midTotal);
const R = stack(cols[2].vals, midTotal);
const ribbon = (x0, a0, a1, x1, b0, b1) => {
  const xm = (x0 + x1) / 2;
  return `M${x0},${a0}C${xm},${a0} ${xm},${b0} ${x1},${b0}L${x1},${b1}C${xm},${b1} ${xm},${a1} ${x0},${a1}Z`;
};
let paths = '';
const outL = L.map((n) => n.y0), inM = M.map((n) => n.y0), outM = M.map((n) => n.y0);
cols[0].vals.forEach((lv, i) => {
  cols[1].vals.forEach((mv, j) => {
    const v = (lv * mv) / midTotal;
    const hl = v * L[i].k, hm = v * M[j].k;
    paths += `<path d="${ribbon(cols[0].x + nodeW, outL[i], outL[i] + hl, cols[1].x, inM[j], inM[j] + hm)}" fill="${cols[0].colors[i]}" fill-opacity="0.32"/>`;
    outL[i] += hl; inM[j] += hm;
  });
});
right.forEach((r, i) => {
  const h = r.v * M[r.from].k;
  paths += `<path d="${ribbon(cols[1].x + nodeW, outM[r.from], outM[r.from] + h, cols[2].x, R[i].y0, R[i].y1)}" fill="${cols[1].colors[r.from]}" fill-opacity="0.38"/>`;
  outM[r.from] += h;
});
let nodes = '';
cols.forEach((c, ci) => {
  const ns = ci === 0 ? L : ci === 1 ? M : R;
  ns.forEach((n, i) => { nodes += `<rect x="${c.x}" y="${n.y0}" width="${nodeW}" height="${Math.max(2, n.y1 - n.y0)}" rx="2" fill="${c.colors[i]}"/>`; });
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.paper}"/>
  <g transform="translate(72 74)">
    <rect x="0" y="0" width="64" height="64" rx="16" fill="${C.paper2}" stroke="${C.rule}" stroke-width="2"/>
    <path d="M16 14v36" stroke="${C.ink}" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M16 23c14 0 14 -5 32 -5v9.2c-17 0-17 5-32 5Z" fill="${C.clay}"/>
    <path d="M16 32.6c14 0 14 10.4 32 10.4v6c-18 0-18-10.8-32-10.8Z" fill="${C.clay}" opacity="0.55"/>
  </g>
  <text x="156" y="128" font-family="Source Serif 4" font-weight="600" font-size="70" letter-spacing="-0.7" fill="${C.ink}">Open Ledger <tspan fill="${C.clay}">MA</tspan></text>
  <text x="74" y="214" font-family="Source Serif 4" font-weight="500" font-size="46" letter-spacing="-0.46" fill="${C.ink}">The Massachusetts budget, in plain sight.</text>
  <text x="74" y="262" font-family="Helvetica Neue, Helvetica, Arial" font-weight="400" font-size="23" fill="${C.ink2}">Where state money comes from, and where it goes  ·  openledgerma.org</text>
  <line x1="72" x2="1128" y1="292" y2="292" stroke="${C.rule}" stroke-width="2"/>
  <g style="mix-blend-mode:multiply">${paths}</g>
  ${nodes}
  <line x1="72" x2="1128" y1="596" y2="596" stroke="${C.rule}" stroke-width="2"/>
</svg>`;

// resvg needs TTF/OTF; decompress the static Source Serif 4 woff2 files (dev dependency) to a temp dir.
const tmp = mkdtempSync(path.join(tmpdir(), 'og-fonts-'));
const fontFiles = [];
for (const f of [
  '@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff2',
  '@fontsource/source-serif-4/files/source-serif-4-latin-500-normal.woff2',
]) {
  const ttf = await wawoff2.decompress(readFileSync(path.join(root, 'node_modules', f)));
  const out = path.join(tmp, path.basename(f).replace('.woff2', '.ttf'));
  writeFileSync(out, ttf);
  fontFiles.push(out);
}
const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  // The small line uses the system sans (Helvetica/Arial), like the site's body text.
  font: { fontFiles, loadSystemFonts: true, defaultFontFamily: 'Helvetica' },
}).render().asPng();
rmSync(tmp, { recursive: true, force: true });
writeFileSync(path.join(root, 'public/og.png'), png);
console.log(`public/og.png ${(png.length / 1024).toFixed(1)} KB`);
