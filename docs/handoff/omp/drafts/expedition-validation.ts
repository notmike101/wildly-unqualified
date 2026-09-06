// Accelerated acceptance: all progress uses production commands, ticks and
// native physics. Read-only world/pose guidance is not player playtime evidence.
import assert from "node:assert/strict";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { applyCommand, snapshot, advanceRun, type RunState } from "./game.ts";
import { animalRoute } from "./encounters.ts";
import { distance, type Vec3 } from "./shared.ts";
import {
  crew,
  command,
  input,
  walkTo,
  cameraApproach,
  until,
  aim,
  aimPoint,
} from "./expedition-test-helpers.ts";
import { feedingSetup } from "./expedition-equipment-helpers.ts";

const output = process.env.WU_CAPTURE_DIR;
assert.ok(output, "Set WU_CAPTURE_DIR to a new owned evidence directory");
await mkdir(output, { recursive: true });
async function capture(
  run: RunState,
  name: string,
  subjects: string[],
  result = command(run, "photo")!,
) {
  const file = join(output!, name + ".json");
  await writeFile(
    file + ".tmp",
    JSON.stringify({
      name,
      world: run.world,
      frame: result.frame,
      snapshot: snapshot(run),
      verdict: result.verdict,
      subjectIds: subjects,
    }),
  );
  await rename(file + ".tmp", file);
  console.log(
    JSON.stringify({
      name,
      tick: run.tick,
      credits: result.verdict.credits,
      reason: result.verdict.reason,
    }),
  );
  return result;
}
async function completeLoop() {
  const run = crew(6);
  console.log("loop seed6 started");
  // Photograph the natural nibble before the placed open tin invites feeding.
  const natural = run.world.commissions.find(
    (c) => c.kind === "behavior" && c.behavior === "nibble",
  )!;
  const rabbit = run.animals.find((a) => a.id === natural.subjects[0])!;
  cameraApproach(run, rabbit.id);
  until(run, () => rabbit.behavior === "nibble", 150);
  aim(run, rabbit);
  const first = await capture(run, "loop-natural-rabbit", [rabbit.id]);
  assert.ok(first.verdict.credits.includes(natural.id), first.verdict.reason);
  for (const p of animalRoute(run.players[0].position, "camp", run))
    walkTo(run, p);
  const setup = feedingSetup(run);
  await capture(
    run,
    "loop-equipment",
    run.world.commissions.find((c) => c.kind === "setup")!.subjects,
    setup,
  );
  for (const c of run.world.commissions.filter(
    (c) => c.required && !run.completed.includes(c.id),
  )) {
    const animals = c.subjects.map((id) =>
      run.animals.find((a) => a.id === id)!,
    );
    const a = animals[0];
    const anchor = run.world.pockets
      .find((p) => p.id === c.pocket)!
      .anchors.find((a) => a.id === c.anchor)!;
    cameraApproach(run, a.id);
    if (c.kind === "pair") {
      until(
        run,
        () =>
          animals.every(
            (a) =>
              ["graze", "nibble", "gnaw", "preen"].includes(a.behavior) &&
              distance(a.pose.position, anchor.point) < 3,
          ),
        180,
      );
      aimPoint(
        run,
        a.pose.position.map(
          (v, i) =>
            (v + animals[1].pose.position[i]) / 2 + (i === 1 ? 0.45 : 0),
        ) as Vec3,
      );
    } else if (c.kind === "composition") {
      until(
        run,
        () =>
          distance(a.pose.position, anchor.point) < 1.7 &&
          ["cache", "gnaw", "preen", "graze"].includes(a.behavior),
        180,
      );
      const landmark = run.world.placements.find((p) => p.id === c.landmark)!;
      aimPoint(
        run,
        a.pose.position.map(
          (v, i) => (v + landmark.position[i]) / 2 + (i === 1 ? 0.4 : 0),
        ) as Vec3,
      );
    } else {
      until(
        run,
        () =>
          a.behavior === c.behavior &&
          (c.kind !== "passage" || distance(a.pose.position, anchor.point) < 2),
        180,
      );
      aim(run, a);
    }
    const result = await capture(
      run,
      "loop-" + c.kind + "-" + a.species,
      c.subjects,
    );
    assert.ok(
      result.verdict.credits.includes(c.id),
      `${c.id}: ${result.verdict.reason}`,
    );
  }
  for (const p of animalRoute(run.players[0].position, "camp", run))
    walkTo(run, p);
  command(run, "ready-end");
  const b = run.players.find((p) => p.id === "b")!;
  applyCommand(run, b.id, {
    worldId: run.worldId,
    type: "ready-end",
    seq: b.lastSeq + 1,
  });
  command(run, "finish");
  assert.equal(run.phase, "exhibition");
  assert.ok(
    run.world.commissions
      .filter((c) => c.required)
      .every((c) => run.completed.includes(c.id)),
  );
  await writeFile(
    join(output!, "loop-result.json"),
    JSON.stringify({
      seed: 6,
      tick: run.tick,
      phase: run.phase,
      completed: run.completed,
      ready: run.ready,
      players: run.players.map((p) => ({ id: p.id, position: p.position })),
      required: run.world.commissions
        .filter((c) => c.required)
        .map((c) => c.id),
    }),
  );
  console.log("complete six-goal loop returned and exhibited");
}
async function speciesFrames() {
  for (const [species, behavior, kind] of [
    ["fox", "pounce", "passage"],
    ["rabbit", "nibble", "feed"],
    ["squirrel", "cache", "cache"],
    ["beaver", "gnaw", "feed"],
    ["otter", "groom", "rest"],
    ["badger", "dig", "den"],
    ["owl", "roost", "perch"],
    ["woodpecker", "tap", "perch"],
    ["mallard", "dabble", "water"],
    ["deer", "graze", "feed"],
    ["heron", "preen", "rest"],
    ["raccoon", "wash", "wash"],
  ] as const) {
    const run = crew(7),
      a = run.animals.find((a) => a.species === species)!;
    if (species === "raccoon") {
      walkTo(run, [
        run.tin.pose.position[0],
        0,
        run.tin.pose.position[2] - 0.7,
      ]);
      command(run, "interact");
    }
    cameraApproach(run, a.id);
    if (species === "raccoon") command(run, "use");
    const resident = run.world.residents.find((r) => r.id === a.id)!;
    const anchor = run.world.pockets
      .find((p) => p.id === resident.home)!
      .anchors.find(
        (p) =>
          p.kind === kind &&
          resident.anchors.includes(p.id) &&
          !p.id.endsWith("-start"),
      )!;
    until(
      run,
      () =>
        a.behavior === behavior && distance(a.pose.position, anchor.point) < 2,
      180,
    );
    if (species === "fox")
      for (let i = 0; i < 18; i++) {
        input(run);
        advanceRun(run, 1 / 60);
      }
    aim(run, a);
    const result = await capture(run, "action-" + species, [a.id]);
    assert.ok(
      !/hidden|small|behind|inside/.test(result.verdict.reason),
      species + ": " + result.verdict.reason,
    );
    const extra =
      species === "squirrel"
        ? "climb"
        : species === "otter"
          ? "surface"
          : species === "woodpecker"
            ? "fly"
            : null;
    if (extra) {
      until(
        run,
        () =>
          a.behavior === extra &&
          (extra !== "climb" ||
            (a.pose.position[1] > 1 && a.pose.position[1] < 3)),
        180,
      );
      aim(run, a);
      await capture(run, "transition-" + species, [a.id]);
    }
  }
}
if (process.argv.includes("--loop")) await completeLoop();
if (process.argv.includes("--species")) await speciesFrames();
