# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Parking Boat" — a 2D top-down browser game. The player maneuvers a 5 m single-outboard motorboat
out of a marina slip, across open water, and into a seaport without draining its hull life bar on
collisions. The focus is **realistic, precise boat physics** with a minimalist visual style.

## Commands

```bash
npm run dev        # Vite dev server at http://localhost:5173/BOAT-PARK/  (note the base path!)
npm run build      # tsc type-check + vite production build -> dist/
npm run preview    # serve the production build locally
```

There is no test suite. Verify changes by running `npm run dev` and play-testing.
The dev/preview URL is served under `/BOAT-PARK/` because of the GitHub Pages `base` (see Deploy).

## Architecture

The core idea: **Matter.js integrates motion and resolves collisions, but does NOT define the boat's
feel.** Each fixed step we compute our own thrust + hydrodynamic forces and inject them, so Matter's
hard-to-tune internal force units are bypassed entirely.

Flow per fixed step (`core/Game.ts` → `core/GameLoop.ts`, fixed 60 Hz accumulator):
1. `input/controls.ts` reads keyboard into an `InputState`; `input/pointer.ts` adds
   touch/mouse drag on the HUD gauges, producing ABSOLUTE values (`steerSet`/`throttleSet`)
   that override the keyboard when active. `Game.update` merges them.
2. `physics/Boat.ts` updates motor angle / throttle, then computes:
   - **Thrust**: a force at the stern (`physics/hull.ts` `STERN_LOCAL`) aimed along `bodyAngle +
     motorAngle`. Because it acts off the centre of mass, the offset *itself* produces the steering
     torque — and the response naturally inverts in reverse, like a real outboard.
   - **Drag** (`physics/hydro.ts`): ANISOTROPIC — lateral resistance ≫ forward, which is what makes
     the hull glide ahead, resist sideways slip, and carve turns. Plus angular damping.
3. `physics/integrator.ts` `applyWrench` converts the summed force/torque into velocity changes
   (working in per-second units; Matter stores velocity per-step, hence the ×60 / ÷60 conversions).
4. `physics/world.ts` steps the engine (zero gravity; the boat has `frictionAir = 0` so WE own all
   damping).
5. `physics/collision.ts` turns Matter `collisionStart` events into gameplay: the goal sensor wins;
   wall/boat impacts cost life proportional to closing speed along the contact normal (gentle docking
   below `DAMAGE_THRESHOLD` is free).

Rendering is separate from simulation. `render/Renderer.ts` owns the PixiJS app and two layers: a
camera-transformed `world` (follows the boat, clamped to bounds) and a fixed `hud`. `render/views.ts`
builds vector Graphics that **reuse the exact hull geometry from `physics/hull.ts`**, so visuals and
collision shapes always match; it also adds drop shadows, a water gradient, the animated goal zone,
and harbour buoys. `render/wake.ts` is a fading foam ribbon trailing the stern (world layer, under
the boat). `render/hud.ts` redraws everything in the fixed overlay each frame from a single
`HudFrame`: vignette, hull panel, speedometer, objective banner + off-screen goal arrow, the
throttle/helm gauges (which double as touch controls), and the start / win / lose cards.

Game flow has four states (`state/GameState.ts`): `ready` (title card; any input or tap starts and
the run timer begins) → `playing` → `won` / `lost` (card with stats + restart). `Game` drives the
state transitions, the wake, the animated goal, and computes the goal's screen position for the arrow.

### Key conventions
- **Units**: gameplay data (`level/`) is authored in METRES; everything physics/render works in
  PIXELS via `PIXELS_PER_METER` in `config.ts`. Convert at the boundary (`entities/bodies.ts`,
  `render/views.ts`).
- **Screen size**: use `Renderer.width`/`height` (logical CSS pixels via `app.screen`) for HUD
  layout and hit-testing — NOT `renderer.width/resolution`, which breaks on high-DPI phones.
  `render/hudLayout.ts` is the single source of gauge positions, shared by the HUD and touch
  hit-areas so they always align.
- **Tuning lives in one place**: `config.ts` holds every physics/feel constant (thrust, drag
  coefficients, steering rates, damage). Tune the game here, not scattered through modules. Current
  values give a punchy planing feel: ~17 kn top speed, ~0.6 g throttle shove, ~47° helm / ~85°/s
  turn at cruise, and a strong gas-with-helm pivot (the outboard sits aft of the transom via
  `OUTBOARD_OFFSET_M` for a longer yaw lever arm).
- **Steering sign**: positive `motorAngle` turns the bow to port; `D`/right deflects it negative.
  This is derived in `Boat.update` — keep the HUD wheel rotation and physics consistent if changed.
- **Levels are plain data** (`level/types.ts` `Level`, all metres). `level/level1.ts` is the built-in
  marina; `Game.build()` instantiates whatever `Level` it's handed. Custom levels persist in
  `localStorage` via `level/storage.ts` (named levels + a "current" working level).

### Modes (`core/App.ts`)
`App` owns the renderer and swaps between **Play** (`Game`) and **Edit** (`editor/Editor.ts`); both
implement `dispose()` so switching cleanly tears down ticker callbacks, stage listeners, and layers.
The bottom "✎ Editor" button enters the editor; the editor's "▶ Play" returns. The app boots into
the saved current level if present, else the built-in marina.

### Level editor (`editor/Editor.ts`)
A single module: renders the editable level into `renderer.world` (rebuilt on each change, reusing
the `render/views.ts` builders) with its own pan/zoom camera, and overlays plain-DOM tools + a
properties panel. You can trace a loaded map image (faint underlay, set its width in metres),
draw docks/land/goal by drag, click-place boats and the start slip, select/move objects, fine-tune
via the panel, grid-snap, and save / load / import / export JSON. It autosaves to `localStorage`.

## Deploy

GitHub Actions (`.github/workflows/deploy.yml`) builds and publishes `dist/` to GitHub Pages on push
to `main`. **`vite.config.ts` sets `base: '/BOAT-PARK/'`** to match the repo name — if the repo is
renamed, update `base` or all asset URLs 404 on Pages.
