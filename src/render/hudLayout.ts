// Shared on-screen layout for the HUD gauges, in screen pixels. Both the HUD renderer and
// the pointer/touch controls read this so the drawn gauges and their touch hit-areas always
// line up. Steering sits bottom-left, throttle bottom-right (two-thumb mobile ergonomics).

export interface HudLayout {
  life: { x: number; y: number; w: number; h: number };
  throttle: { x: number; top: number; bot: number; mid: number; half: number };
  wheel: { x: number; y: number; r: number };
}

export function hudLayout(w: number, h: number): HudLayout {
  // Scale gauges down a touch on small screens so they fit phones in landscape.
  const small = Math.min(w, h) < 480;
  const r = small ? 40 : 46;
  const trackH = small ? 120 : 144;
  const tTop = h - 56 - trackH;
  const tBot = h - 56;
  return {
    life: { x: 20, y: 20, w: small ? 180 : 240, h: 20 },
    throttle: { x: w - 54, top: tTop, bot: tBot, mid: (tTop + tBot) / 2, half: trackH / 2 },
    wheel: { x: small ? 78 : 110, y: h - 110, r },
  };
}
