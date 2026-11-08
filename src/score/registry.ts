/** Lets other components (the tray) ask the score where a screen point falls. */
export const scoreRegistry: {
  /** Pulse boundary under a client point, or null if outside the score. */
  slotAt: ((clientX: number, clientY: number) => number | null) | null;
} = { slotAt: null };
