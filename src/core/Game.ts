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
  buildWall,
  buildObstacleBoat,
  buildPlayer,
  type PlayerView,
} from "../render/views.ts";
import { HUD } from "../render/hud.ts";

export class Game {
  private readonly physics = new PhysicsWorld();
  private readonly controls = new Controls();
  private readonly pointer: PointerControls;
  private readonly state = new GameState();
  private readonly hud = new HUD();
  private readonly scene = new Container(); // level-specific views, cleared on restart
  private readonly loop: GameLoop;

  private boat!: Boat;
  private playerView!: PlayerView;
  private restartArmed = true;

  constructor(
    private readonly renderer: Renderer,
    private readonly level: Level,
  ) {
    renderer.world.addChild(this.scene);
    renderer.hud.addChild(this.hud.container);

    // Touch / mouse controls, kept sized to the viewport.
    this.pointer = new PointerControls(renderer.app, renderer.hud);
    this.pointer.resize(renderer.width, renderer.height);
    renderer.app.renderer.on("resize", () =>
      this.pointer.resize(renderer.width, renderer.height),
    );
    // Tap anywhere to restart once the round is over (mobile-friendly).
    renderer.app.stage.on("pointertap", () => {
      if (this.state.status !== "playing") this.build();
    });

    // Player is identified by reference; rebuilt on restart, so check the live body.
    attachCollisions(
      this.physics.engine,
      (b) => b === this.boat.body,
      () => this.state.win(),
      (amount) => this.state.damage(amount),
    );

    this.build();

    // Dev-only probe for automated verification; stripped from production builds.
    if (import.meta.env.DEV) {
      (window as unknown as { __boatSpeed?: () => number }).__boatSpeed = () =>
        this.boat.speedKnots;
    }

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
    );
    renderer.app.ticker.add((t) => this.loop.frame(t.deltaMS));
  }

  private build() {
    const lv = this.level;
    this.scene.removeChildren();
    this.physics.clear();
    this.state.reset();

    this.scene.addChild(buildWater(lv));
    this.scene.addChild(buildGoal(lv.goal));
    this.physics.add(makeGoal(lv.goal));

    for (const wall of lv.walls) {
      this.physics.add(makeWall(wall));
      this.scene.addChild(buildWall(wall));
    }
    for (const def of lv.boats) {
      this.physics.add(makeObstacleBoat(def));
      this.scene.addChild(buildObstacleBoat(def));
    }

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

    if (this.state.status === "playing") {
      this.boat.update(dt, input);
      this.physics.step(1000 / 60);
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

    this.renderer.follow(
      b.position.x,
      b.position.y,
      this.level.bounds.w * P,
      this.level.bounds.h * P,
    );
    this.hud.update(this.state, this.boat, this.renderer.width, this.renderer.height);
  }
}
