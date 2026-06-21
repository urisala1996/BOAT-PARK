import Matter from "matter-js";
import { Container } from "pixi.js";
import { PIXELS_PER_METER as P } from "../config.ts";
import type { Level } from "../level/types.ts";
import { Renderer } from "../render/Renderer.ts";
import { PhysicsWorld } from "../physics/world.ts";
import { Boat } from "../physics/Boat.ts";
import { Controls } from "../input/controls.ts";
import { PointerControls } from "../input/pointer.ts";
import { GameState } from "../state/GameState.ts";
import { GameLoop } from "./GameLoop.ts";
import { attachCollisions } from "../physics/collision.ts";
import { makeWall, makeObstacleBoat, makeGoal } from "../entities/bodies.ts";
import {
  buildWater,
  buildGoal,
  buildBuoys,
  buildWall,
  buildObstacleBoat,
  buildPlayer,
  type PlayerView,
  type GoalView,
} from "../render/views.ts";
import { Wake } from "../render/wake.ts";
import { HUD } from "../render/hud.ts";

export class Game {
  private readonly physics = new PhysicsWorld();
  private readonly controls = new Controls();
  private readonly pointer: PointerControls;
  private readonly state = new GameState();
  private readonly hud = new HUD();
  private readonly scene = new Container(); // level-specific views, cleared on restart
  private readonly loop: GameLoop;

  private readonly wake = new Wake();
  private boat!: Boat;
  private playerView!: PlayerView;
  private goalView!: GoalView;
  private restartArmed = true;
  private clock = 0; // real seconds, for animation
  private readonly tickerFn: (t: { deltaMS: number }) => void;
  private readonly resizeFn = () => this.pointer.resize(this.renderer.width, this.renderer.height);
  private readonly tapFn = () => {
    if (this.state.status === "ready") this.state.start();
    else if (this.state.status !== "playing") this.build();
  };

  constructor(
    private readonly renderer: Renderer,
    private readonly level: Level,
  ) {
    renderer.world.addChild(this.scene);
    renderer.hud.addChild(this.hud.container);

    // Touch / mouse controls, kept sized to the viewport.
    this.pointer = new PointerControls(renderer.app, renderer.hud);
    this.pointer.resize(renderer.width, renderer.height);
    renderer.app.renderer.on("resize", this.resizeFn);
    // Tap to start from the title, or to restart once the round is over (mobile-friendly).
    renderer.app.stage.on("pointertap", this.tapFn);

    // Player is identified by reference; rebuilt on restart, so check the live body.
    attachCollisions(
      this.physics.engine,
      (b) => b === this.boat.body,
      () => this.state.win(),
      (amount) => this.state.damage(amount),
    );

    this.build();

    // Dev-only probes for automated verification; stripped from production builds.
    if (import.meta.env.DEV) {
      const win = window as unknown as Record<string, unknown>;
      win.__boat = () => ({
        kn: this.boat.speedKnots,
        angleDeg: (this.boat.body.angle * 180) / Math.PI,
        yawRateDegPerSec: (this.boat.body.angularVelocity * 60 * 180) / Math.PI,
        x: this.boat.body.position.x,
        y: this.boat.body.position.y,
        throttle: this.boat.throttle,
        motorDeg: (this.boat.motorAngle * 180) / Math.PI,
      });
      win.__forceWin = () => {
        this.state.status = "playing";
        this.state.win();
      };
      win.__forceLose = () => {
        this.state.status = "playing";
        this.state.damage(9999);
      };
    }

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
    );
    this.tickerFn = (t) => this.loop.frame(t.deltaMS);
    renderer.app.ticker.add(this.tickerFn);
  }

  dispose() {
    this.renderer.app.ticker.remove(this.tickerFn);
    this.renderer.app.renderer.off("resize", this.resizeFn);
    this.renderer.app.stage.off("pointertap", this.tapFn);
    this.pointer.dispose();
    this.renderer.world.removeChild(this.scene);
    this.renderer.hud.removeChild(this.hud.container);
  }

  private build() {
    const lv = this.level;
    this.scene.removeChildren();
    this.physics.clear();
    this.state.reset();

    this.scene.addChild(buildWater(lv));
    this.goalView = buildGoal(lv.goal);
    this.scene.addChild(this.goalView.container);
    this.scene.addChild(buildBuoys(lv.goal));
    this.physics.add(makeGoal(lv.goal));

    for (const wall of lv.walls) {
      this.physics.add(makeWall(wall));
      this.scene.addChild(buildWall(wall));
    }
    for (const def of lv.boats) {
      this.physics.add(makeObstacleBoat(def));
      this.scene.addChild(buildObstacleBoat(def));
    }

    this.wake.reset();
    this.scene.addChild(this.wake.container);

    this.boat = new Boat(
      lv.spawn.x * P,
      lv.spawn.y * P,
      lv.spawn.angle,
      5,
      1.9,
    );
    this.physics.add(this.boat.body);
    this.playerView = buildPlayer(this.boat.lengthPx, 1.9 * P);
    this.scene.addChild(this.playerView.container);
  }

  private update(dt: number) {
    this.clock += dt;
    const input = this.controls.read();
    input.steerSet = this.pointer.steerSet;
    input.throttleSet = this.pointer.throttleSet;

    if (input.restart) {
      if (this.restartArmed) {
        this.build();
        this.restartArmed = false;
      }
    } else {
      this.restartArmed = true;
    }

    // Any control input leaves the title screen and gets under way.
    if (this.state.status === "ready" && hasInput(input)) this.state.start();

    if (this.state.status === "playing") {
      this.boat.update(dt, input);
      this.physics.step(1000 / 60);
      this.state.tick(dt * 1000);
      this.wake.update(this.boat, dt);
    } else {
      // Let momentum bleed off after the round ends so it settles gracefully.
      Matter.Body.setVelocity(this.boat.body, {
        x: this.boat.body.velocity.x * 0.94,
        y: this.boat.body.velocity.y * 0.94,
      });
      this.physics.step(1000 / 60);
    }
  }

  private render() {
    const b = this.boat.body;
    this.playerView.container.position.set(b.position.x, b.position.y);
    this.playerView.container.rotation = b.angle;
    this.playerView.motor.rotation = this.boat.motorAngle;
    this.goalView.update(this.clock);

    this.renderer.follow(
      b.position.x,
      b.position.y,
      this.level.bounds.w * P,
      this.level.bounds.h * P,
    );

    // Goal position in screen space, for the off-screen direction arrow.
    const z = this.renderer.zoom;
    const gx = this.renderer.world.position.x + this.level.goal.x * P * z;
    const gy = this.renderer.world.position.y + this.level.goal.y * P * z;
    const m = 70;
    const onScreen =
      gx > m && gx < this.renderer.width - m && gy > m && gy < this.renderer.height - m;

    this.hud.update({
      state: this.state,
      boat: this.boat,
      w: this.renderer.width,
      h: this.renderer.height,
      t: this.clock,
      goal: { x: gx, y: gy, onScreen },
    });
  }
}

function hasInput(i: {
  steer: number;
  throttle: number;
  neutral: boolean;
  steerSet: number | null;
  throttleSet: number | null;
}): boolean {
  return (
    i.steer !== 0 ||
    i.throttle !== 0 ||
    i.neutral ||
    i.steerSet != null ||
    i.throttleSet != null
  );
}
