// Level data schema. Coordinates and sizes are in METERS so levels read naturally;
// the loader converts them to pixels. This shape is plain data, so future levels can
// live as JSON files in a `levels/` folder and be fetched/loaded without code changes.

export interface Pose {
  x: number; // metres
  y: number; // metres
  angle: number; // radians, 0 = facing +x (east)
}

export interface WallDef {
  x: number; // centre, metres
  y: number;
  w: number; // metres
  h: number;
  angle?: number; // radians
  kind?: "land" | "dock"; // affects colour only
}

export interface BoatDef {
  x: number; // centre, metres
  y: number;
  angle: number; // radians
  length: number; // metres
  beam: number; // metres
}

export interface GoalDef {
  x: number; // centre, metres
  y: number;
  w: number; // metres
  h: number;
}

export interface Level {
  name: string;
  bounds: { w: number; h: number }; // world size, metres
  spawn: Pose; // player start (the docking slot)
  goal: GoalDef; // seaport target zone
  walls: WallDef[];
  boats: BoatDef[];
}
