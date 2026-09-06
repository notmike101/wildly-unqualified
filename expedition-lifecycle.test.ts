import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { advanceRun, disconnectPlayer, addPlayer } from "./game.ts";
import { saveRun, loadRun } from "./save.ts";
import { animalRoute } from "./encounters.ts";
import {
  crew,
  walkTo,
  cameraApproach,
  command,
  input,
  until,
} from "./expedition-test-helpers.ts";

test("four actual bait uses exhaust the shared tin and the local station refills it", () => {
  const run = crew(7),
    tin = run.tin.pose.position;
  walkTo(run, [tin[0], 0, tin[2] - 0.7]);
  command(run, "interact");
  assert.equal(run.tin.holder, "a");
  const resident = run.world.residents.find((r) => r.species === "heron")!;
  cameraApproach(run, resident.id);
  const feed = run.world.pockets
    .find((p) => p.id === resident.home)!
    .anchors.find((a) => a.kind === "feed")!;
  walkTo(run, [feed.point[0], 0, feed.point[2] + 1.8]);
  for (let portion = 0; portion < 4; portion++) {
    command(run, "use");
    for (let i = 0; i < 181; i++) {
      input(run);
      advanceRun(run, 1 / 60);
    }
  }
  assert.equal(run.tin.portions, 0);
  assert.equal(run.baitPatches[feed.id], 4);
  assert.throws(() => command(run, "use"), /empty/);
  const station = run.world.stations.find(
    (s) => s.id === `station-${resident.home.slice(1)}`,
  )!;
  assert.ok(station, "this real patch has its nearby generated field station");
  for (const point of animalRoute(
    run.players[0].position,
    `${resident.home}-camera-a`,
    run,
  ))
    walkTo(run, point);
  for (let i = 0; i < 181; i++) {
    input(run);
    advanceRun(run, 1 / 60);
  }
  command(run, "use");
  assert.equal(run.tin.portions, 4);
  assert.equal(run.spareBait, 8);
});

test("a real climbing capture and resident phase survive pause, save, disconnect and rejoin", async (t) => {
  let run = crew(7);
  const animal = run.animals.find((a) => a.species === "squirrel")!;
  cameraApproach(run, animal.id);
  until(
    run,
    () =>
      animal.behavior === "climb" &&
      animal.pose.position[1] > 1 &&
      animal.pose.position[1] < 3,
    150,
  );
  const result = command(run, "photo")!;
  disconnectPlayer(run, "b");
  assert.ok(run.paused);
  const frozen = structuredClone({
    animals: run.animals,
    memory: run.animalMemory,
    pending: run.pendingPhotos,
    completed: run.completed,
  });
  const dir = await mkdtemp(join(tmpdir(), "wu-routine-rejoin-"));
  t.after(async () => {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    await rm(dir, { recursive: true, force: true });
  });
  await saveRun(dir, run, new Map());
  run = (await loadRun(dir))!.run;
  assert.deepEqual(
    {
      animals: run.animals,
      memory: run.animalMemory,
      pending: run.pendingPhotos,
      completed: run.completed,
    },
    frozen,
  );
  addPlayer(run, "b", "B");
  command(run, "resume");
  until(
    run,
    () => run.animals.find((a) => a.id === animal.id)!.behavior === "cache",
    150,
  );
  assert.deepEqual(
    run.pendingPhotos[result.frame.id],
    result.frame,
    "later movement does not rewrite the captured complete scene",
  );
});
