#!/usr/bin/env node
// ── Generate photo-style sample prescriptions ────────────────────────────────
// Draws a paper lab prescription pad, fills it in "by hand" and "photographs"
// it on a desk (rotation, skew, shadow, uneven light, grain, crease), then
// rasterises with macOS Quick Look (WebKit, so the system handwriting fonts
// get baked in) and converts to JPEG with sips.
//
//   node "SALES Feedbacks/lab-prescription-inbox/scripts/generate-rx-photos.mjs"
//
// Output: ../assets/rx-<sample>-p<page>.jpg. All names and numbers are fictional.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../assets');
const W = 1500, H = 2000;          // photo size (portrait phone shot)
const PW = 1000, PH = 1414;        // paper (A4) in its own units

// ── Small helpers ────────────────────────────────────────────────────────────
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const PRINT = '#1d2b4f';
const RULE = '#9fb3d9';
const FONT = "Helvetica Neue, Helvetica, Arial, sans-serif";

const label = (x, y, t, size = 12, weight = 400, fill = PRINT, extra = '') =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(t)}</text>`;
const rule = (x1, y, x2) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${RULE}" stroke-width="1.2"/>`;
const box = (x, y, s = 15) => `<rect x="${x}" y="${y - s + 2}" width="${s}" height="${s}" fill="none" stroke="${PRINT}" stroke-width="1.3"/>`;
const sectionBar = (y, t) =>
  `<rect x="60" y="${y - 17}" width="${PW - 120}" height="24" fill="#e6edf8"/>${label(70, y, t, 12.5, 700)}`;

