// Central tuning constants. Physics runs in PIXEL units; meters are converted via
// PIXELS_PER_METER. Most force/drag values are acceleration scales (force is applied as
// mass * accel so behaviour is independent of a body's mass) and were chosen for feel —
// tweak freely while play-testing.

export const PIXELS_PER_METER = 24;
export const m = (meters: number) => meters * PIXELS_PER_METER;

// Fixed physics timestep.
export const FIXED_STEP_MS = 1000 / 60;

// --- Player boat (meters) ---
export const BOAT_LENGTH_M = 5;
export const BOAT_BEAM_M = 1.9;

// --- Engine / controls ---
// Punchy, planing-boat feel: a strong shove on the throttle (~0.6 g), a helm you can
// throw hard over (~47deg) and snap quickly, and ~17 kn full-ahead. The outboard sits
// aft of the transom, so vectored thrust there yaws the boat hard — gassing with the
// wheel over pivots the stern out (directed-thrust / prop-walk feel).
export const MAX_THRUST_ACCEL = 200; // forward thrust as acceleration (px/s^2) — strong, agile
export const REVERSE_FACTOR = 0.5; // reverse is weaker than forward
export const MOTOR_ANGLE_LIMIT = 0.82; // rad (~47deg) max outboard deflection
export const OUTBOARD_OFFSET_M = 0.35; // motor mounted behind the transom (longer lever arm)
export const STEER_RATE = 3.2; // rad/s the wheel turns the motor (snappy)
export const STEER_RETURN = 2.4; // rad/s the wheel eases back to centre when idle
export const THROTTLE_RATE = 3.0; // throttle units/s — fast enough to "slam" the gas

// --- Hydrodynamics (drag) as acceleration coefficients ---
// Low LINEAR forward drag so the hull glides a long way when you back off the gas (inertia);
// QUADRATIC drag still caps top speed (~19 kn). Lateral >> forward so it tracks and carves,
// but not absolute, so the stern can break loose in hard turns.
export const DRAG_FWD_LINEAR = 0.05;
export const DRAG_FWD_QUAD = 0.0032;
export const DRAG_LAT_LINEAR = 2.6;
export const DRAG_LAT_QUAD = 0.016;
export const DRAG_ANGULAR = 3.4; // angular velocity damping (keeps the strong yaw controllable)

// --- Damage / life ---
export const MAX_LIFE = 100;
// Impact speed (px/s along the contact normal) below which contact is harmless, so careful
// docking never costs life (~1.8 kn). Scale eased a touch since cruise speeds are higher now.
export const DAMAGE_THRESHOLD = 45;
export const DAMAGE_SCALE = 0.4;

// --- Palette (minimalist / modern) ---
export const COLORS = {
  water: 0x5aa7d8,
  waterTop: "#7cbce8",
  waterBottom: "#4f9bd0",
  waterGrid: 0x8cc6ec,
  foam: 0xffffff,
  goal: 0x2ec4b6,
  goalSoft: 0x9fe3da,
  land: 0xf0e7d6,
  landLine: 0x18242b,
  dock: 0xe4d8c0,
  obstacleHull: 0xf7f2e9,
  obstacleLine: 0x18242b,
  playerHull: 0xffffff,
  playerAccent: 0xe4572e,
  playerAccent2: 0xf3a712,
  line: 0x18242b,
  shadow: 0x0c2230,
  // HUD
  hud: 0x18242b,
  hudMuted: 0x6b8290,
  panel: 0xffffff,
  panelLine: 0x18242b,
  lifeGood: 0x2fb673,
  lifeWarn: 0xf3a712,
  lifeBad: 0xe4572e,
  // navigation marks (red to port, green to starboard, entering harbour)
  buoyPort: 0xd64545,
  buoyStbd: 0x3fa34d,
} as const;
