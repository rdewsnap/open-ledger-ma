// Renders public/og.png (1200×630) from an authored SVG. Run: pnpm og
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import wawoff2 from 'wawoff2';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = {
  paper: '#FAFAF7', paper2: '#EFF1F2', rule: '#D5D9DE', ink: '#1C2433', ink2: '#576174',
  brick: '#A8322D', navy: '#1F3A68', red: '#D2463E', slate: '#5E6673', blue1: '#4D6A96', blue2: '#8EA4C3', blue3: '#C9D4E4',
};

// --- tiny sankey: 3 columns, proportional links (illustrative shape only) ---
const W = 1200, H = 630;
const top = 318, bottom = 572, nodeW = 12, pad = 9;
const cols = [
  { x: 72, vals: [30, 17, 8, 7, 6, 4, 3], colors: ['#5E6673', '#707784', '#838995', '#969BA5', '#A9ADB5', '#BBBFC6', '#CDD1D7'] },
  { x: 588, vals: [35, 13, 7, 5, 3, 2, 2, 1.6, 1.4], colors: [C.navy, '#365280', C.blue1, '#6E87AD', C.blue2, '#A3B5CF', '#B3C2D8', '#BECBDE', C.blue3] },
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
  <g transform="translate(66 66) scale(2.25)">
    <path d="M4.5 3h23v12.6c0 7.4-5.3 11.6-11.5 13.6C9.8 27.2 4.5 23 4.5 15.6Z" fill="${C.navy}"/>
    <rect x="9.5" y="8.6" width="13" height="2.8" rx="0.6" fill="${C.red}"/>
    <rect x="9.5" y="13.8" width="10" height="2.8" rx="0.6" fill="${C.paper}"/>
    <rect x="9.5" y="19" width="6.5" height="2.8" rx="0.6" fill="${C.paper}"/>
  </g>
  <text x="158" y="128" font-family="Libre Caslon Text" font-weight="700" font-size="66" fill="${C.ink}">Open Ledger <tspan fill="${C.brick}">MA</tspan></text>
  <text x="72" y="212" font-family="Libre Caslon Text" font-weight="400" font-size="44" fill="${C.ink}">The Massachusetts budget, in plain sight.</text>
  <text x="74" y="262" font-family="Public Sans, Public Sans Thin" font-weight="400" font-size="23" fill="${C.ink2}">Where state money comes from, and where it goes  ·  openledgerma.org</text>
  <line x1="72" x2="1128" y1="292" y2="292" stroke="${C.rule}" stroke-width="2"/>
  <g style="mix-blend-mode:multiply">${paths}</g>
  ${nodes}
  <line x1="72" x2="1128" y1="596" y2="596" stroke="${C.rule}" stroke-width="2"/>
</svg>`;

// resvg needs TTF/OTF; decompress the woff2 files to a temp dir. (Fontsource's static
// Public Sans 400 subset carries the family name "Public Sans Thin"; its glyphs are 400.)
const tmp = mkdtempSync(path.join(tmpdir(), 'og-fonts-'));
const fontFiles = [];
for (const f of [
  'public/fonts/libre-caslon-text-latin-700-normal.woff2',
  'public/fonts/libre-caslon-text-latin-400-normal.woff2',
  'node_modules/@fontsource/public-sans/files/public-sans-latin-400-normal.woff2',
]) {
  const ttf = await wawoff2.decompress(readFileSync(path.join(root, f)));
  const out = path.join(tmp, path.basename(f).replace('.woff2', '.ttf'));
  writeFileSync(out, ttf);
  fontFiles.push(out);
}
const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Public Sans Thin' },
}).render().asPng();
rmSync(tmp, { recursive: true, force: true });
writeFileSync(path.join(root, 'public/og.png'), png);
console.log(`public/og.png ${(png.length / 1024).toFixed(1)} KB`);
