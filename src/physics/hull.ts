// Boat hull geometry. Produces a convex, top-down hull outline centred on the origin,
// pointing along +x (bow at +x, transom/stern at -x). Used both for the Matter collision
// body and the rendered shape so physics and visuals match exactly.

export interface Vec {
  x: number;
  y: number;
}

// length and beam in pixels.
export function hullVertices(length: number, beam: number): Vec[] {
  const L = length / 2;
  const B = beam / 2;
  // A pointed bow, parallel mid-body, slightly narrowed transom — convex on purpose so
  // Matter does not need concave decomposition.
  return [
    { x: L, y: 0 }, // bow tip
    { x: L - length * 0.3, y: B }, // bow shoulder (starboard)
    { x: -L + length * 0.06, y: B }, // aft (starboard)
    { x: -L, y: B * 0.72 }, // transom corner (starboard)
    { x: -L, y: -B * 0.72 }, // transom corner (port)
    { x: -L + length * 0.06, y: -B }, // aft (port)
    { x: L - length * 0.3, y: -B }, // bow shoulder (port)
  ];
}

export const STERN_LOCAL = (length: number): Vec => ({ x: -length / 2, y: 0 });
