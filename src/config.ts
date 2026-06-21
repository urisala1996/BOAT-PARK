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
// Tuned for a ~10 knot full-throttle cruise (≈122 px/s) with a weighty, inertial feel.
export const MAX_THRUST_ACCEL = 60; // forward thrust as acceleration (px/s^2)
export const REVERSE_FACTOR = 0.45; // reverse is weaker than forward
export const MOTOR_ANGLE_LIMIT = 0.6; // rad (~34deg) max outboard deflection
export const STEER_RATE = 1.8; // rad/s the wheel turns the motor
export const STEER_RETURN = 1.2; // rad/s the wheel eases back to centre when idle
export const THROTTLE_RATE = 0.8; // throttle units/s the lever moves (range -1..1)

// --- Hydrodynamics (drag) as acceleration coefficients ---
// Lateral >> forward so the hull glides ahead but resists sideways slip (carved turns).
export const DRAG_FWD_LINEAR = 0.15;
export const DRAG_FWD_QUAD = 0.0028;
export const DRAG_LAT_LINEAR = 4.0;
export const DRAG_LAT_QUAD = 0.02;
export const DRAG_ANGULAR = 2.4; // angular velocity damping

// --- Damage / life ---
export const MAX_LIFE = 100;
// Impact speed (px/s along the contact normal) below which contact is harmless,
// so careful docking never costs life (~1.2 kn).
export const DAMAGE_THRESHOLD = 30;
export const DAMAGE_SCALE = 0.6;

// --- Palette (minimalist / modern) ---
export const COLORS = {
  water: 0x4a90c2,
  waterGrid: 0x5fa0cf,
  goal: 0x8fd0a8,
  land: 0xede4d3,
  landLine: 0x1b1b1b,
  dock: 0xe2d6bf,
  obstacleHull: 0xf6f1e7,
  obstacleLine: 0x1b1b1b,
  playerHull: 0xffffff,
  playerAccent: 0xe4572e,
  line: 0x1b1b1b,
  hud: 0x1b1b1b,
  hudBg: 0xffffff,
  lifeGood: 0x4caf72,
  lifeWarn: 0xe4a72e,
  lifeBad: 0xe4572e,
} as const;
