import type { Level } from "./types.ts";

// Default marina level. All units are metres. The player starts bow-out in a finger-dock
// slip surrounded by parked boats, weaves past a breakwater across open water (dodging
// moored craft of varied, realistic sizes), and docks in the seaport pocket on the right.
//
// Future levels can be added as JSON files matching the `Level` shape and loaded the same way.
export const level1: Level = {
  name: "Old Marina",
  bounds: { w: 130, h: 80 },

  spawn: { x: 11, y: 23, angle: 0 }, // middle slip, bow toward open water (+x)

  goal: { x: 116, y: 42, w: 18, h: 20 }, // seaport pocket on the right

  walls: [
    // --- perimeter land ---
    { x: 65, y: 2, w: 130, h: 4, kind: "land" },
    { x: 65, y: 78, w: 130, h: 4, kind: "land" },
    { x: 2, y: 40, w: 4, h: 80, kind: "land" },
    { x: 128, y: 40, w: 4, h: 80, kind: "land" },

    // --- finger docks (form five slips between them) ---
    { x: 11, y: 8, w: 10, h: 1.2, kind: "dock" },
    { x: 11, y: 14, w: 10, h: 1.2, kind: "dock" },
    { x: 11, y: 20, w: 10, h: 1.2, kind: "dock" },
    { x: 11, y: 26, w: 10, h: 1.2, kind: "dock" },
    { x: 11, y: 32, w: 10, h: 1.2, kind: "dock" },
    { x: 11, y: 38, w: 10, h: 1.2, kind: "dock" },

    // --- breakwater with a gap at the bottom ---
    { x: 68, y: 17, w: 2, h: 30, kind: "land" },

    // --- seaport piers framing the goal pocket ---
    { x: 112, y: 30, w: 18, h: 2, kind: "dock" },
    { x: 112, y: 54, w: 18, h: 2, kind: "dock" },
  ],

  boats: [
    // parked neighbours in the marina slips (similar 4.5-6 m craft)
    { x: 11, y: 11, angle: 0, length: 6.0, beam: 2.3 },
    { x: 11, y: 17, angle: 0, length: 4.6, beam: 1.9 },
    { x: 11, y: 29, angle: 0, length: 5.2, beam: 2.0 },
    { x: 11, y: 35, angle: 0, length: 5.8, beam: 2.2 },

    // moored / drifting craft of varied realistic sizes across the open water
    { x: 40, y: 30, angle: 0.3, length: 7.0, beam: 2.6 },
    { x: 48, y: 12, angle: -0.2, length: 3.2, beam: 1.3 },
    { x: 55, y: 55, angle: -0.4, length: 4.0, beam: 1.6 },
    { x: 72, y: 50, angle: 1.2, length: 8.5, beam: 3.0 },
    { x: 90, y: 25, angle: 2.6, length: 5.0, beam: 2.0 },
    { x: 100, y: 60, angle: 0.8, length: 6.5, beam: 2.4 },
  ],
};
