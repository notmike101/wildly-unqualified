import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { Vector3 } from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createRun, addPlayer, snapshot } from "./game.ts";
import { distance, movePlayer, propPoint } from "./shared.ts";
import {
  PROP_DEFINITIONS,
  animalArticulation,
  subjectPoints,
} from "./level.ts";
import { alignLocalCarry } from "./view.ts";
import { findPart } from "./forest-view.ts";

test("predicted camera keeps carried geometry and its other holder together without changing authority", () => {
  const run = createRun();
  const local = addPlayer(run, "a", "A");
  const partner = addPlayer(run, "b", "B");
  const spectator = addPlayer(run, "c", "C");
  const item = run.props.find((p) => p.kind === "case")!;
  item.holders = [local.id, partner.id];
  const authority = snapshot(run);
  const render = structuredClone(authority);
  const handle = () =>
    propPoint(PROP_DEFINITIONS.case.handles[0], render.props[0].pose);
  const originalOffset = distance(handle(), local.position);
  const originalPartner = distance(
    render.players[1].position,
    render.props[0].pose.position,
  );
  const predicted = movePlayer(
    local,
    { seq: 1, x: 1, z: 0, yaw: 0, pitch: 0, run: true, crouch: false },
    11 / 60,
    [],
  );
  assert.ok(distance(predicted.position, local.position) > 0.9);
  alignLocalCarry(render, local.id, predicted.position);
  assert.ok(
    Math.abs(distance(handle(), predicted.position) - originalOffset) < 1e-10,
  );
  assert.ok(
    Math.abs(
      distance(render.players[1].position, render.props[0].pose.position) -
        originalPartner,
    ) < 1e-10,
  );
  assert.deepEqual(render.players[2].position, spectator.position);
  assert.deepEqual(snapshot(run), authority);
});

test("grazing and scanning photo points follow the actual imported deer rig", async () => {
  const bytes = await readFile(
    new URL("./public/models/deer-v3.glb", import.meta.url),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const model = gltf.scene.getObjectByName("Deer")!;
  const neck = findPart(model, "Neck")!,
    head = findPart(model, "Head")!;
  assert.ok(neck && head);
  const neckBase = neck.rotation.clone(),
    headBase = head.rotation.clone();
  const animal = createRun().animals.find((a) => a.species === "deer")!;
  for (const behavior of ["graze", "settle", "alert"] as const) {
    animal.behavior = behavior;
    for (const tick of [0, 81, 319]) {
      const pose = animalArticulation(animal, tick);
      neck.rotation.copy(neckBase);
      neck.rotation.x += pose.neckX;
      head.rotation.copy(headBase);
      head.rotation.x += pose.headX;
      head.rotation.y += pose.headY;
      model.position.set(...animal.pose.position);
      model.quaternion.set(...animal.pose.rotation);
      gltf.scene.updateMatrixWorld(true);
      const expected = subjectPoints(animal, tick).map((p) =>
        propPoint(p, animal.pose),
      );
      for (const [index, part] of ["PhotoBody", "PhotoHead"].entries()) {
        const actual = findPart(model, part)!
          .getWorldPosition(new Vector3())
          .toArray();
        assert.ok(
          actual.every((n, axis) => Math.abs(n - expected[index][axis]) < 1e-5),
          `${behavior} tick ${tick} ${part}: actual ${actual}, expected ${expected[index]}`,
        );
      }
    }
  }
});
