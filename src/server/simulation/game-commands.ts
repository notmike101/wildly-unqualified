/** Validate and apply authoritative player commands. */
import {
  PROP_DEFINITIONS,
  RULES,
  TIN_HALF,
  fixtureBoxes,
  fixtureLatch,
} from "../../shared/world/level.ts";
import {
  distance,
  eye,
  equipmentTarget,
  equipmentUseTarget,
  recoveryTarget,
  heldProp,
  parseMessage,
  pose,
  rayBlocked,
  propBoxes,
  type PhotoFrame,
  type PhotoVerdict,
  type Vec3,
} from "../../shared/shared.ts";
import {
  type RunState,
  nearby,
  flat,
  observe,
  player,
  event,
} from "./game-state.ts";
import {
  gripOffset,
  clearGrips,
  releaseProp,
  recoverProp,
  propRecoverable,
} from "./equipment.ts";
import { evaluatePhoto } from "./photo.ts";
import {
  updateHats,
  neutralize,
  safe,
  heldPose,
  release,
  recoverable,
} from "./game-support.ts";
import { makePhotoFrame } from "./game-snapshot.ts";
/**
 * Parse and apply a client message to authoritative state, enforcing world, sequence,
 * player, cooldown, and command-specific rules. Mutates the run and may create a frozen
 * photo frame.
 *
 * @param run - Authoritative run to update
 * @param id - Acting player ID
 * @param input - Untrusted client message; validated before dispatch
 * @returns Frozen frame and verdict for a successful shutter request; otherwise no value.
 * @throws {Error} The command is stale, unauthorized, invalid for the current state, or
 * blocked by a gameplay precondition.
 */
