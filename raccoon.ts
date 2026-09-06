/** Raccoon investigation, theft, washing, and recovery behavior. */
import type { RunState } from "./game.ts";
import { RULES, TIN_HALF } from "./level.ts";
import { distance, pose, type Animal, type Box, type Vec3 } from "./shared.ts";
import {
  type AnimalMemory,
  anchorsFor,
  homeFor,
  anchorFor,
} from "./animal-context.ts";
import { flatDistance, clear, routeTo, walk } from "./animal-navigation.ts";
import { observe, goal, choose, approachPoint } from "./animal-behavior.ts";
/**
 * Advance raccoon investigation, tin theft, washing, and hat incidents using persistent
 * memory and navigable approaches. Mutates the animal and any affected run equipment or
 * incidents.
 *
 * @param run - Authoritative run to update
 * @param a - Raccoon being advanced
 * @param m - Persistent memory for this resident
 * @param dt - Elapsed simulation seconds
 * @param extra - Additional equipment blockers
 */
export function raccoonStep(
  run: RunState,
  a: Animal,
  m: AnimalMemory,
  dt: number,
  extra: Box[],
) {
  const home = homeFor(run, a),
    wash = anchorFor(run, a, "wash"),
    stash = anchorFor(run, a, "rest");
  if (run.tin.holder === `animal:${a.id}`) {
    m.hatTarget = null;
    const whistle = [...run.events]
      .reverse()
      .find(
        (e) =>
          e.kind === "whistle" &&
          run.tick - e.tick < 240 &&
          flatDistance(e.point, a.pose.position) < RULES.lureRadius &&
          !m.recentGoals.includes(`whistle-${e.tick}`) &&
          m.goal !== `whistle-${e.tick}`,
      );
    if (a.behavior !== "investigate" && whistle) {
      const point = approachPoint(run, a, whistle.point, extra);
      if (point) {
        goal(m, `whistle-${whistle.tick}`);
        m.interestUntilTick = run.tick + 120;
        a.target = point;
        a.behavior = "investigate";
      }
    }
    if (a.behavior === "investigate") {
      if (run.tick < m.interestUntilTick) {
        walk(run, a, a.target, 2, dt, extra);
        return;
      }
      goal(m, "carry-stash");
      a.target = [...stash];
    }
    a.behavior = "carry";
    if (walk(run, a, a.target, 1.9, dt, extra)) {
      run.tin.holder = null;
      run.tin.pose = pose([
        a.pose.position[0],
        a.pose.position[1] + TIN_HALF[1],
        a.pose.position[2],
      ]);
      run.tinRevision++;
      a.behavior = "wander";
      a.remaining = 1;
      m.habituatedUntilTick = run.tick + 480;
      observe(
        run,
        "The raccoon left the same tin at a reachable stash. Reclaim it close by.",
      );
    }
    return;
  }
  const decoy = run.props.find(
      (p) => p.kind === "decoy" && p.open && !p.holders.some(Boolean),
    ),
    noise = [...run.events]
      .reverse()
      .find(
        (e) =>
          ["rattle", "whistle", "place"].includes(e.kind) &&
          run.tick - e.tick < 240 &&
          flatDistance(e.point, a.pose.position) < RULES.lureRadius,
      ),
    spill = run.spills.find(
      (s) =>
        s.portions > 0 &&
        s.untilTick > run.tick &&
        flatDistance(s.position, a.pose.position) < RULES.lureRadius,
    );
  const candidates: { id: string; point: Vec3; food: boolean }[] = [];
  if (
    run.tin.open &&
    flatDistance(run.tin.pose.position, a.pose.position) < RULES.lureRadius
  )
    candidates.push({
      id: "tin",
      point: run.tin.pose.position,
      food: run.tin.portions > 0,
    });
  if (spill)
    candidates.push({ id: spill.id, point: spill.position, food: true });
  if (
    decoy &&
    flatDistance(decoy.pose.position, a.pose.position) < RULES.lureRadius
  )
    candidates.push({ id: decoy.id, point: decoy.pose.position, food: true });
  if (noise)
    candidates.push({
      id: `${noise.kind}-${noise.tick}`,
      point: noise.point,
      food: false,
    });
  const lure = candidates.find((c) =>
    approachPoint(run, a, c.point, extra, 0.85, c.id),
  );
  /**
   * Resolve a connected player whose hat is currently available for this raccoon's reach
   * attempt.
   *
   * @param id - Candidate hat owner ID
   * @returns Eligible player, or undefined when the owner/hat conditions fail.
   */
  const hatOwner = (id: string) =>
    run.players.find(
      (p) =>
        p.id === id &&
        p.connected &&
        distance(p.position, a.pose.position) <= 1.2 &&
        clear(a.pose.position, p.position, run, extra) &&
        run.hats.some(
          (h) =>
            h.owner === id &&
            h.carrier === "owner" &&
            h.protectedUntilTick <= run.tick,
        ),
    );
  if (a.behavior === "hat-reach") {
    const owner = m.hatTarget ? hatOwner(m.hatTarget) : undefined;
    if (!owner || run.hats.some((h) => h.carrier.startsWith("animal:"))) {
      m.hatTarget = null;
      a.behavior = "wander";
      a.remaining = 0;
    } else {
      a.target = [...owner.position];
      const yaw = Math.atan2(
        a.pose.position[0] - owner.position[0],
        a.pose.position[2] - owner.position[2],
      );
      a.pose.rotation = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
      a.remaining = Math.max(0, a.remaining - dt);
      if (a.remaining > 1e-6) return;
      const hat = run.hats.find((h) => h.owner === owner.id)!;
      hat.carrier = `animal:${a.id}`;
      hat.untilTick = run.tick + 1800;
      hat.protectedUntilTick = run.tick + 3600;
      m.hatTarget = null;
      a.behavior = "wander";
      a.remaining = 0;
      observe(
        run,
        "The raccoon borrowed a crew hat. Anyone close by can reclaim it with E; it drops within 30 seconds.",
      );
      return;
    }
  }
  if (
    !lure &&
    a.behavior === "wander" &&
    !run.hats.some((h) => h.carrier.startsWith("animal:"))
  ) {
    const owner = run.players.find((p) => hatOwner(p.id));
    if (owner) {
      m.hatTarget = owner.id;
      a.target = [...owner.position];
      a.behavior = "hat-reach";
      a.remaining = 1.2;
      observe(
        run,
        "The raccoon is looking up and reaching for a nearby hat. Step away to keep it.",
      );
      return;
    }
  }
  if (
    (a.behavior === "wash" &&
      (!lure?.food || flatDistance(lure.point, wash) >= 2)) ||
    (a.behavior === "inspect" &&
      (!run.tin.open ||
        flatDistance(a.pose.position, run.tin.pose.position) > 1.5))
  ) {
    a.behavior = "wander";
    a.remaining = 0;
  }
  if (
    a.behavior === "inspect" &&
    lure?.food &&
    flatDistance(lure.point, wash) < 2 &&
    flatDistance(a.pose.position, wash) < 1
  ) {
    a.behavior = "wash";
    a.remaining = RULES.inspectSeconds;
  }
  if (
    ["inspect", "wash", "investigate"].includes(a.behavior) &&
    a.remaining > 0
  ) {
    a.remaining = Math.max(0, a.remaining - dt);
    if (a.remaining) return;
    const eaten = run.spills.find(
      (s) => s.id === m.goal && flatDistance(s.position, a.pose.position) < 1.5,
    );
    if (eaten) {
      eaten.portions--;
      run.spills = run.spills.filter((s) => s.portions > 0);
      observe(
        run,
        "The raccoon ate one spilled portion. Camp can replace supplies.",
      );
    }
    m.habituatedUntilTick = run.tick + 480;
    if (
      m.goal === "tin" &&
      !run.tin.holder &&
      flatDistance(a.pose.position, run.tin.pose.position) < 1.5
    ) {
      const target = routeTo(a.pose.position, stash, run, extra).length
        ? stash
        : home;
      run.tin.holder = `animal:${a.id}`;
      run.tinRevision++;
      a.behavior = "carry";
      a.target = [...target];
      return;
    }
    a.behavior = "wander";
    a.remaining = 1;
    a.pose.rotation = [0, a.pose.rotation[3], 0, -a.pose.rotation[1]];
    observe(
      run,
      "The raccoon has lost interest in the unchanged setup. Move the lure to draw it back.",
    );
    return;
  }
  if (
    lure &&
    (run.tick >= m.habituatedUntilTick ||
      !m.interestPoint ||
      flatDistance(m.interestPoint, lure.point) > 1.2)
  ) {
    const washing = lure.food && flatDistance(lure.point, wash) < 2,
      target = washing
        ? wash
        : approachPoint(run, a, lure.point, extra, 0.85, lure.id);
    if (target) {
      if (
        m.goal !== lure.id ||
        !m.interestPoint ||
        flatDistance(m.interestPoint, lure.point) > 1.2
      ) {
        goal(m, lure.id);
        m.interestPoint = [...lure.point];
        m.interestUntilTick = run.tick + 900;
        m.habituatedUntilTick = 0;
      }
      if (run.tick <= m.interestUntilTick) {
        a.behavior = "approach";
        if (walk(run, a, target, 1.9, dt, extra)) {
          a.behavior = washing
            ? "wash"
            : lure.id === "tin"
              ? "inspect"
              : "investigate";
          a.remaining = RULES.inspectSeconds;
          m.interestPoint = [...lure.point];
          observe(
            run,
            washing
              ? "Food by the woodland rivulet: the raccoon rinses it with its front paws."
              : "The raccoon checks the lure for four seconds, then turns away or takes an unattended tin.",
          );
        }
        return;
      }
    }
  }
  a.behavior = "wander";
  a.remaining = Math.max(0, a.remaining - dt);
  if (a.remaining) return;
  if (
    !anchorsFor(run, a).some((anchor) => anchor.id === m.goal) ||
    flatDistance(a.pose.position, a.target) < 0.2
  ) {
    const resident = run.world.residents.find((r) => r.id === a.id)!,
      pocket = run.world.pockets.find((p) => p.id === resident.home)!,
      feed = pocket.anchors.find((a) => a.kind === "feed"),
      sharesHerons = run.world.residents.some(
        (r) => r.home === resident.home && r.species === "heron",
      );
    choose(
      run,
      a,
      m,
      anchorsFor(run, a)
        .filter(
          (anchor) =>
            ["ground", "wash", "rest", "retreat"].includes(anchor.kind) &&
            (!sharesHerons ||
              !feed ||
              flatDistance(anchor.point, feed.point) >= RULES.shyRadius + 1),
        )
        .map((anchor) => ({ id: anchor.id, point: anchor.point })),
      extra,
    );
  }
  if (walk(run, a, a.target, 1.1, dt, extra)) a.remaining = 2;
}
