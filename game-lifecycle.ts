/** Run creation, crew admission/disconnection, and native physics lifetime. */
import { TIN_HALF } from "./level.ts";
import { generateReserve } from "./world.ts";
import {
  pose,
  type CrewSlot,
  type FieldProp,
  type Player,
  type Quat,
  type Vec3,
} from "./shared.ts";
import { createPhysics } from "./physics.ts";
import { type RunState, observe, event } from "./game-state.ts";
import { releaseProp, recoverProp, propRecoverable } from "./equipment.ts";
import {
  spillCase,
  updateHats,
  neutralize,
  safeSpawn,
  release,
} from "./game-support.ts";
export function createRun(
  seed = 1,
  worldId: string = crypto.randomUUID(),
): RunState {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw Error("World seed must be a uint32 integer");
  const world = generateReserve(seed, worldId);
  const fieldProp = (
    id: string,
    kind: FieldProp["kind"],
    position: Vec3,
    rotation: Quat = [0, 0, 0, 1],
  ): FieldProp => ({
    id,
    kind,
    pose: { position: [...position], rotation: [...rotation] },
    velocity: [0, 0, 0],
    angularVelocity: [0, 0, 0],
    holders: [null, null],
    placed: false,
    open: false,
    spillUntilTick: 0,
  });
  return {
    version: 3,
    worldId: world.id,
    tick: 0,
    seconds: 0,
    phase: "camp",
    paused: true,
    pauseReason: "Waiting for crew",
    players: [],
    animals: world.residents.map((resident) => ({
      id: resident.id,
      species: resident.species,
      behavior: "wander",
      pose: pose(resident.spawn),
      target: [...resident.spawn],
      remaining: 5,
    })),
    tin: {
      pose: pose(world.tinStart),
      velocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      holder: null,
      portions: 4,
      open: false,
    },
    world,
    props: world.props.map((prop) =>
      fieldProp(prop.id, prop.kind, prop.pose.position, prop.pose.rotation),
    ),
    route: Object.fromEntries(
      world.fixtures.map((f) => [f.id, { open: false, seat: null }]),
    ),
    spills: [],
    hats: [],
    spareBait: 8,
    baitPatches: Object.fromEntries(
      world.pockets.flatMap((p) =>
        p.anchors.filter((a) => a.kind === "feed").map((a) => [a.id, 0]),
      ),
    ),
    observations: [
      "Open the tin near the raccoon. Watch its paws before it steals the tin.",
    ],
    completed: [],
    album: [],
    ready: [],
    pings: [],
    pendingPhotos: {},
    hostId: null,
    events: [],
    cooldowns: {},
    animalMemory: Object.fromEntries(
      world.residents.map(({ id }) => [
        id,
        {
          goal: "",
          recentGoals: [],
          interestPoint: null,
          interestUntilTick: 0,
          habituatedUntilTick: 0,
          hatTarget: null,
        },
      ]),
    ),
    decisionSeconds: 0,
    nextPhoto: 1,
    tinRevision: 0,
    lastImpactTick: -6000,
    failedSetups: 0,
  };
}

export function addPlayer(run: RunState, id: string, name: string): Player {
  if (
    !/^[-_a-zA-Z0-9]{1,80}$/.test(id) ||
    ["__proto__", "constructor", "prototype"].includes(id)
  )
    throw Error("Invalid player ID");
  let p = run.players.find((p) => p.id === id);
  if (!p && run.players.length >= 4)
    throw Error("The four crew slots are full");
  const position = safeSpawn(run, id);
  if (p) {
    p.connected = true;
    p.position = position;
    p.lastInput = null;
    p.inputTick = run.tick;
  } else {
    const slot = ([0, 1, 2, 3] as CrewSlot[]).find(
      (slot) => !run.players.some((player) => player.slot === slot),
    );
    if (slot === undefined) throw Error("The four crew slots are full");
    p = {
      id,
      name: name.trim().slice(0, 24) || "Researcher",
      slot,
      position,
      yaw: 0,
      pitch: 0,
      lastSeq: 0,
      connected: true,
      lastInput: null,
      inputTick: run.tick,
    };
    run.players.push(p);
    run.hats.push({
      owner: id,
      carrier: "owner",
      position: [...position],
      untilTick: 0,
      protectedUntilTick: 0,
    });
  }
  run.cooldowns[id] ??= { use: -6000, photo: -6000 };
  run.ready = run.ready.filter((id) => id !== p.id);
  if (run.hostId === null) run.hostId = id;
  if (run.phase === "camp" && run.pauseReason === "Waiting for crew") {
    run.paused = false;
    run.pauseReason = "";
  }
  return p;
}

export function disconnectPlayer(run: RunState, id: string): void {
  const p = run.players.find((p) => p.id === id);
  if (!p) return;
  if (run.tin.holder === id) {
    try {
      release(run, p, false);
    } catch {
      run.tin.holder = null;
      run.tin.pose = pose([p.position[0], TIN_HALF[1], p.position[2]]);
      run.tin.velocity = [0, 0, 0];
      run.tin.angularVelocity = [0, 0, 0];
      run.tinRevision++;
    }
  }
  for (const prop of run.props)
    if (prop.holders.includes(id)) {
      releaseProp(run, prop, id, false);
      if (!prop.holders.some(Boolean) && propRecoverable(run, prop))
        recoverProp(run, prop, p.position);
    }
  p.connected = false;
  for (const animal of run.animals) {
    const memory = run.animalMemory[animal.id];
    if (memory.hatTarget === id) {
      memory.hatTarget = null;
      if (animal.behavior === "hat-reach") {
        animal.behavior = "wander";
        animal.remaining = 0;
      }
    }
  }
  updateHats(run);
  run.ready = run.ready.filter((v) => v !== id);
  run.paused = true;
  run.pauseReason = `Disconnected: ${p.name}. Continue without them or wait.`;
  neutralize(run);
}

export async function attachPhysics(
  run: RunState,
): Promise<{ step(dt: number): void; dispose(): void }> {
  const physics = await createPhysics(
    run.world.physicsBoxes,
    run.tin,
    run.props,
    run.route,
    run.world.fixtures,
  );
  let revision = run.tinRevision,
    holder = run.tin.holder;
  return {
    dispose: () => physics.dispose(),
    step(dt) {
      if (run.paused || run.phase === "exhibition") return;
      if (
        revision !== run.tinRevision ||
        holder !== run.tin.holder ||
        run.tin.holder
      ) {
        physics.setTin(run.tin);
        revision = run.tinRevision;
        holder = run.tin.holder;
      }
      physics.setProps(run.props, run.route);
      const next = physics.step(dt);
      if (!run.tin.holder) {
        run.tin.pose = next.pose;
        run.tin.velocity = next.velocity;
        run.tin.angularVelocity = next.angularVelocity;
      }
      for (const value of next.props) {
        const prop = run.props.find((item) => item.id === value.id)!;
        if (!prop.holders.some(Boolean) && !prop.placed)
          Object.assign(prop, value);
      }
      for (const impact of next.impacts)
        for (const id of impact.sources) {
          const prop = run.props.find((p) => p.id === id);
          if (prop) spillCase(run, prop);
        }
      if (next.impacts.length && run.tick - run.lastImpactTick > 15) {
        run.lastImpactTick = run.tick;
        event(run, "noise", null, next.impacts[0].point);
        observe(
          run,
          "Dropped equipment clanged. Physical impacts can startle the heron.",
        );
      }
    },
  };
}
