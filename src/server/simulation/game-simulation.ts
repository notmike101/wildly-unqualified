/** Advance authoritative movement, equipment, and wildlife one tick. */
import {
  PROP_DEFINITIONS,
  fixtureBoxes,
  fixtureSurfaces,
} from "../../shared/world/level.ts";
import {
  distance,
  movePlayer,
  surfaceHeight,
  playerSpeed,
  propertyPoint,
  propertyBoxes,
  type Player,
  type Pose,
  type Vec3,
} from "../../shared/shared.ts";
import { stepAnimals } from "./wildlife/encounters.ts";
import { type RunState, nearby, event } from "./game-state.ts";
import {
  yawPose,
  quatAngle,
  slerp,
  alignLocalX,
  gripOffset,
  clearGrips,
  sweepProp,
} from "./equipment.ts";
import {
  spillCase,
  updateHats,
  neutralize,
  safe,
  heldPose,
} from "./game-support.ts";
const carryState = new WeakMap<
  RunState,
  Map<string, { blocked: number; ignore: boolean }>
>();
/**
 * Advance one authoritative tick, clamped to 1/60 second, including crew separation,
 * carried equipment, wildlife, and incident timers. Paused/exhibition runs do not advance;
 * an empty crew pauses the run.
 *
 * @param run - Authoritative run to mutate
 * @param dt - Positive finite elapsed seconds
 * @throws {Error} The supplied timestep is nonfinite or nonpositive.
 */
