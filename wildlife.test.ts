import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  Vector3,
  Raycaster,
  DoubleSide,
  type Object3D,
  type Mesh,
} from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { findPart } from "./forest-view.ts";
import { subjectPoints } from "./level.ts";
import { wildlifeParts, rotate, xyz } from "./wildlife.ts";
import { ARCH_STANCES, SQUIRREL_CLIMB } from "./wildlife-data.ts";
import { type Animal, type Behavior } from "./shared.ts";

test("frozen v4 characteristic poses agree with real exported head/body attachments", async () => {
  const bytes = await readFile(
    new URL("./public/models/wildlife-kit-v4.glb", import.meta.url),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const actions: [Animal["species"], Behavior][] = [
    ["fox", "pounce"],
    ["rabbit", "nibble"],
    ["squirrel", "cache"],
    ["beaver", "gnaw"],
    ["otter", "groom"],
    ["badger", "dig"],
    ["owl", "roost"],
    ["woodpecker", "tap"],
    ["mallard", "dabble"],
  ];
  // Geometry-only fixtures: these do not establish action accessibility. That
  // comes from the ordinary-command, real-tick expedition-wildlife tests.
  for (const [species, action] of actions) {
    const source = findPart(
      gltf.scene,
      species[0].toUpperCase() + species.slice(1),
    )!;
    const model = source.clone(true);
    for (const behavior of [action, "wander" as const, action]) {
      const animal: Animal = {
        id: `pose-${species}`,
        species,
        behavior,
        pose: { position: [13, 2, -7], rotation: xyz([0.12, 1.2, -0.07]) },
        target: [14, 2, -8],
        remaining: 2,
      };
      const frozen = structuredClone(animal);
      const tick = 937;
      for (const [name, angles] of Object.entries(
        wildlifeParts(frozen, tick),
      )) {
        findPart(model, name)?.rotation.set(...angles, "XYZ");
      }
      model.position.set(...frozen.pose.position);
      model.quaternion.set(...frozen.pose.rotation);
      model.updateMatrixWorld(true);
      const actual = ["PhotoBody", "PhotoHead"].map((name) =>
        findPart(model, name)!.getWorldPosition(new Vector3()),
      );
      const expected = subjectPoints(frozen, tick).map((point) =>
        new Vector3(...rotate(point, frozen.pose.rotation)).add(
          new Vector3(...frozen.pose.position),
        ),
      );
      actual.forEach((point, i) =>
        assert.ok(
          point.distanceTo(expected[i]) < 0.00015,
          `${species}/${behavior}/${i}: CPU and exported hierarchy differ by ${point.distanceTo(expected[i])}m`,
        ),
      );
      animal.behavior = "alert";
      animal.pose.position[0] += 100;
      assert.deepEqual(
        subjectPoints(frozen, tick),
        subjectPoints(structuredClone(frozen), tick),
      );
    }
  }
});

test("calibrated crown pose data retains proper unit rotations", () => {
  assert.equal(ARCH_STANCES.length, 4);
  for (const pose of ARCH_STANCES) {
    assert.ok(Math.abs(Math.hypot(...pose.rotation) - 1) < 1e-10);
    assert.ok(pose.position[1] > 3.6 && pose.position[1] < 4);
  }
});

test("actual moving squirrel meshes retain bark contact without material body/head penetration", async () => {
  async function load(file: string, name: string) {
    const bytes = await readFile(
      new URL(`./public/models/${file}.glb`, import.meta.url),
    );
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    const root = findPart(gltf.scene, name)!;
    root.removeFromParent();
    root.position.set(0, 0, 0);
    root.quaternion.identity();
    root.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh)
        for (const m of Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material])
          m.side = DoubleSide;
    });
    root.updateMatrixWorld(true);
    return root;
  }
  const tree = await load("forest-kit-v3", "RootArch"),
    model = await load("wildlife-kit-v4", "Squirrel");
  function points(name: string) {
    const root = findPart(model, name)!,
      result: Vector3[] = [];
    function visit(o: Object3D) {
      if (o !== root && o.userData.partName) return;
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        const p = mesh.geometry.attributes.position;
        for (let i = 0; i < p.count; i++)
          result.push(
            new Vector3()
              .fromBufferAttribute(p, i)
              .applyMatrix4(mesh.matrixWorld),
          );
      }
      for (const c of o.children) visit(c);
    }
    visit(root);
    return result;
  }
  for (let i = 0; i < SQUIRREL_CLIMB.length; i++) {
    const at = SQUIRREL_CLIMB[i],
      wrap = Math.max(0, (i - 60) / 24);
    const animal: Animal = {
      id: "mesh-climber",
      species: "squirrel",
      behavior: "climb",
      pose: at,
      target: at.position,
      remaining: -1 + (0.99 * i) / 84,
    };
    for (const [name, angles] of Object.entries(wildlifeParts(animal, 900)))
      findPart(model, name)?.rotation.set(...angles, "XYZ");
    model.position.set(...at.position);
    model.quaternion.set(...at.rotation);
    model.updateMatrixWorld(true);
    const normal = new Vector3(
      0,
      Math.sin((wrap * Math.PI) / 2),
      Math.cos((wrap * Math.PI) / 2),
    );
    const hindGaps: number[] = [];
    for (const name of [
      "Body",
      "Head",
      "LegBL",
      "LegBR",
      "ForepawL",
      "ForepawR",
    ]) {
      const gaps = points(name).map((p) => {
        const hit = new Raycaster(
          p.clone().addScaledVector(normal, 2),
          normal.clone().negate(),
          0,
          4,
        ).intersectObject(tree, true)[0];
        return hit ? p.clone().sub(hit.point).dot(normal) : Infinity;
      });
      const minimum = Math.min(...gaps);
      assert.ok(
        minimum >= -0.003,
        `${name} penetrates arch at sample ${i}: ${minimum}m`,
      );
      if (name === "LegBL" || name === "LegBR") hindGaps.push(minimum);
    }
    assert.ok(
      Math.min(...hindGaps) < 0.005,
      `both hind paws lose bark support at ${i}`,
    );
  }
});
