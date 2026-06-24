// ─── Implant brand catalog ───────────────────────────────────────────────────
// Reference data for the Prescription Builder's nested brand-selection tree
// (services that capture an implant system — Implant Abutment, Bridge). Each
// node has a stable `id` (path-like) so a lab's selection can be stored as a
// flat list of selected LEAF ids on the prescription `brand` field's `options`.
// Representative subset of the industry list — not exhaustive.

export interface BrandNode {
  id: string;
  name: string;
  children?: BrandNode[];
}

export const BRAND_CATALOG: BrandNode[] = [
  {
    id: 'adin', name: 'Adin',
    children: [
      {
        id: 'adin/touareg', name: 'Touareg',
        children: [
          { id: 'adin/touareg/unp', name: 'UNP' },
          { id: 'adin/touareg/np', name: 'NP' },
          { id: 'adin/touareg/rp', name: 'RP' },
          { id: 'adin/touareg/wp', name: 'WP' },
        ],
      },
    ],
  },
  { id: 'alfa-gate', name: 'Alfa Gate' },
  { id: 'alliance', name: 'Alliance' },
  { id: 'alpha-bio-tec', name: 'Alpha Bio Tec' },
  { id: 'anthogyr', name: 'Anthogyr' },
  { id: 'argon', name: 'Argon' },
  { id: 'avinent', name: 'Avinent' },
  { id: 'bb-dental', name: 'B&B Dental' },
  { id: 'bego', name: 'Bego' },
  {
    id: 'biohorizons', name: 'BioHorizons',
    children: [
      {
        id: 'biohorizons/tapered-internal', name: 'Tapered Internal',
        children: [
          { id: 'biohorizons/tapered-internal/3.0', name: '3.0' },
          { id: 'biohorizons/tapered-internal/3.4', name: '3.4' },
          { id: 'biohorizons/tapered-internal/4.6', name: '4.6' },
        ],
      },
    ],
  },
  {
    id: 'dentsply-astra', name: 'Dentsply Astra',
    children: [
      {
        id: 'dentsply-astra/osseospeed', name: 'OsseoSpeed',
        children: [
          { id: 'dentsply-astra/osseospeed/3.0s', name: '3.0 S' },
          { id: 'dentsply-astra/osseospeed/3.5-4.0', name: '3.5 / 4.0' },
          { id: 'dentsply-astra/osseospeed/4.5-5.0', name: '4.5 / 5.0' },
        ],
      },
    ],
  },
  {
    id: 'mis', name: 'MIS',
    children: [
      { id: 'mis/c1', name: 'C1' },
      { id: 'mis/seven', name: 'Seven' },
      { id: 'mis/v3', name: 'V3' },
    ],
  },
  { id: 'neodent', name: 'Neodent' },
  {
    id: 'nobel-biocare', name: 'Nobel Biocare',
    children: [
      {
        id: 'nobel-biocare/nobelactive', name: 'NobelActive',
        children: [
          { id: 'nobel-biocare/nobelactive/np', name: 'NP' },
          { id: 'nobel-biocare/nobelactive/rp', name: 'RP' },
          { id: 'nobel-biocare/nobelactive/wp', name: 'WP' },
        ],
      },
      { id: 'nobel-biocare/nobelreplace', name: 'NobelReplace' },
    ],
  },
  { id: 'osstem', name: 'Osstem' },
  {
    id: 'straumann', name: 'Straumann',
    children: [
      {
        id: 'straumann/blx', name: 'BLX',
        children: [
          { id: 'straumann/blx/3.5', name: '3.5' },
          { id: 'straumann/blx/4.0', name: '4.0' },
          { id: 'straumann/blx/4.5', name: '4.5' },
        ],
      },
      { id: 'straumann/bone-level', name: 'Bone Level' },
    ],
  },
  { id: 'zimmer-biomet', name: 'Zimmer Biomet' },
];

// Leaf ids under a node (the node itself if it has no children). The lab's
// selection is stored as a set of leaf ids; a parent is "checked" when all its
// leaves are selected and "indeterminate" when only some are.
export function leafIds(node: BrandNode): string[] {
  if (!node.children || node.children.length === 0) return [node.id];
  return node.children.flatMap(leafIds);
}

// Every leaf id in the catalog — used to seed an "all selected" default.
export const ALL_BRAND_LEAF_IDS: string[] = BRAND_CATALOG.flatMap(leafIds);
