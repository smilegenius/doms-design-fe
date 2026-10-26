// ─── New Case Flow · how much room a step has ────────────────────────────────
// The same step screens render in Guided's big card and Conversation's column
// ('wide': icon headings, bigger cards, the whole picture) and inside One
// page's inline rows ('compact': the plain settled rows and chips).

import { createContext, useContext } from 'react';

export type Room = 'wide' | 'compact';
const RoomContext = createContext<Room>('compact');
export const RoomProvider = RoomContext.Provider;
export const useRoom = () => useContext(RoomContext);

/**
 * Teeth count as answered as they're tapped (no "Done" to confirm them), and the step stays put while you
 * pick several. On in Guided's service card, where the chart stays in view beside the other items.
 */
export const LiveTeethContext = createContext(false);

/** The width (px) of the column an editor sits in when it's narrower than the step: Guided's side column. */
export const ColumnWidthContext = createContext<number | undefined>(undefined);

/** The widest a step's Teeth Chart is drawn (px): the horizontal chart fills its step up to this. */
export const ChartWidthContext = createContext<number | undefined>(undefined);
