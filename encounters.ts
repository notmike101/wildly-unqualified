/** Wildlife decision scheduling and species dispatch; public navigation exports stay compatible. */
import type { RunState } from "./game.ts";
import { PROP_DEFINITIONS, RULES } from "./level.ts";
import { distance, propBoxes, type Vec3 } from "./shared.ts";
import { anchorsFor, homeFor } from "./animal-context.ts";
import { flatDistance, routeTo, walk } from "./animal-navigation.ts";
import {
  observe,
  goal,
  choose,
  disturbed,
  approachPoint,
} from "./animal-behavior.ts";
import { raccoonStep } from "./raccoon.ts";
import { wildlifeStep } from "./animal-routines.ts";
export { type AnimalMemory } from "./animal-context.ts";
export { animalRoute, localRecoveryPoint } from "./animal-navigation.ts";

export function stepAnimals(run: RunState, dt: number): void {
  const extra = run.props
    .filter((p) => !(p.kind === "plank" && p.placed))
    .flatMap((p) => propBoxes(p, PROP_DEFINITIONS[p.kind]));
  for (const a of run.animals) {
    const m = run.animalMemory[a.id];
    if (a.species === "raccoon") {
      raccoonStep(run, a, m, dt, extra);
      continue;
    }
    if (a.species !== "deer" && a.species !== "heron") {
      const nearbyCrew = run.players.some(
        (p) => p.connected && distance(p.position, a.pose.position) < 48,
      );
      if (nearbyCrew || run.tick % 30 === 0)
        wildlifeStep(run, a, m, nearbyCrew ? dt : 0.5, extra);
      continue;
    }
    const habitat = a.species === "deer" ? "clearing" : "wetland",
      home = homeFor(run, a),
      feed = anchorsFor(run, a).find((anchor) => anchor.kind === "feed"),
      noisy = disturbed(run, a, extra);
    if (noisy && !["alert", "retreat"].includes(a.behavior)) {
      a.behavior = "alert";
      a.remaining = 0.7;
      observe(
        run,
        `${a.species === "deer" ? "Deer" : "Heron"} alert: use cover, keep back, and stop making noise.`,
      );
    }
    if (a.behavior === "alert") {
      a.remaining = Math.max(0, a.remaining - dt);
      if (!a.remaining) {
        const threat =
          run.players
            .filter((p) => p.connected)
            .sort(
              (p, q) =>
                distance(p.position, a.pose.position) -
                distance(q.position, a.pose.position),
            )[0]?.position ?? home;
        const choices = [
          {
            id: `${habitat}-near`,
            point: [home[0] - 4, 0, home[2] - 1] as Vec3,
          },
          {
            id: `${habitat}-far`,
            point: [home[0] + 4, 0, home[2] + 3] as Vec3,
          },
        ].sort((p, q) => distance(q.point, threat) - distance(p.point, threat));
        const choice =
          choices.find(
            (c) =>
              c.id !== m.goal &&
              routeTo(a.pose.position, c.point, run, extra).length,
          ) ??
          choices.find(
            (c) => routeTo(a.pose.position, c.point, run, extra).length,
          );
        if (choice) {
          goal(m, choice.id);
          a.target = [...choice.point];
        }
        a.behavior = "retreat";
      }
      continue;
    }
    if (a.behavior === "retreat") {
      if (walk(run, a, a.target, 2.8, dt, extra)) {
        a.behavior = "settle";
        a.remaining = RULES.quietSeconds;
      }
      continue;
    }
    if (a.behavior === "settle") {
      a.remaining = Math.max(0, a.remaining - dt);
      if (!a.remaining) a.behavior = a.species === "deer" ? "graze" : "preen";
      continue;
    }
    if (a.species === "heron") {
      if (a.behavior === "display") {
        a.remaining = Math.max(0, a.remaining - dt);
        if (!a.remaining) {
          a.behavior = "preen";
          a.remaining = 3;
        }
        continue;
      }
      if (feed && run.baitPatches[feed.id] > 0) {
        if (a.behavior !== "feed") {
          a.remaining = RULES.quietSeconds;
          goal(m, "wetland-feed");
        }
        a.behavior = "feed";
        if (walk(run, a, feed!.point, 1.6, dt, extra)) {
          a.remaining = Math.max(0, a.remaining - dt);
          if (!a.remaining) {
            run.baitPatches[feed!.id]--;
            a.behavior = "display";
            a.remaining = RULES.displaySeconds;
            observe(
              run,
              "Quiet feeding earns a six-second wing display at the selected wetland patch.",
            );
          }
        }
      } else {
        a.remaining = Math.max(0, a.remaining - dt);
        if (!a.remaining && a.behavior !== "wander") {
          choose(
            run,
            a,
            m,
            [
              { id: "wetland-preen", point: home },
              { id: "wetland-rest", point: [home[0] - 2, 0, home[2] + 1] },
            ],
            extra,
          );
          a.behavior = "wander";
        }
        if (a.behavior === "wander" && walk(run, a, a.target, 1.2, dt, extra)) {
          a.behavior = "preen";
          a.remaining = 6;
        }
      }
    } else {
      const decoy = run.props.find(
          (p) =>
            p.kind === "decoy" &&
            !p.holders.some(Boolean) &&
            flatDistance(p.pose.position, a.pose.position) < 10,
        ),
        changed =
          decoy &&
          (!m.interestPoint ||
            flatDistance(m.interestPoint, decoy.pose.position) > 1.2);
      if (decoy && (changed || run.tick >= m.habituatedUntilTick)) {
        if (changed || m.goal !== "deer-decoy") {
          goal(m, "deer-decoy");
          m.interestPoint = [...decoy.pose.position];
          m.interestUntilTick = run.tick + 720;
          m.habituatedUntilTick = 0;
        }
        const target = approachPoint(
          run,
          a,
          decoy.pose.position,
          extra,
          1.4,
          decoy.id,
        );
        if (target && run.tick < m.interestUntilTick) {
          a.behavior = "approach";
          if (walk(run, a, target, 0.9, dt, extra)) a.behavior = "investigate";
          continue;
        }
        m.habituatedUntilTick = run.tick + 480;
      }
      if (!decoy) {
        if (
          !m.goal.startsWith("deer-trail:") &&
          run.tick % (2400 + Number(a.id.split("-").at(-1)) * 60) < 6
        ) {
          m.goal = "deer-trail:0";
          a.remaining = -1;
        }
        if (m.goal.startsWith("deer-trail:")) {
          const passage = anchorsFor(run, a).filter(
            (p) => p.kind === "passage" && !p.id.endsWith("-start"),
          );
          const index = Number(m.goal.split(":")[1]),
            trail = [passage[1], passage[2], passage[0]];
          if (a.behavior === "passage" && a.remaining >= 0) {
            a.remaining = Math.max(0, a.remaining - dt);
            if (!a.remaining) {
              m.goal = "";
              a.behavior = "graze";
              a.remaining = 5;
            }
          } else {
            a.behavior = "wander";
            if (walk(run, a, trail[index].point, 0.9, dt, extra)) {
              if (index === 2) {
                a.behavior = "passage";
                a.remaining = 5;
              } else m.goal = `deer-trail:${index + 1}`;
            }
          }
          continue;
        }
      }
      if (a.behavior !== "graze" && a.behavior !== "wander") {
        a.behavior = "graze";
        a.remaining = 5;
      }
      a.remaining = Math.max(0, a.remaining - dt);
      if (!a.remaining && a.behavior !== "wander") {
        choose(
          run,
          a,
          m,
          [
            { id: "clearing-graze", point: home },
            { id: "clearing-scan", point: [home[0] + 2, 0, home[2] + 2] },
          ],
          extra,
        );
        a.behavior = "wander";
      }
      if (a.behavior === "wander" && walk(run, a, a.target, 0.7, dt, extra)) {
        a.behavior = m.goal === "clearing-scan" ? "settle" : "graze";
        a.remaining = m.goal === "clearing-scan" ? 2 : 5;
      }
    }
  }
}