export function applyCommand(
  run: RunState,
  id: string,
  input: unknown,
): { frame: PhotoFrame; verdict: PhotoVerdict } | void {
  const cmd = parseMessage(input),
    p = player(run, id),
    seq = cmd.type === "input" ? cmd.value.seq : cmd.seq;
  if (cmd.worldId !== run.worldId)
    throw Error("Stale world command; refresh the reserve");
  if (seq <= p.lastSeq) throw Error("Replayed command sequence");
  p.lastSeq = seq;
  /**
   * Enforce that the acting player owns the room's host role.
   *
   * @throws {Error} The acting player is not the host.
   */
  const host = () => {
    if (run.hostId !== id) throw Error("Only the host can do that");
  };
  if (cmd.type === "input") {
    p.yaw = cmd.value.yaw;
    p.pitch = cmd.value.pitch;
    p.inputTick = run.tick;
    p.lastInput = run.paused || run.phase === "exhibition" ? null : cmd.value;
    return;
  }
  if (cmd.type === "start") {
    host();
    if (run.phase !== "camp") throw Error("The outing has already started");
    if (run.players.filter((p) => p.connected).length < 2)
      throw Error("Connect at least two researchers to start");
    if (!nearby(p.position, run.world.camp, 6))
      throw Error("Return to camp to start");
    run.phase = "outing";
    run.paused = false;
    run.pauseReason = "";
    neutralize(run);
    return;
  }
  if (cmd.type === "pause" || cmd.type === "save-and-stop") {
    host();
    if (cmd.type === "save-and-stop") {
      if (run.tin.holder && !run.tin.holder.startsWith("animal:"))
        release(run, player(run, run.tin.holder), true);
      for (const prop of run.props) {
        clearGrips(run, prop);
        prop.holders = [null, null];
        prop.placed = run.world.fixtures.some(
          (f) => f.plankId === prop.id && run.route[f.id].open,
        );
      }
    }
    run.paused = true;
    run.pauseReason =
      cmd.type === "pause" ? "Host paused the outing" : "Saved and stopped";
    neutralize(run);
    return;
  }
  if (cmd.type === "resume") {
    const absent = !run.players.some((p) => p.connected && p.id === run.hostId);
    if (
      run.hostId !== id &&
      !(absent && run.pauseReason.startsWith("Disconnected:"))
    )
      throw Error("Only the host can resume this pause");
    if (run.phase === "exhibition") throw Error("This outing has ended");
    run.paused = false;
    run.pauseReason = "";
    neutralize(run);
    return;
  }
  if (cmd.type === "favorite") {
    const photo = run.album.find((photo) => photo.id === cmd.photoId);
    if (!photo) throw Error("Unknown photo");
    photo.favorites = cmd.selected
      ? [...new Set([...photo.favorites, id])]
      : photo.favorites.filter((playerId) => playerId !== id);
    return;
  }
  if (run.paused) throw Error("The outing is paused");
  if (run.phase === "exhibition") throw Error("This outing has ended");
  if (cmd.type === "ready-end" || cmd.type === "finish") {
    if (
      !run.world.commissions
        .filter((c) => c.required)
        .every((c) => run.completed.includes(c.id))
    )
      throw Error("Complete all six required photo commissions first");
    if (cmd.type === "ready-end") {
      if (!nearby(p.position, run.world.camp, 6))
        throw Error("Return to camp before marking ready");
      run.ready = run.ready.includes(id)
        ? run.ready.filter((v) => v !== id)
        : [...run.ready, id];
      return;
    }
    host();
    if (
      run.players.some(
        (p) =>
          p.connected &&
          (!nearby(p.position, run.world.camp, 6) || !run.ready.includes(p.id)),
      )
    )
      throw Error("Every connected researcher must be at camp and ready");
    run.phase = "exhibition";
    run.paused = true;
    run.pauseReason = "Outing complete";
    neutralize(run);
    return;
  }
  if (cmd.type === "ping") {
    if (distance(eye(p), cmd.point) > 50 || !safe(run, flat(cmd.point)))
      throw Error("Ping a reachable point in the reserve");
    run.pings = run.pings.filter((p) => p.player !== id);
    run.pings.push({
      player: id,
      point: [...cmd.point],
      until: run.tick + 600,
    });
    return;
  }
  if (cmd.type === "recover") {
    const lost = run.props.filter(
      (prop) => !prop.holders.some(Boolean) && propRecoverable(run, prop),
    );
    if (lost.length) {
      const prop = lost.sort(
        (a, b) =>
          distance(a.pose.position, p.position) -
          distance(b.pose.position, p.position),
      )[0];
      recoverProp(
        run,
        prop,
        prop.pose.position.every(Number.isFinite)
          ? prop.pose.position
          : p.position,
      );
      event(run, "recover", p, prop.pose.position);
      observe(
        run,
        "Equipment recovers at the nearest clear authored site without losing route progress.",
      );
      return;
    }
    if (run.tin.holder) throw Error("The tin is currently held");
    if (!recoverable(run))
      throw Error("Nearby equipment and the tin are reachable");
    const points: Vec3[] = [
      run.world.tinStart,
      ...run.world.stations.map(
        (s) => [s.recover[0], s.recover[1] + TIN_HALF[1], s.recover[2]] as Vec3,
      ),
    ];
    const origin = run.tin.pose.position.every(Number.isFinite)
      ? run.tin.pose.position
      : p.position;
    const nearest = points.reduce((a, b) =>
      distance(a, origin) < distance(b, origin) ? a : b,
    );
    run.tin.pose = pose(nearest);
    run.tin.velocity = [0, 0, 0];
    run.tin.angularVelocity = [0, 0, 0];
    run.tinRevision++;
    event(run, "recover", p, nearest);
    observe(
      run,
      "The tin can be recovered without losing bait or photographs.",
    );
    return;
  }
  if (cmd.type === "interact") {
    if (run.tin.holder === id) {
      release(run, p, false);
      return;
    }
    const carrying = heldProp(id, run.props);
    if (carrying) {
      releaseProp(run, carrying, id, true);
      event(run, "place", p, carrying.pose.position);
      return;
    }
    const recovery = recoveryTarget(p, run, PROP_DEFINITIONS, [
      ...run.world.walls,
      ...fixtureBoxes(run.world.fixtures, run.route),
    ]);
    if (recovery) {
      if (recovery.kind === "hat") {
        const hat = run.hats.find((h) => h.owner === recovery.id)!;
        hat.carrier = "owner";
        hat.untilTick = 0;
        updateHats(run);
        observe(
          run,
          "The borrowed hat is back with its original owner, with repeat-theft protection intact.",
        );
      } else {
        const spill = run.spills.find((s) => s.id === recovery.id)!;
        const amount = Math.min(8 - run.spareBait, spill.portions);
        run.spareBait += amount;
        spill.portions -= amount;
        run.spills = run.spills.filter((s) => s.portions > 0);
        observe(
          run,
          "Recovered spilled bait goes back into the shared field-case supplies.",
        );
      }
      event(run, "recover", p, recovery.point);
      return;
    }
    const reachWalls = [
        ...run.world.walls,
        ...fixtureBoxes(run.world.fixtures, run.route),
        ...run.props.flatMap((prop) =>
          propBoxes(prop, PROP_DEFINITIONS[prop.kind]),
        ),
      ],
      target = equipmentTarget(p, run.props, PROP_DEFINITIONS, [
        ...run.world.walls,
        ...fixtureBoxes(run.world.fixtures, run.route),
      ]),
      tinReachable =
        (!run.tin.holder || run.tin.holder?.startsWith("animal:")) &&
        distance(eye(p), run.tin.pose.position) <= 2 &&
        !rayBlocked(eye(p), run.tin.pose.position, reachWalls);
    if (
      target &&
      (!tinReachable ||
        distance(eye(p), target.point) <
          distance(eye(p), run.tin.pose.position))
    ) {
      const prop = run.props.find((value) => value.id === target.propId)!;
      prop.holders[target.handle!] = id;
      prop.placed = false;
      gripOffset(run, prop, target.handle!, p);
      return;
    }
    const gate = run.world.fixtures
        .filter((f) => f.kind === "gate")
        .map((f) => ({ ...f, latch: fixtureLatch(f, run.route) }))
        .filter((f) => f.latch)
        .sort(
          (a, b) => distance(eye(p), a.latch!) - distance(eye(p), b.latch!),
        )[0],
      latch = gate?.latch;
    if (
      latch &&
      distance(eye(p), latch) <= 2 &&
      !rayBlocked(eye(p), latch, [
        ...run.world.walls,
        ...run.props.flatMap((prop) =>
          propBoxes(prop, PROP_DEFINITIONS[prop.kind]),
        ),
      ])
    ) {
      run.route[gate.id].open = !run.route[gate.id].open;
      event(run, "place", p, latch);
      return;
    }
    const heldByOther = run.tin.holder && !run.tin.holder.startsWith("animal:");
    const tooFar = distance(eye(p), run.tin.pose.position) > 2;
    const blocked = rayBlocked(eye(p), run.tin.pose.position, reachWalls);
    if (heldByOther || tooFar || blocked) {
      const clue = run.world.commissions
        .map((c) => ({
          title: c.title,
          text: c.instructions,
          position: run.world.pockets.find((p) => p.id === c.pocket)!.position,
        }))
        .filter(
          (c) =>
            distance(p.position, c.position) <= 3 &&
            !rayBlocked(eye(p), c.position, reachWalls),
        )
        .sort(
          (a, b) =>
            distance(p.position, a.position) - distance(p.position, b.position),
        )[0];
      if (clue) {
        observe(run, `${clue.title}: ${clue.text}`);
        return;
      }
      if (heldByOther) throw Error("Another researcher is holding the tin");
      if (tooFar)
        throw Error("Move closer to reach the tin or inspect a field clue");
      throw Error("The tin is blocked by a wall");
    }
    if (run.tin.holder?.startsWith("animal:")) {
      const r = run.animals.find((a) => a.id === run.tin.holder?.slice(7))!;
      r.behavior = "wander";
      r.remaining = 0;
      run.animalMemory[r.id].habituatedUntilTick = run.tick + 120;
      observe(
        run,
        "The raccoon will give up the tin when you reclaim it close by.",
      );
    }
    run.tin.holder = id;
    run.tinRevision++;
    heldPose(run);
    return;
  }
  if (cmd.type === "drop") {
    const prop = heldProp(id, run.props);
    if (prop) releaseProp(run, prop, id, false);
    else if (run.tin.holder === id) release(run, p, true);
    else throw Error("Pick up the tin or equipment first");
    return;
  }
  if (cmd.type === "use") {
    const cooldown = run.cooldowns[id];
    if (run.tick - cooldown.use < RULES.whistleCooldown * 60)
      throw Error("Wait for the whistle or tin cooldown");
    cooldown.use = run.tick;
    const prop = heldProp(id, run.props);
    if (prop?.kind === "case") {
      prop.open = !prop.open;
      event(run, "place", p, prop.pose.position);
      return;
    }
    if (!prop) {
      const target = equipmentUseTarget(p, run.props, PROP_DEFINITIONS, [
        ...run.world.walls,
        ...fixtureBoxes(run.world.fixtures, run.route),
      ]);
      if (target) {
        const decoy = run.props.find((value) => value.id === target.propId)!;
        if (decoy.open) throw Error("The decoy bait cup is already filled");
        if (!run.spareBait) throw Error("The field case is out of spare bait");
        run.spareBait--;
        decoy.open = true;
        event(run, "bait", p, target.point);
        return;
      }
    }
    if (run.tin.holder === id) {
      const supply = run.props.find(
        (value) =>
          value.kind === "case" &&
          value.open &&
          nearby(value.pose.position, p.position, 2.5),
      );
      if (supply && run.tin.portions < 4 && run.spareBait) {
        const portions = Math.min(4 - run.tin.portions, run.spareBait);
        run.tin.portions += portions;
        run.spareBait -= portions;
        observe(
          run,
          "The open field case refilled the tin from its saved spare bait.",
        );
        return;
      }
      if (
        (nearby(p.position, run.world.camp, 5) ||
          run.world.stations.some((s) => nearby(p.position, s.position, 5))) &&
        (run.tin.portions < 4 || run.spareBait < 8)
      ) {
        run.tin.portions = 4;
        run.spareBait = 8;
        observe(
          run,
          "Camp has spare bait: use the held tin here to refill all four portions.",
        );
        return;
      }
      const patch = run.world.pockets
        .flatMap((p) => p.anchors)
        .find((a) => a.kind === "feed" && nearby(p.position, a.point, 2.5));
      if (patch) {
        if (!run.tin.portions)
          throw Error("The tin is empty; refill at a supply station");
        if (run.baitPatches[patch.id] >= 4)
          throw Error("The feeding patch already has enough bait");
        run.tin.portions--;
        run.baitPatches[patch.id]++;
        event(run, "bait", p, patch.point);
        observe(
          run,
          "Bait placed at the local feeding patch. Give wildlife quiet space.",
        );
        return;
      }
      run.tin.open = true;
      event(run, "rattle", p, run.tin.pose.position);
      event(run, "noise", p, p.position);
      observe(
        run,
        `${p.name} rattled the tin. The raccoon follows open tins and rattles.`,
      );
    } else {
      event(run, "whistle", p, p.position);
      event(run, "noise", p, p.position);
      observe(
        run,
        `${p.name} whistled. The raccoon investigates; nearby herons startle.`,
      );
    }
    return;
  }
  if (cmd.type === "photo") {
    if (run.phase !== "outing")
      throw Error("Start the outing before recording assignment photographs");
    const cooldown = run.cooldowns[id];
    if (run.tick - cooldown.photo < RULES.photoCooldown * 60)
      throw Error("Wait one second before the next photograph");
    cooldown.photo = run.tick;
    const frame = makePhotoFrame(run, id),
      verdict = evaluatePhoto(frame, run.world),
      credits = verdict.credits.filter((c) => !run.completed.includes(c));
    run.completed.push(...credits);
    const assists = [
      ...new Set(
        run.events
          .filter(
            (e) =>
              e.player &&
              e.player !== id &&
              e.tick >= run.tick - 1200 &&
              ["rattle", "whistle", "bait", "place"].includes(e.kind) &&
              frame.animals.some((a) => nearby(a.pose.position, e.point, 12)),
          )
          .map((e) => e.player),
      ),
    ];
    run.album.push({
      id: frame.id,
      photographer: id,
      tick: run.tick,
      credits,
      assists,
      favorites: [],
      incident: null,
      thumbnail: "pending",
    });
    run.pendingPhotos[frame.id] = frame;
    const extras = run.album.filter((p) => !p.credits.length);
    const remove = new Set(extras.slice(0, -21).map((p) => p.id));
    run.album = run.album.filter((p) => !remove.has(p.id));
    for (const id of remove) delete run.pendingPhotos[id];
    if (!credits.length) {
      run.failedSetups++;
      if (run.failedSetups >= 3)
        observe(
          run,
          "If setups keep going wrong, refill the tin at camp. Keep the raccoon 3–8 metres from the heron.",
        );
    }
    return { frame, verdict };
  }
}