export function advanceRun(run: RunState, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0)
    throw Error("Invalid simulation timestep");
  if (run.paused || run.phase === "exhibition") return;
  if (!run.players.some((p) => p.connected)) {
    run.paused = true;
    run.pauseReason = "Waiting for crew";
    neutralize(run);
    return;
  }
  dt = Math.min(dt, 1 / 60);
  run.tick++;
  if (run.phase === "outing") run.seconds += dt;
  const before = new Map(
    run.players.map((p) => [p.id, [...p.position] as Vec3]),
  );
  for (const prop of run.props)
    prop.holders.forEach((id, handle) => {
      const p = id
        ? run.players.find((value) => value.id === id && value.connected)
        : undefined;
      if (p) gripOffset(run, prop, handle, p);
    });
  /**
   * Combine world and fixture blockers with loose equipment the player is not holding.
   *
   * @param p - Player whose held equipment is excluded
   * @returns Collision boxes applicable to this player.
   */
  const playerWalls = (p: Player) => [
    ...run.world.walls,
    ...fixtureBoxes(run.world.fixtures, run.route),
    ...run.props
      .filter((prop) => !prop.holders.includes(p.id) && !prop.placed)
      .flatMap((prop) => propertyBoxes(prop, PROP_DEFINITIONS[prop.kind])),
  ];
  /**
   * Find the highest reachable support under a separation candidate and test standing
   * clearance.
   *
   * @param p - Player being separated
   * @param point - Proposed foot position
   * @returns Supported candidate, or null when it is blocked or above the step limit.
   */
  const separationPoint = (p: Player, point: Vec3): Vec3 | null => {
    const heights = [
        ...run.world.walkables,
        ...fixtureSurfaces(run.world.fixtures, run.route),
      ]
        .map((surface) => surfaceHeight(surface, point[0], point[2]))
        .filter((height): height is number => height !== undefined)
        .filter((height) => height <= p.position[1] + 0.45),
      height = heights.length ? Math.max(...heights) : null;
    if (height === null) return null;
    const supported: Vec3 = [point[0], height, point[2]];
    return safe(run, supported, playerWalls(p)) ? supported : null;
  };
  for (const p of run.players) {
    if (!p.connected) continue;
    if (p.lastInput && run.tick - p.inputTick <= 15) {
      Object.assign(
        p,
        movePlayer(
          p,
          p.lastInput,
          dt,
          playerWalls(p),
          [
            ...run.world.walkables,
            ...fixtureSurfaces(run.world.fixtures, run.route),
          ],
          playerSpeed(p.id, p.lastInput, run.props),
        ),
      );
    } else delete p.lastInput;
    if (!nearby(p.position, run.world.camp, 6))
      run.ready = run.ready.filter((id) => id !== p.id);
  }
  const pairs =
    carryState.get(run) ??
    new Map<string, { blocked: number; ignore: boolean }>();
  carryState.set(run, pairs);
  for (let i = 0; i < run.players.length; i++)
    for (let j = i + 1; j < run.players.length; j++) {
      const a = run.players[i],
        b = run.players[j],
        key = [a.id, b.id].sort().join("\0"),
        state = pairs.get(key) ?? { blocked: 0, ignore: false },
        separation = Math.hypot(
          a.position[0] - b.position[0],
          a.position[2] - b.position[2],
        );
      if (
        !a.connected ||
        !b.connected ||
        Math.abs(a.position[1] - b.position[1]) > 1.8
      ) {
        pairs.delete(key);
        continue;
      }
      if (state.ignore) {
        if (separation > 0.9) pairs.delete(key);
        else pairs.set(key, state);
        continue;
      }
      if (separation >= 0.7) {
        pairs.delete(key);
        continue;
      }
      const movedA = distance(a.position, before.get(a.id)!),
        movedB = distance(b.position, before.get(b.id)!);
      if (movedA > 0.001 !== movedB > 0.001) {
        state.blocked += dt;
        if (state.blocked >= 1.5) state.ignore = true;
        else if (movedA > movedB) a.position = [...before.get(a.id)!];
        else b.position = [...before.get(b.id)!];
      } else {
        const dx = a.position[0] - b.position[0] || 1,
          dz = a.position[2] - b.position[2],
          length = Math.hypot(dx, dz),
          push = (0.7 - separation) / 2;
        const nextA: Vec3 = [
            a.position[0] + (dx / length) * push,
            a.position[1],
            a.position[2] + (dz / length) * push,
          ],
          nextB: Vec3 = [
            b.position[0] - (dx / length) * push,
            b.position[1],
            b.position[2] - (dz / length) * push,
          ];
        const supportedA = separationPoint(a, nextA),
          supportedB = separationPoint(b, nextB);
        if (supportedA) a.position = supportedA;
        if (supportedB) b.position = supportedB;
      }
      pairs.set(key, state);
    }
  for (const prop of run.props) {
    const holders = prop.holders.flatMap((id, handle) => {
      const p = id
        ? run.players.find((value) => value.id === id && value.connected)
        : undefined;
      return p ? [{ p, handle }] : [];
    });
    if (!holders.length) continue;
    const definition = PROP_DEFINITIONS[prop.kind],
      /**
       * Add the remembered grip displacement to the holder's current position.
       *
       * @param grip - Player and handle index for this grip
       * @param grip.p - Player holding this grip
       * @param grip.handle - Index of the held equipment handle
       * @returns Desired world position of the held handle.
       */
      targetPoint = ({ p, handle }: (typeof holders)[number]): Vec3 => {
        const offset = gripOffset(run, prop, handle, p);
        return p.position.map((value, axis) => value + offset[axis]) as Vec3;
      };
    let targetRotation = prop.pose.rotation;
    if (holders.length === 2) {
      const ordered = holders.sort((a, b) => a.handle - b.handle),
        points = ordered.map(targetPoint),
        localA = definition.handles[ordered[0].handle],
        localB = definition.handles[ordered[1].handle],
        /**
         * Compare the two desired grip positions with the equipment's fixed handle spacing.
         *
         * @returns Whether the spacing mismatch exceeds 15 cm.
         */
        incompatible = () =>
          Math.abs(distance(points[0], points[1]) - distance(localA, localB)) >
          0.15;
      if (incompatible()) {
        for (const { p } of holders) p.position = [...before.get(p.id)!];
        points.splice(0, 2, ...ordered.map(targetPoint));
        if (incompatible()) {
          for (const { p, handle } of holders) {
            prop.holders[handle] = null;
            clearGrips(run, prop, p.id);
          }
          prop.velocity = [0, 0, 0];
          prop.angularVelocity = [0, 0, 0];
          continue;
        }
      }
      targetRotation = alignLocalX(
        points[1].map((value, axis) => value - points[0][axis]) as Vec3,
      );
    } else targetRotation = yawPose([0, 0, 0], holders[0].p.yaw).rotation;
    const rotationDistance = quatAngle(prop.pose.rotation, targetRotation),
      rotationStep = Math.min(Math.PI * dt, rotationDistance),
      nextRotation = slerp(
        prop.pose.rotation,
        targetRotation,
        rotationDistance ? rotationStep / rotationDistance : 1,
      ),
      targets = holders.map(targetPoint),
      centers = holders.map(({ handle }, index) => {
        const offset = propertyPoint(definition.handles[handle], {
          position: [0, 0, 0],
          rotation: nextRotation,
        });
        return targets[index].map(
          (value, axis) => value - offset[axis],
        ) as Vec3;
      }),
      position = centers.reduce(
        (sum, center) =>
          sum.map(
            (value, axis) => value + center[axis] / centers.length,
          ) as Vec3,
        [0, 0, 0] as Vec3,
      ),
      desired: Pose = { position, rotation: nextRotation },
      endpointError = Math.max(
        ...holders.map(({ handle }, index) =>
          distance(
            propertyPoint(definition.handles[handle], desired),
            targets[index],
          ),
        ),
      );
    if (endpointError > 0.15) {
      for (const { p, handle } of holders) {
        p.position = [...before.get(p.id)!];
        if (
          distance(
            propertyPoint(definition.handles[handle], prop.pose),
            targetPoint({ p, handle }),
          ) > 0.15
        ) {
          prop.holders[handle] = null;
          clearGrips(run, prop, p.id);
        }
      }
      prop.velocity = [0, 0, 0];
      prop.angularVelocity = [0, 0, 0];
      continue;
    }
    const moved = sweepProp(run, prop, desired);
    const displacement = desired.position.map(
        (value, axis) => value - prop.pose.position[axis],
      ) as Vec3,
      oldPose = structuredClone(prop.pose);
    if (
      (moved.hit && Math.hypot(...prop.velocity) > 0.5) ||
      (!moved.hit &&
        rotationStep / dt > 2 &&
        Math.hypot(...prop.angularVelocity) <= 2)
    )
      spillCase(run, prop);
    prop.pose = moved.hit ? oldPose : moved.pose;
    prop.velocity = displacement.map((value) => value / dt) as Vec3;
    prop.angularVelocity = [0, rotationStep / dt, 0];
    if (moved.hit) {
      for (const { p } of holders) p.position = [...before.get(p.id)!];
      prop.velocity = [0, 0, 0];
      prop.angularVelocity = [0, 0, 0];
      if (run.tick - run.lastImpactTick > 15) {
        run.lastImpactTick = run.tick;
        event(run, "impact", holders[0].p, prop.pose.position);
        event(run, "noise", holders[0].p, prop.pose.position);
      }
    }
  }
  heldPose(run);
  run.spills = run.spills.filter(
    (s) => s.portions > 0 && s.untilTick > run.tick,
  );
  run.pings = run.pings.filter((p) => p.until > run.tick);
  run.events = run.events.filter((e) => e.tick >= run.tick - 1200);
  if (run.phase === "outing") {
    run.decisionSeconds += dt;
    if (run.decisionSeconds >= 0.1 - 1e-9) {
      run.decisionSeconds = Math.max(0, run.decisionSeconds - 0.1);
      for (const p of run.players)
        if (
          p.connected &&
          p.lastInput?.run &&
          !p.lastInput.crouch &&
          Math.hypot(p.lastInput.x, p.lastInput.z) > 0.1
        )
          event(run, "noise", p, p.position);
      stepAnimals(run, 0.1);
      heldPose(run);
    }
  }
  updateHats(run);
}
