import assert from "node:assert/strict";
import { test } from "node:test";
import { distance, type Vec3 } from "./shared.ts";
import { evaluatePhoto } from "./game.ts";
import {
  crew,
  cameraApproach,
  until,
  aim,
  command,
  aimPoint,
} from "./expedition-test-helpers.ts";

test("an actual new-species action earns its bound behavior commission through the ordinary shutter", () => {
  const run = crew(7);
  const commission = run.world.commissions.find(
    (c) => c.behavior === "pounce",
  )!;
  const fox = run.animals.find((a) => a.id === commission.subjects[0])!;
  cameraApproach(run, fox.id);
  until(run, () => fox.behavior === "pounce");
  aim(run, fox);
  const result = command(run, "photo")!;
  assert.ok(
    !/hidden|small|behind|inside/.test(result.verdict.reason),
    result.verdict.reason,
  );
  assert.ok(
    result.verdict.credits.includes(commission.id),
    `missing exact-instance new behavior credit: ${result.verdict.reason}`,
  );
  assert.ok(run.completed.includes(commission.id));
});

for (const seed of [0, 1, 2])
  test(`seed ${seed} bound passage is earned only after its resident's actual circuit`, () => {
    const run = crew(seed),
      commission = run.world.commissions.find((c) => c.kind === "passage")!;
    const animal = run.animals.find((a) => a.id === commission.subjects[0])!;
    cameraApproach(run, animal.id);
    const anchor = run.world.pockets
      .find((p) => p.id === commission.pocket)!
      .anchors.find((a) => a.id === commission.anchor)!;
    until(
      run,
      () =>
        animal.behavior === "passage" &&
        distance(animal.pose.position, anchor.point) < 2,
      150,
    );
    aim(run, animal);
    const result = command(run, "photo")!;
    assert.ok(
      result.verdict.credits.includes(commission.id),
      result.verdict.reason,
    );
    const wrong = structuredClone(result.frame);
    wrong.animals = wrong.animals.filter((a) => a.id !== animal.id);
    assert.ok(
      !evaluatePhoto(wrong, run.world).credits.includes(commission.id),
      "another resident cannot stand in for the bound circuit",
    );
  });

test("one actual beaver landmark photograph earns composition, behavior and optional cameo without waiving cropping", () => {
  const run = crew(7),
    commission = run.world.commissions.find((c) => c.kind === "composition")!;
  const animal = run.animals.find((a) => a.id === commission.subjects[0])!;
  const landmark = run.world.placements.find(
    (p) => p.id === commission.landmark,
  )!;
  cameraApproach(run, animal.id);
  until(run, () => animal.behavior === "gnaw");
  aimPoint(
    run,
    animal.pose.position.map(
      (v, i) => (v + landmark.position[i]) / 2 + (i === 1 ? 0.4 : 0),
    ) as Vec3,
  );
  const result = command(run, "photo")!;
  assert.ok(
    result.verdict.credits.includes(commission.id),
    result.verdict.reason,
  );
  assert.ok(
    result.verdict.credits.includes(
      run.world.commissions.find(
        (c) => c.kind === "behavior" && c.subjects.includes(animal.id),
      )!.id,
    ),
  );
  assert.ok(
    result.verdict.credits.includes(
      run.world.commissions.find((c) => c.kind === "cameo")!.id,
    ),
  );
  // Mutate only a saved geometry fixture to isolate the framing predicate; the
  // positive shot above was earned using commands and an actual action.
  const cropped = structuredClone(result.frame);
  cropped.camera.yaw += Math.PI;
  assert.ok(!evaluatePhoto(cropped, run.world).credits.includes(commission.id));
});

for (const seed of [1, 7])
  test(`seed ${seed} calm feeding pair is available without borrowing the tin`, () => {
    const run = crew(seed),
      commission = run.world.commissions.find((c) => c.kind === "pair")!;
    const animals = commission.subjects.map((id) =>
      run.animals.find((a) => a.id === id)!,
    );
    cameraApproach(run, animals[0].id);
    const anchor = run.world.pockets
      .find((p) => p.id === commission.pocket)!
      .anchors.find((a) => a.id === commission.anchor)!;
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
      animals[0].pose.position.map(
        (v, i) => (v + animals[1].pose.position[i]) / 2 + (i === 1 ? 0.45 : 0),
      ) as Vec3,
    );
    const result = command(run, "photo")!;
    assert.ok(
      result.verdict.credits.includes(commission.id),
      result.verdict.reason,
    );
    assert.equal(run.tin.holder, null);
  });

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
] as const)
  test(`${species} reaches its bound ${behavior} site through actual ticks and can be framed`, () => {
    const run = crew(7),
      resident = run.world.residents.find((r) => r.species === species)!;
    const animal = run.animals.find((a) => a.id === resident.id)!;
    const anchor = run.world.pockets
      .find((p) => p.id === resident.home)!
      .anchors.find(
        (a) =>
          a.kind === kind &&
          resident.anchors.includes(a.id) &&
          !a.id.endsWith("-start"),
      )!;
    cameraApproach(run, animal.id);
    until(
      run,
      () =>
        animal.behavior === behavior &&
        distance(animal.pose.position, anchor.point) < 2,
      150,
    );
    aim(run, animal);
    const result = command(run, "photo")!;
    assert.ok(
      !/hidden|small|behind|inside/.test(result.verdict.reason),
      `${species}: ${result.verdict.reason}`,
    );
  });
