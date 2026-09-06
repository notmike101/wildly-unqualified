// Actual GLTFLoader and Khronos validation; optional --representatives checks the first milestone.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Box3, Vector3, Raycaster } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { validateBytes } from "gltf-validator";

const source = new URL("./", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest-v4.json", source), "utf8"),
);
const representatives = process.argv.includes("--representatives");
const animalsOnly = process.argv.includes("--animals");
const inventory = [
  "Fox",
  "Rabbit",
  "Squirrel",
  "Beaver",
  "Otter",
  "Badger",
  "Owl",
  "Woodpecker",
  "Mallard",
  "BeaverLodge",
  "BranchPile",
  "BadgerDen",
  "SquirrelCache",
];
const names = representatives
  ? ["Fox", "Squirrel", "Owl"]
  : animalsOnly
    ? inventory.slice(0, 9)
    : inventory;
assert.deepEqual(
  Object.keys(manifest.contract).sort(),
  [...inventory].sort(),
  "exact nine animals and four habitat props",
);
assert.equal(manifest.version, 4);
const near = (a, b, label) =>
  a.forEach((v, i) =>
    assert.ok(Math.abs(v - b[i]) < 0.00015, `${label}[${i}]: ${v} != ${b[i]}`),
  );
for (const [file, hash] of Object.entries(manifest.sources ?? {}))
  assert.equal(
    createHash("sha256")
      .update(await readFile(new URL(file, source)))
      .digest("hex"),
    hash,
    `${file} source hash`,
  );
if (manifest.scene_sha256)
  assert.equal(
    createHash("sha256")
      .update(await readFile(new URL("library-v4.blend", source)))
      .digest("hex"),
    manifest.scene_sha256,
    "saved Blender scene hash",
  );
for (const [file, hash] of Object.entries(manifest.previews ?? {}))
  assert.equal(
    createHash("sha256")
      .update(await readFile(new URL(file, source)))
      .digest("hex"),
    hash,
    `${file} preview hash`,
  );
