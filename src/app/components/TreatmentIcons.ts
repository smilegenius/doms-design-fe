// ─── Treatment icons ─────────────────────────────────────────────────────────
// Line icons that draw the dental work itself (a crown on a tooth, an implant
// screw, a bridge, a denture…) instead of generic symbols. Built with lucide's
// createLucideIcon, so they take the same props as every other icon in the app
// (className, strokeWidth, aria-*) and sit on the same 24px grid. Used by the
// New Case flow (web) and Smile Genius Go (mobile) through PRODUCT_ICON.
import { createLucideIcon } from 'lucide-react';

// A molar seen from the side: cusps on top, two roots.
const MOLAR = 'M8 3C5.5 3 4 5 4 7.5c0 2.8 1.3 4.5 1.9 6.9.5 2.1.9 4.3 1.5 6.2.3.9 1.5.9 1.8 0l1.2-4c.3-1 2.9-1 3.2 0l1.2 4c.3.9 1.5.9 1.8 0 .6-1.9 1-4.1 1.5-6.2.6-2.4 1.9-4.1 1.9-6.9C20 5 18.5 3 16 3c-1.6 0-2.6.8-4 .8S9.6 3 8 3Z';
// A dental tray (night guard, whitening tray) from above: a horseshoe with a wall.
const TRAY_OUTER = 'M2.5 7c0 8 3 14 7 14s7-6 7-14';
const TRAY_INNER = 'M6 7c0 5.6 1.5 10.5 3.5 10.5S13 12.6 13 7';
const TRAY_ENDS = 'M2.5 7H6M13 7h3.5';

/** Crown — a cap seated on the tooth, its margin marked across the crown. */
export const ToothCrown = createLucideIcon('ToothCrown', [
  ['path', { d: MOLAR, key: 'tooth' }],
  ['path', { d: 'M5.2 11.2c2 .7 4.3 1 6.8 1s4.8-.3 6.8-1', key: 'margin' }],
]);

/** Implant — crown on an abutment on a threaded screw. */
export const ToothImplant = createLucideIcon('ToothImplant', [
  ['path', { d: 'M8 2.5c-1.9 0-3.5 1.4-3.5 3.3 0 1.4.6 2.6 1.4 3.4h12.2c.8-.8 1.4-2 1.4-3.4 0-1.9-1.6-3.3-3.5-3.3-1.5 0-2.5.6-4 .6s-2.5-.6-4-.6Z', key: 'crown' }],
  ['path', { d: 'M10 9.2v2.3h4V9.2', key: 'abutment' }],
  ['path', { d: 'M8.8 11.5h6.4l-.9 8.6c-.1.9-1 1.4-2.3 1.4s-2.2-.5-2.3-1.4Z', key: 'screw' }],
  ['path', { d: 'M8.4 14.5h7.2', key: 't1' }],
  ['path', { d: 'M8.8 17.5h6.4', key: 't2' }],
]);

/** Veneer — a front tooth with a thin shell fitted over its face. */
export const ToothVeneer = createLucideIcon('ToothVeneer', [
  ['path', { d: 'M8 5.5h8c.8 0 1.4.7 1.3 1.5-.3 3-1 5.8-2.3 8.1l-1.4 5.3c-.4 1.5-2.8 1.5-3.2 0L9 15.1C7.7 12.8 7 10 6.7 7c-.1-.8.5-1.5 1.3-1.5Z', key: 'tooth' }],
  ['path', { d: 'M5.4 12.2C4.7 10.3 4.4 8.2 4.4 5.8c0-1.9 1.5-3.3 3.3-3.3h8.6c1.8 0 3.3 1.4 3.3 3.3 0 2.4-.3 4.5-1 6.4', key: 'shell' }],
]);

/** Inlay / onlay — a block fitted into the biting surface. */
export const ToothInlay = createLucideIcon('ToothInlay', [
  ['path', { d: MOLAR, key: 'tooth' }],
  ['path', { d: 'M9 5.6 10 10h4l1-4.4', key: 'inlay' }],
]);

/** Bridge — two crowned abutment teeth carrying a pontic between them. */
export const ToothBridge = createLucideIcon('ToothBridge', [
  ['path', { d: 'M2.5 7.5C2.5 5.6 3.9 4 5.8 4c1 0 1.6.5 2.2.5S9.2 4 10.2 4h3.6c1 0 1.6.5 2.2.5s1.2-.5 2.2-.5c1.9 0 3.3 1.6 3.3 3.5 0 1.9-.8 3-1 4.5H3.5c-.2-1.5-1-2.6-1-4.5Z', key: 'crowns' }],
  ['path', { d: 'M8.5 4.6V12', key: 'j1' }],
  ['path', { d: 'M15.5 4.6V12', key: 'j2' }],
  ['path', { d: 'M4.3 12l.8 7.4c.2 1.3 1.6 1.3 1.8 0l.8-7.4', key: 'root1' }],
  ['path', { d: 'M16.3 12l.8 7.4c.2 1.3 1.6 1.3 1.8 0l.8-7.4', key: 'root2' }],
  ['path', { d: 'M8.5 12c0 2 1.6 3.3 3.5 3.3s3.5-1.3 3.5-3.3', key: 'pontic' }],
]);

