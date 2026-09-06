// Run with Node from any directory; optionally pass a models directory and manifest.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Box3, Vector3, PropertyBinding } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { validateBytes } from "gltf-validator";

const modelDir = process.argv[2] ?? fileURLToPath(new URL("../public/models/", import.meta.url));
const manifestPath = process.argv[3] ?? fileURLToPath(new URL("manifest-v1.json", import.meta.url));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const near = (actual, expected, label) => actual.forEach((value, i) =>
  assert.ok(Math.abs(value - expected[i]) < 0.0001, `${label}[${i}]: ${value} != ${expected[i]}`));
const requiredV3 = {
  Deer: ["Body", "Neck", "Head", "EarL", "EarR", "LegFL", "LegFR", "LegBL", "LegBR", "Tail"],
  ResearcherForest: ["Head", "ArmL", "ArmR", "LegL", "LegR", "Camera", "CameraGrip", "TinGrip", "HatMount"],
  FieldCase: ["Lid", "HandleL", "HandleR", "BaitStore"],
  CrossingPlank: ["HandleL", "HandleR", "SupportL", "SupportR"],
  FoldingScreen: ["PanelL", "PanelR", "HandleL", "HandleR"],
  WildlifeDecoy: ["BaitCup", "Handle"], ForestGate: ["GateLeaf", "Hinge", "Latch"],
};

for (const [name, expected] of Object.entries(manifest.assets)) {
  const bytes = await readFile(resolve(modelDir, `${name}.glb`));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expected.sha256, `${name} SHA-256`);
  if (manifest.version === 3) {
    const validation = await validateBytes(new Uint8Array(bytes));
    assert.equal(validation.issues.numErrors, 0, `${name} glTF validator errors`);
    assert.equal(validation.issues.numWarnings, 0, `${name} glTF validator warnings`);
  }
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  gltf.scene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(gltf.scene, true);
  near(bounds.min.toArray(), expected.bounds_min_m, `${name} minimum`);
  near(bounds.max.toArray(), expected.bounds_max_m, `${name} maximum`);
  for (const [part, node] of Object.entries(expected.nodes)) {
    const object = gltf.scene.getObjectByName(PropertyBinding.sanitizeNodeName(part));
    assert.ok(object, `${name} missing ${part}`);
    near(object.getWorldPosition(new Vector3()).toArray(), node.pivot_m, `${name}/${part} pivot`);
    if (node.parent) assert.equal(object.parent.name, PropertyBinding.sanitizeNodeName(node.parent), `${name}/${part} parent`);
  }
  for (const [part, prop] of Object.entries(expected.props ?? {})) {
    const object = gltf.scene.getObjectByName(part);
    const propBounds = new Box3().setFromObject(object, true);
    near(propBounds.min.toArray(), prop.bounds_min_m, `${part} minimum`);
    near(propBounds.max.toArray(), prop.bounds_max_m, `${part} maximum`);
    near(object.position.toArray(), [0, 0, 0], `${part} ground origin`);
    if (manifest.version === 3) {
      near([propBounds.min.y], [0], `${part} grounded geometry`);
      const semantic = new Map();
      let triangles = 0;
      const materials = new Set();
      object.traverse(child => {
        if (child.userData.partName) semantic.set(child.userData.partName, child);
        assert.ok(child.scale.toArray().every(value => value > 0), `${part} positive scale`);
        if (child.isMesh) {
          triangles += (child.geometry.index?.count ?? child.geometry.attributes.position.count) / 3;
          for (const material of Array.isArray(child.material) ? child.material : [child.material]) materials.add(material.name);
        }
      });
      assert.equal(triangles, prop.triangles, `${part} imported triangle count`);
      assert.equal(materials.size, prop.material_count, `${part} shared material count`);
      for (const key of requiredV3[part] ?? []) assert.ok(semantic.has(key), `${part} missing semantic attachment ${key}`);
      for (const [key, pivot] of Object.entries(prop.semantic_attachments ?? {}))
        near(semantic.get(key).getWorldPosition(new Vector3()).toArray(), pivot, `${part}/${key} semantic pivot`);
      if (part.startsWith("Mature")) assert.ok(prop.dimensions_m[1] >= 18 && prop.dimensions_m[1] <= 32, `${part} mature height`);
      if (part === "ResearcherForest" || part.startsWith("Hat")) assert.ok(materials.has("CrewAccent"), `${part} crew accent`);
      if (part === "FieldCase") {
        const lid = semantic.get("Lid");
        const old = lid.rotation.x;
        lid.rotation.x = lid.userData.open_radians;
        gltf.scene.updateMatrixWorld(true);
        assert.ok(new Box3().setFromObject(lid, true).max.y > 1, "Case lid opens above its container");
        lid.rotation.x = old; gltf.scene.updateMatrixWorld(true);
      }
    }
  }
  if (name === "researcher") {
    let outfit = false;
    gltf.scene.traverse(object => { if (object.material?.name === "Outfit") outfit = true; });
    assert.ok(outfit, "Researcher must retain recolourable Outfit material");
  }
  console.log(`${name}: SHA-256, imported bounds, hierarchy and ${Object.keys(expected.nodes).length} pivots passed`);
}
if (manifest.version === 3 && manifest.stage === "complete")
  assert.equal(Object.values(manifest.assets).reduce((count, asset) => count + Object.keys(asset.props).length, 0), 39, "v3 inventory");
