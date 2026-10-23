// ─── New Case Flow · how much room a step has ────────────────────────────────
// The same step screens render in Guided's big card and Conversation's column
// ('wide': icon headings, bigger cards, the whole picture) and inside One
// page's inline rows ('compact': the plain settled rows and chips).

import { createContext, useContext } from 'react';

export type Room = 'wide' | 'compact';
const RoomContext = createContext<Room>('compact');
export const RoomProvider = RoomContext.Provider;
export const useRoom = () => useContext(RoomContext);

/** The widest a step's Teeth Chart is drawn (px): the horizontal chart fills its step up to this. */
export const ChartWidthContext = createContext<number | undefined>(undefined);