const loaded = new Map();
for (const name of names) {
  const contract = manifest.contract[name];
  assert.ok(
    manifest.assets?.[contract.file]?.props?.[name],
    `${name}: v4 model has not been built/exported`,
  );
  if (!loaded.has(contract.file)) {
    const bytes = await readFile(
      new URL(`../public/models/${contract.file}.glb`, source),
    );
    const validation = await validateBytes(new Uint8Array(bytes));
    assert.equal(
      validation.issues.numErrors,
      0,
      JSON.stringify(validation.issues),
    );
    assert.equal(
      validation.issues.numWarnings,
      0,
      JSON.stringify(validation.issues),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      manifest.assets[contract.file].sha256,
      `${contract.file} hash`,
    );
    const gltf = await new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    gltf.scene.updateMatrixWorld(true);
    loaded.set(contract.file, gltf.scene);
  }
  const scene = loaded.get(contract.file);
  const root = scene.getObjectByName(name);
  assert.ok(root, `${name} addressable root`);
  near(root.position.toArray(), [0, 0, 0], `${name} grounded origin`);
  const expected = manifest.assets[contract.file].props[name];
  const bounds = new Box3().setFromObject(root, true);
  near(bounds.min.toArray(), expected.bounds_min_m, `${name} minimum`);
  near(bounds.max.toArray(), expected.bounds_max_m, `${name} maximum`);
  near([bounds.min.y], [0], `${name} grounded geometry`);
  const size = bounds.getSize(new Vector3()).toArray();
  size.forEach((value, i) =>
    assert.ok(
      value >= contract.min[i] && value <= contract.max[i],
      `${name} metre dimension ${i}: ${value}`,
    ),
  );
  const semantic = new Map();
  let triangles = 0;
  root.traverse((child) => {
    near(
      child.scale.toArray(),
      [1, 1, 1],
      `${name}/${child.name} applied scale`,
    );
    // GLTFLoader splits a multi-material node into primitive children without extras.
    // Animation binds the authored parent by partName, never a generated name suffix.
    assert.ok(
      child.userData.partName ||
        (child.isMesh && child.parent.userData.partName),
      `${name}/${child.name} semantic node or material-primitive parent`,
    );
    if (child.userData.partName) {
      assert.ok(
        !semantic.has(child.userData.partName),
        `${name} unique semantic ${child.userData.partName}`,
      );
      semantic.set(child.userData.partName, child);
    }
    if (child.isMesh)
      triangles +=
        (child.geometry.index?.count ??
          child.geometry.attributes.position.count) / 3;
  });
  assert.equal(triangles, expected.triangles, `${name} triangle count`);
  assert.ok(triangles < 6500, `${name} low-poly budget`);
  for (const part of contract.parts)
    assert.ok(semantic.has(part), `${name}/${part} required pivot`);
  for (const [part, position] of Object.entries(expected.attachments))
    near(
      semantic.get(part).getWorldPosition(new Vector3()).toArray(),
      position,
      `${name}/${part} attachment`,
    );
  for (const [part, parent] of Object.entries(expected.parents))
    assert.equal(
      semantic.get(part).parent.userData.partName,
      parent,
      `${name}/${part} animated parent`,
    );
  for (const part of contract.parts.filter((part) => part.startsWith("Photo")))
    assert.ok(
      bounds
        .clone()
        .expandByScalar(0.02)
        .containsPoint(semantic.get(part).getWorldPosition(new Vector3())),
      `${name}/${part} on photographed geometry`,
    );
  if (semantic.has("PhotoHead")) {
    const head = semantic.get("Head");
    const point = semantic.get("PhotoHead");
    const before = point.getWorldPosition(new Vector3());
    head.rotation.y += 0.5;
    scene.updateMatrixWorld(true);
    assert.ok(
      point.getWorldPosition(new Vector3()).distanceTo(before) > 0.001,
      `${name} photo head follows articulated head`,
    );
    head.rotation.y -= 0.5;
    scene.updateMatrixWorld(true);
    near(
      point.getWorldPosition(new Vector3()).toArray(),
      before.toArray(),
      `${name} articulation restores`,
    );
    assert.ok(expected.action_bounds, `${name} measured action-pose bounds`);
    for (const [part, rotation] of Object.entries(
      expected.pose_rotations_xyz_radians,
    ))
      semantic.get(part).rotation.set(...rotation);
    scene.updateMatrixWorld(true);
    const posed = new Box3().setFromObject(root, true);
    near(
      posed.min.toArray(),
      expected.action_bounds.min,
      `${name} action minimum`,
    );
    near(
      posed.max.toArray(),
      expected.action_bounds.max,
      `${name} action maximum`,
    );
    for (const [part, position] of Object.entries(expected.action_photo_points))
      near(
        semantic.get(part).getWorldPosition(new Vector3()).toArray(),
        position,
        `${name}/${part} actual action point`,
      );
    for (const part of Object.keys(expected.pose_rotations_xyz_radians))
      semantic.get(part).rotation.set(0, 0, 0);
    scene.updateMatrixWorld(true);
  }
  if (name === "BadgerDen" || name === "BeaverLodge") {
    assert.equal(
      new Raycaster(
        new Vector3(0, 0.22, -2),
        new Vector3(0, 0, 1),
        0,
        4,
      ).intersectObject(root, true).length,
      0,
      `${name} actual hollow entrance`,
    );
    for (const x of [-0.24, 0, 0.24])
      assert.equal(
        new Raycaster(
          new Vector3(x, 0.61, -2),
          new Vector3(0, 0, 1),
          0,
          4,
        ).intersectObject(root, true).length,
        0,
        `${name} animal-height entrance clearance`,
      );
    assert.ok(
      expected.colliders.length >= 3,
      `${name} open-shell collision proxies`,
    );
    for (const collider of expected.colliders)
      assert.ok(
        !(
          collider.min[0] < 0.25 &&
          collider.max[0] > -0.25 &&
          collider.min[1] < 0.62
        ),
        `${name} proxy leaves animal-height central passage open`,
      );
  }
  console.log(
    `${name}: real GLTFLoader geometry, grounded metres, pivots, semantics and validator passed (${triangles} triangles)`,
  );
}
for (const [file, scene] of loaded) {
  let library;
  scene.traverse((object) => {
    if (object.userData.partName === file) library = object;
  });
  assert.ok(library, `${file} semantic library root`);
  assert.deepEqual(
    library.children.map((object) => object.userData.partName).sort(),
    Object.keys(manifest.assets[file].props).sort(),
    `${file} exact exported model inventory`,
  );
}
console.log(
  `${names.length} v4 roots verified${representatives ? " (representative milestone only)" : animalsOnly ? " (animals milestone only)" : ""}`,
);