/** Full denture — a gum base carrying a full row of teeth. */
export const Denture = createLucideIcon('Denture', [
  ['path', { d: 'M3 9V8c0-2.2 1.8-4 4-4h10c2.2 0 4 1.8 4 4v1Z', key: 'gum' }],
  ['path', { d: 'M3 9v3.5a2 2 0 0 0 4.5 0V9', key: 'a' }],
  ['path', { d: 'M7.5 9v4.5a2.25 2.25 0 0 0 4.5 0V9', key: 'b' }],
  ['path', { d: 'M12 9v4.5a2.25 2.25 0 0 0 4.5 0V9', key: 'c' }],
  ['path', { d: 'M16.5 9v3.5a2 2 0 0 0 4.5 0V9', key: 'd' }],
]);

/** Partial denture — the denture's row with a gap: two saddles of teeth joined by a metal bar. */
export const DenturePartial = createLucideIcon('DenturePartial', [
  ['path', { d: 'M3 9V8c0-2.2 1.8-4 4-4h2v5Z', key: 'gumL' }],
  ['path', { d: 'M15 4h2c2.2 0 4 1.8 4 4v1h-6Z', key: 'gumR' }],
  ['path', { d: 'M3 9v3.5a1.5 1.5 0 0 0 3 0V9', key: 'a' }],
  ['path', { d: 'M6 9v4a1.5 1.5 0 0 0 3 0V9', key: 'b' }],
  ['path', { d: 'M15 9v4a1.5 1.5 0 0 0 3 0V9', key: 'c' }],
  ['path', { d: 'M18 9v3.5a1.5 1.5 0 0 0 3 0V9', key: 'd' }],
  ['path', { d: 'M9 5.5h6', key: 'bar' }],
]);

/** Reline — a denture base taking a new fitting layer. */
export const DentureReline = createLucideIcon('DentureReline', [
  ['path', { d: 'M2.5 13c0-4.4 4.3-8 9.5-8s9.5 3.6 9.5 8Z', key: 'base' }],
  ['path', { d: 'M6 13c0-2.5 2.7-4.6 6-4.6s6 2.1 6 4.6', key: 'lining' }],
  ['path', { d: 'M12 16v5', key: 'arrow' }],
  ['path', { d: 'm9.8 18.8 2.2 2.2 2.2-2.2', key: 'head' }],
]);

/** Retainer — a wire bow round the arch with a clasp at each end. */
export const Retainer = createLucideIcon('Retainer', [
  ['path', { d: 'M5 7c0 7.2 3 12.5 7 12.5S19 14.2 19 7', key: 'bow' }],
  ['path', { d: 'M8.5 7c0 4.6 1.6 8 3.5 8s3.5-3.4 3.5-8', key: 'plate' }],
  ['circle', { cx: '5', cy: '5', r: '2', key: 'claspL' }],
  ['circle', { cx: '19', cy: '5', r: '2', key: 'claspR' }],
]);

/** Clear aligner — a thin shell over a row of teeth. */
export const Aligner = createLucideIcon('Aligner', [
  ['path', { d: 'M2.5 9.5C2.5 7.6 4 6 6 6h12c2 0 3.5 1.6 3.5 3.5V12c0 3.6-2.9 6.5-6.5 6.5H9c-3.6 0-6.5-2.9-6.5-6.5Z', key: 'shell' }],
  ['path', { d: 'M5.5 9.5c0-.8.7-1.5 1.5-1.5h10c.8 0 1.5.7 1.5 1.5v2.3c0 2.3-1.9 4.2-4.2 4.2H9.7c-2.3 0-4.2-1.9-4.2-4.2Z', key: 'teeth' }],
  ['path', { d: 'M9.5 8v8', key: 's1' }],
  ['path', { d: 'M14.5 8v8', key: 's2' }],
]);

/** Night guard / splint — a tray over the arch, with a moon: worn at night. */
export const NightGuard = createLucideIcon('NightGuard', [
  ['path', { d: TRAY_OUTER, key: 'outer' }],
  ['path', { d: TRAY_INNER, key: 'inner' }],
  ['path', { d: TRAY_ENDS, key: 'ends' }],
  ['path', { d: 'M20 1.8a3 3 0 1 0 2 4.6A2.4 2.4 0 0 1 20 1.8Z', key: 'moon' }],
]);

/** Whitening tray — a tray over the arch with a sparkle. */
export const WhiteningTray = createLucideIcon('WhiteningTray', [
  ['path', { d: TRAY_OUTER, key: 'outer' }],
  ['path', { d: TRAY_INNER, key: 'inner' }],
  ['path', { d: TRAY_ENDS, key: 'ends' }],
  ['path', { d: 'M19.5 1.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9Z', key: 'sparkle' }],
]);

/** Other — a tooth with a plus: any work not in the list. */
export const ToothOther = createLucideIcon('ToothOther', [
  ['path', { d: MOLAR, key: 'tooth' }],
  ['path', { d: 'M12 6.5v5', key: 'v' }],
  ['path', { d: 'M9.5 9h5', key: 'h' }],
]);