// Handwriting: pen colour, slight per-word jitter.
function makePen(rand, { color = '#1b2f80', font = 'Bradley Hand' } = {}) {
  return {
    text(x, y, t, size = 26, rot = 0, f = font) {
      const r = rot + (rand() - 0.5) * 2.2;
      return `<text x="${x}" y="${y}" font-family="${f}" font-size="${size}" fill="${color}" transform="rotate(${r.toFixed(2)} ${x} ${y})" filter="url(#ink)">${esc(t)}</text>`;
    },
    tick(x, y, s = 20) {
      const j = () => (rand() - 0.5) * 3;
      return `<path d="M${x - 2 + j()} ${y - s * 0.45} q ${s * 0.18} ${s * 0.2} ${s * 0.4} ${s * 0.55} q ${s * 0.35} ${-s * 0.9} ${s * 0.95 + j()} ${-s * 1.25}" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" filter="url(#ink)"/>`;
    },
    circle(cx, cy, rx, ry) {
      // Hand-drawn loop: wobbling radius, overshoots its start.
      const start = rand() * Math.PI * 2, pts = [];
      for (let i = 0; i <= 44; i++) {
        const a = start + (i / 40) * Math.PI * 2;
        const k = 1 + (rand() - 0.5) * 0.08 + (i > 38 ? 0.08 : 0);
        pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
      }
      return `<path d="M${pts.join(' L')}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#ink)"/>`;
    },
    strike(x1, y, x2) {
      return `<path d="M${x1} ${y + 2} L${x2} ${y - 4} M${x1 + 4} ${y - 5} L${x2 - 2} ${y + 3}" stroke="${color}" stroke-width="2.4" stroke-linecap="round" filter="url(#ink)"/>`;
    },
    underline(x1, y, x2) {
      return `<path d="M${x1} ${y} Q ${(x1 + x2) / 2} ${y + 4} ${x2} ${y - 2}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" filter="url(#ink)"/>`;
    },
    signature(x, y) {
      let d = `M${x} ${y}`;
      let cx = x;
      for (let i = 0; i < 7; i++) {
        const w = 18 + rand() * 22, h = 14 + rand() * 26;
        d += ` c ${w * 0.3} ${-h} ${w * 0.8} ${-h} ${w * 0.6} ${h * 0.4} s ${-w * 0.5} ${h * 0.6} ${w * 0.4} ${-h * 0.2}`;
        cx += w;
      }
      d += ` M${x - 6} ${y + 14} Q ${(x + cx) / 2} ${y + 4} ${cx + 30} ${y + 10}`;
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" filter="url(#ink)"/>`;
    },
    path(d, w = 2.6) {
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" filter="url(#ink)"/>`;
    },
  };
}

// Rubber practice stamp: patchy, slightly rotated.
function stamp(x, y, lines, rot = -4, color = '#8b1a3a') {
  const [name, ...rest] = lines;
  return `<g transform="rotate(${rot} ${x + 190} ${y + 50})" filter="url(#stampInk)" fill="${color}" opacity="0.9">
    <rect x="${x}" y="${y}" width="380" height="${42 + rest.length * 20}" rx="6" fill="none" stroke="${color}" stroke-width="3"/>
    <text x="${x + 190}" y="${y + 32}" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="22" letter-spacing="1">${esc(name)}</text>
    ${rest.map((l, i) => `<text x="${x + 190}" y="${y + 56 + i * 20}" text-anchor="middle" font-family="Courier New, Courier" font-weight="700" font-size="15">${esc(l)}</text>`).join('')}
  </g>`;
}

// ── The printed form (front) ─────────────────────────────────────────────────
const WORK = ['Crown', 'Bridge', 'Veneer', 'Inlay / Onlay', 'Implant crown', 'Post & core', 'Full denture', 'Partial denture', 'Night guard / splint', 'Whitening tray', 'Retainer', 'Repair / addition'];
const MATERIAL = ['Zirconia', 'E.max', 'PFM', 'Full gold', 'Composite', 'Acrylic', 'Soft EVA', 'Cr-Co'];
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const workPos = i => ({ x: 70 + (i % 3) * 300, y: 485 + Math.floor(i / 3) * 32 });
const matPos = i => ({ x: 70 + (i % 4) * 225, y: 655 + Math.floor(i / 4) * 32 });
const toothPos = n => {
  const upper = UPPER.indexOf(n);
  const i = upper >= 0 ? upper : LOWER.indexOf(n);
  return { cx: 116 + i * 48 + 24, cy: (upper >= 0 ? 806 : 852) - 12 };
};

function printedForm(serial) {
  const p = [];
  p.push(label(60, 92, 'SMILE GENIUS LAB', 30, 800, '#16224a', 'letter-spacing="2"'));
  p.push(label(60, 114, 'Dental Laboratory · Unit 4, Riverside Works, Manchester M3 4LZ', 11.5, 400, '#4a5675'));
  p.push(label(60, 130, 'Tel 0161 555 0198 · lab@smilegeniuslab.co.uk', 11.5, 400, '#4a5675'));
  p.push(label(PW - 60, 90, 'LABORATORY PRESCRIPTION', 19, 700, PRINT, 'text-anchor="end"'));
  p.push(label(PW - 60, 110, 'Work authorisation · please complete in full', 11, 400, '#4a5675', 'text-anchor="end"'));
  p.push(`<text x="${PW - 60}" y="134" text-anchor="end" font-family="Courier New, Courier" font-weight="700" font-size="17" fill="#b3261e">No. ${serial}</text>`);
  p.push(`<line x1="60" y1="150" x2="${PW - 60}" y2="150" stroke="${PRINT}" stroke-width="2"/>`);

  // Practice stamp area + patient fields
  p.push(`<rect x="60" y="170" width="420" height="190" fill="none" stroke="${RULE}" stroke-width="1.2" stroke-dasharray="5 4"/>`);
  p.push(label(70, 188, 'PRACTICE STAMP', 10.5, 700, '#4a5675'));
  const fields = [['Date sent', 200], ['Return date', 232], ['Patient', 264], ['D.O.B.', 296]];
  for (const [t, y] of fields) { p.push(label(510, y, t, 12.5)); p.push(rule(600, y + 3, PW - 60)); }
  p.push(label(510, 330, 'Gender', 12.5)); p.push(label(600, 330, 'M  /  F', 13));
  p.push(label(700, 330, 'NHS', 12.5)); p.push(box(740, 330));
  p.push(label(785, 330, 'Private', 12.5)); p.push(box(840, 330));
  p.push(label(60, 400, 'Dentist', 12.5)); p.push(rule(120, 403, 580));
  p.push(label(610, 400, 'GDC No.', 12.5)); p.push(rule(675, 403, PW - 60));

  p.push(sectionBar(450, 'WORK REQUIRED'));
  WORK.forEach((t, i) => { const { x, y } = workPos(i); p.push(box(x, y)); p.push(label(x + 24, y, t, 13)); });

  p.push(sectionBar(620, 'MATERIAL'));
  MATERIAL.forEach((t, i) => { const { x, y } = matPos(i); p.push(box(x, y)); p.push(label(x + 24, y, t, 13)); });
  p.push(label(70, 735, 'Shade', 12.5)); p.push(rule(120, 738, 260));
  p.push(label(290, 735, 'Guide:', 12.5));
  p.push(box(345, 735)); p.push(label(368, 735, 'Vita Classic', 12.5));
  p.push(box(470, 735)); p.push(label(493, 735, 'Vita 3D', 12.5));
  p.push(label(590, 735, 'Stump shade', 12.5)); p.push(rule(675, 738, PW - 60));

  p.push(sectionBar(770, 'TOOTH CHART (FDI) · circle teeth'));
  for (const [row, y] of [[UPPER, 786], [LOWER, 832]]) {
    row.forEach((n, i) => {
      const x = 116 + i * 48;
      p.push(`<rect x="${x}" y="${y}" width="48" height="40" fill="none" stroke="${RULE}" stroke-width="1"/>`);
      p.push(label(x + 24, y + 26, String(n), 13, 500, PRINT, 'text-anchor="middle"'));
    });
  }
  p.push(`<line x1="500" y1="780" x2="500" y2="878" stroke="${PRINT}" stroke-width="2.2"/>`);
  p.push(`<line x1="110" y1="828" x2="890" y2="828" stroke="${PRINT}" stroke-width="1.6"/>`);
  p.push(label(86, 812, 'R', 14, 700)); p.push(label(902, 812, 'L', 14, 700));

  p.push(sectionBar(915, 'INSTRUCTIONS'));
  p.push(`<rect x="60" y="928" width="${PW - 120}" height="164" fill="none" stroke="${RULE}" stroke-width="1.2"/>`);
  for (let y = 962; y < 1090; y += 34) p.push(rule(70, y, PW - 70));

  p.push(label(60, 1125, 'Enclosed:', 12.5, 700));
  ['Impressions', 'Bite', 'Models', 'Photos', 'Digital scan'].forEach((t, i) => {
    const x = 140 + i * 160; p.push(box(x, 1125)); p.push(label(x + 22, 1125, t, 12.5));
  });

  p.push(label(60, 1192, 'Dentist signature', 12.5)); p.push(rule(175, 1195, 620));
  p.push(label(650, 1192, 'Date', 12.5)); p.push(rule(690, 1195, PW - 60));

  p.push(`<rect x="60" y="1222" width="${PW - 120}" height="96" fill="#f1f3f7" stroke="${RULE}" stroke-width="1"/>`);
  p.push(box(75, 1250)); p.push(label(98, 1250, 'Items disinfected before dispatch', 12));
  p.push(label(420, 1250, 'LAB USE ONLY ·  Received ________   Checked ________   Batch ________', 11, 600, '#4a5675'));
  p.push(label(75, 1278, 'This prescription authorises the laboratory to manufacture a custom-made device for the named patient.', 10.5, 400, '#4a5675'));
  p.push(label(75, 1298, 'Return date is a request and is confirmed by the laboratory on receipt.', 10.5, 400, '#4a5675'));
  p.push(label(PW / 2, 1352, 'White copy: Laboratory  ·  Yellow copy: Practice', 10.5, 400, '#6b7590', 'text-anchor="middle"'));
  return p.join('\n');
}

// ── Filled-in content per sample ─────────────────────────────────────────────
const SAMPLES = {
  s1: {
    serial: '004817', seed: 11, photo: { rot: -2.4, skewX: 1.6, skewY: -0.7, scale: 1.16, dx: 10, dy: 20, desk: 'wood', light: 1, blur: 0.55 },
    fill(pen, rand) {
      return [
        stamp(80, 220, ['SMILE GENIUS MANCHESTER', '22 Deansgate, Manchester M3 2BW', 'Tel 0161 555 0142'], -5),
        pen.text(612, 196, '12/10/26'), pen.text(612, 228, '26/10/26'),
        pen.text(612, 260, 'Emily Carter', 28), pen.text(612, 292, '14/3/86'),
        pen.circle(642, 325, 13, 15), pen.tick(843, 330),
        pen.text(135, 397, 'Dr Murphy', 28), pen.text(690, 397, '84213'),
        pen.tick(workPos(0).x, workPos(0).y), pen.tick(matPos(0).x, matPos(0).y),
        pen.text(132, 732, 'A2', 28), pen.tick(348, 735),
        pen.text(690, 732, 'ND2', 22),
        pen.circle(toothPos(16).cx, toothPos(16).cy + 2, 22, 18),
        pen.text(84, 955, 'Monolithic zirconia crown UR6.', 25),
        pen.text(84, 989, 'Light occlusal contact please -', 25),
        pen.text(84, 1023, 'pt clenches. Thanks!', 25),
        pen.tick(143, 1125), pen.tick(303, 1125),
        pen.signature(200, 1188), pen.text(700, 1189, '12/10/26', 23),
        pen.tick(78, 1250),
      ].join('\n');
    },
  },
  s2: {
    serial: '004822', seed: 27, photo: { rot: 1.8, skewX: -1.2, skewY: 0.9, scale: 1.14, dx: -10, dy: 10, desk: 'wood2', light: 1.05, blur: 0.5 },
    fill(pen) {
      return [
        stamp(80, 222, ['SMILE GENIUS BIRMINGHAM 1', '9 Colmore Row, Birmingham B3 2BJ', 'Tel 0121 555 0177'], -3, '#2a3f8f'),
        pen.text(612, 196, '13/10/26'), pen.text(612, 228, '30/10 if poss.', 24),
        pen.text(612, 260, "James O'Neill", 28), pen.text(612, 292, '2/11/72'),
        pen.circle(606, 325, 14, 15), pen.tick(843, 330),
        pen.text(135, 397, 'Dr Davies', 28), pen.text(690, 397, '79502'),
        pen.tick(workPos(2).x, workPos(2).y), pen.tick(matPos(1).x, matPos(1).y),
        pen.text(128, 732, 'A1', 26), pen.strike(124, 726, 160), pen.text(172, 734, 'B1', 28),
        pen.tick(348, 735),
        pen.circle(toothPos(11).cx, toothPos(11).cy + 2, 22, 18),
        pen.circle(toothPos(21).cx, toothPos(21).cy + 2, 22, 18),
        pen.text(84, 955, '2x e.max veneers UR1 + UL1', 25),
        pen.text(84, 989, 'minimal prep. Pt wants natural,', 25),
        pen.text(84, 1023, 'not too white!  See sketch overleaf', 25),
        pen.path('M 640 1015 q 40 -6 74 2 m -12 -10 l 14 10 l -16 8'),
        pen.tick(143, 1125), pen.tick(623, 1125),
        pen.signature(205, 1190), pen.text(700, 1189, '13/10/26', 23),
        pen.tick(78, 1250),
        pen.text(860, 1395, 'PTO', 30, -6),
      ].join('\n');
    },
    // Page 2: the back of the form, with the front faintly showing through.
    back(pen) {
      const lines = [];
      lines.push(pen.text(90, 150, "James O'Neill  -  veneers UR1 / UL1", 30));
      lines.push(pen.underline(90, 162, 560));
      // Two central incisors, front view
      lines.push(pen.path('M 330 420 C 322 520 330 640 352 700 C 380 720 450 724 486 704 C 498 640 500 520 492 420 C 450 404 370 404 330 420 Z', 3));
      lines.push(pen.path('M 512 420 C 504 520 506 640 518 704 C 552 724 622 720 650 700 C 672 640 680 520 672 420 C 632 404 552 404 512 420 Z', 3));
      lines.push(pen.path('M 300 380 Q 500 440 700 380', 2.4));                          // gum line
      lines.push(pen.path('M 340 744 Q 500 770 662 744', 2.2));                          // new incisal edge
      lines.push(pen.path('M 360 650 q 10 -14 20 0 q 10 -14 20 0  M 540 650 q 10 -14 20 0 q 10 -14 20 0', 1.8)); // mamelons
      lines.push(pen.path('M 690 752 L 780 800 m -20 -2 l 20 2 l -8 -18', 2.4));
      lines.push(pen.text(790, 812, '+0.5mm', 26));
      lines.push(pen.text(780, 846, 'incisal length', 22));
      lines.push(pen.path('M 300 560 L 200 520 m 14 -4 l -14 4 l 10 12', 2.4));
      lines.push(pen.text(70, 500, 'subtle', 24));
      lines.push(pen.text(70, 530, 'mamelons', 24));
      lines.push(pen.text(90, 900, '- match translucency to 12 / 22', 26));
      lines.push(pen.text(90, 944, '- slight incisal halo, B1 body', 26));
      lines.push(pen.text(90, 988, '- keep embrasures soft, no gaps', 26));
      lines.push(pen.text(90, 1032, '- photos emailed separately', 26));
      lines.push(pen.text(90, 1110, 'Any q\'s call me on 0121 555 0177', 24));
      lines.push(pen.text(640, 1210, 'Dr D.', 34, -4));
      lines.push(pen.underline(636, 1222, 760));
      return lines.join('\n');
    },
  },
  s3: {
    serial: '004809', seed: 43, photo: { rot: -4.5, skewX: 3.2, skewY: -1.6, scale: 1.08, dx: 30, dy: 40, desk: 'grey', light: 0.82, blur: 0.9 },
    fill(pen) {
      return [
        stamp(80, 220, ['SMILE GENIUS LEEDS', '41 Park Row, Leeds LS1 5JL', 'Tel 0113 555 0123'], -7, '#6a1b6e'),
        pen.text(612, 196, '11/10'), pen.text(612, 228, 'no rush', 26),
        pen.text(612, 260, 'Margaret Hughes', 27), pen.text(612, 292, '30/7/51'),
        pen.circle(642, 325, 13, 15), pen.tick(843, 330),
        pen.text(135, 397, 'Dr Foster', 28), pen.text(690, 397, '66120'),
        pen.tick(workPos(8).x, workPos(8).y), pen.tick(matPos(6).x, matPos(6).y),
        pen.text(132, 732, 'clear', 26),
        ...[16, 17, 26, 27].map(n => pen.circle(toothPos(n).cx, toothPos(n).cy + 2, 21, 17)),
        pen.text(730, 772, 'U arch', 24, -3),
        pen.text(84, 955, 'Upper soft splint 2mm, full coverage.', 25),
        pen.text(84, 989, 'Pt grinds at night. Upper imp + bite', 25),
        pen.text(84, 1023, 'enclosed.', 25),
        pen.tick(143, 1125), pen.tick(303, 1125),
        pen.signature(200, 1189), pen.text(700, 1189, '11/10/26', 23),
      ].join('\n');
    },
  },
};

// ── Photo composition ────────────────────────────────────────────────────────
function defs(seed, desk) {
  const deskFill = {
    wood:  { base: '#6e5039', m: '0 0 0 0 0.46  0 0 0 0 0.32  0 0 0 0 0.21  0 0 0 0.85 0', f: '0.0035 0.085' },
    wood2: { base: '#7a5a3f', m: '0 0 0 0 0.52  0 0 0 0 0.37  0 0 0 0 0.25  0 0 0 0.8 0', f: '0.003 0.07' },
    grey:  { base: '#7d8087', m: '0 0 0 0 0.55  0 0 0 0 0.56  0 0 0 0 0.58  0 0 0 0.5 0', f: '0.6 0.6' },
  }[desk];
  return { deskFill, svg: `
  <defs>
    <filter id="desk" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${deskFill.f}" numOctaves="4" seed="${seed}"/><feColorMatrix values="${deskFill.m}"/></filter>
    <filter id="paperGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed + 1}"/><feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.33  0 0 0 0 0.3  0 0 0 0.09 0"/></filter>
    <filter id="sensor" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="${seed + 2}"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.07 0"/></filter>
    <filter id="ink" x="-5%" y="-20%" width="110%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="${seed + 3}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" result="d"/><feGaussianBlur in="d" stdDeviation="0.35"/></filter>
    <filter id="stampInk" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="${seed + 4}" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.2" result="mask"/><feComposite in="SourceGraphic" in2="mask" operator="in" result="patchy"/><feGaussianBlur in="patchy" stdDeviation="0.6"/></filter>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="22"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="BLUR"/></filter>
    <filter id="ghost"><feGaussianBlur stdDeviation="1.6"/></filter>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.26"/></linearGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.48" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient>
    <linearGradient id="crease" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="0.45" stop-color="#000" stop-opacity="0.08"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="paperTone" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="#fbf9f3"/><stop offset="1" stop-color="#efeadf"/></linearGradient>
  </defs>` };
}

function photo(sampleId, pageContent, opts) {
  const { rot, skewX, skewY, scale, dx, dy, desk, light, blur } = opts;
  const { deskFill, svg: d } = defs(SAMPLES[sampleId].seed + (opts.pageSeed ?? 0), desk);
  const paperT = `translate(${W / 2 + dx} ${H / 2 + dy}) rotate(${rot}) skewX(${skewX}) skewY(${skewY}) scale(${scale}) translate(${-PW / 2} ${-PH / 2})`;
  // Square 1:1 canvas with the photo centred: Quick Look renders square
  // thumbnails and sips crops from the centre back to W×H.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${H}" height="${H}" viewBox="0 0 ${H} ${H}">
  <clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath>
  <g transform="translate(${(H - W) / 2} 0)">
  ${d.replace('BLUR', String(blur))}
  <g clip-path="url(#frame)"><g filter="url(#soft)">
    <rect width="${W}" height="${H}" fill="${deskFill.base}"/>
    <rect width="${W}" height="${H}" filter="url(#desk)"/>
    <g transform="${paperT}">
      <rect x="14" y="26" width="${PW}" height="${PH}" fill="#000" opacity="0.55" filter="url(#shadow)"/>
      <rect width="${PW}" height="${PH}" fill="url(#paperTone)"/>
      ${pageContent}
      <rect width="${PW}" height="${PH}" filter="url(#paperGrain)"/>
      <rect y="${PH / 2 - 22}" width="${PW}" height="44" fill="url(#crease)"/>
    </g>
    <rect width="${W}" height="${H}" fill="#000" opacity="${(1 - light).toFixed(2)}"/>
    <rect width="${W}" height="${H}" fill="url(#light)"/>
    <rect width="${W}" height="${H}" fill="url(#vignette)"/>
    <rect width="${W}" height="${H}" filter="url(#sensor)"/>
  </g></g></g>
</svg>`;
}

// ── Build ────────────────────────────────────────────────────────────────────
const tmp = mkdtempSync(path.join(tmpdir(), 'rx-photos-'));
mkdirSync(outDir, { recursive: true });

function render(name, svg) {
  const svgPath = path.join(tmp, `${name}.svg`);
  writeFileSync(svgPath, svg);
  execFileSync('qlmanage', ['-t', '-s', String(H), '-o', tmp, svgPath], { stdio: 'ignore' });
  const png = path.join(tmp, `${name}.svg.png`);
  // Quick Look renders a square; sips crops the centred W×H portrait out of it.
  execFileSync('sips', ['-c', String(H), String(W), png], { stdio: 'ignore' });
  const jpg = path.join(outDir, `${name}.jpg`);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '78', png, '--out', jpg], { stdio: 'ignore' });
  console.log('wrote', path.relative(process.cwd(), jpg));
}

for (const [id, s] of Object.entries(SAMPLES)) {
  const pen = makePen(rng(s.seed));
  const front = printedForm(s.serial) + '\n' + s.fill(pen, rng(s.seed + 9));
  render(`rx-${id}-p1`, photo(id, front, s.photo));
  if (s.back) {
    const backPen = makePen(rng(s.seed + 5));
    // Reverse side: plain paper, the printed front faintly mirrored through it.
    const ghost = `<g transform="translate(${PW} 0) scale(-1 1)" opacity="0.06" filter="url(#ghost)">${printedForm(s.serial)}</g>`;
    const opts = { ...s.photo, rot: -1.2, skewX: 1.4, skewY: -0.5, dx: 14, dy: -6, pageSeed: 3 };
    render(`rx-${id}-p2`, photo(id, ghost + '\n' + s.back(backPen), opts));
  }
}

rmSync(tmp, { recursive: true, force: true });
console.log('done:', readdirSync(outDir).filter(f => f.endsWith('.jpg')).join(', '));
