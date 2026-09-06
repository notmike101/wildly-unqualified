import * as THREE from "three/webgpu";
import { SkyMesh } from "three/addons/objects/SkyMesh.js";
import type { ReserveBlueprint } from "./world.ts";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { WorldPlacement } from "./level.ts";
import { surfaceHeight, type FixtureState, type Vec3 } from "./shared.ts";

export function findPart(root: THREE.Object3D, name: string) {
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (o.userData.partName === name) found ??= o;
  });
  return found ?? root.getObjectByName(name);
}

/** Share mesh buffers while preserving the complete imported part transform. */
export function instanceModel(
  model: THREE.Object3D,
  placements: WorldPlacement[],
): THREE.Group {
  const group = new THREE.Group();
  group.name = model.name;
  model.updateWorldMatrix(true, true);
  const transform = new THREE.Object3D(),
    matrix = new THREE.Matrix4();
  model.traverse((part) => {
    if (!(part instanceof THREE.Mesh)) return;
    const instances = new THREE.InstancedMesh(
      part.geometry,
      part.material,
      placements.length,
    );
    instances.name = part.name;
    instances.castShadow = true;
    instances.receiveShadow = true;
    placements.forEach((placement, index) => {
      transform.position.set(...placement.position);
      transform.rotation.set(0, placement.yaw, 0);
      transform.scale.set(...placement.scale);
      transform.updateMatrix();
      matrix.multiplyMatrices(transform.matrix, part.matrixWorld);
      instances.setMatrixAt(index, matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingBox();
    instances.computeBoundingSphere();
    group.add(instances);
  });
  return group;
}

export function addForest(
  scene: THREE.Scene,
  assets: Map<string, THREE.Group>,
  world: ReserveBlueprint,
) {
  const root = new THREE.Group();
  root.name = "WillowmereForest";
  scene.add(root);
  const errors: string[] = [];
  const generatedGeometry = new Set<THREE.BufferGeometry>();
  const primitives: THREE.Mesh[] = [];
  const materials = new Map<number, THREE.MeshStandardMaterial>();
  const material = (color: number) => {
    let value = materials.get(color);
    if (!value) {
      value = new THREE.MeshStandardMaterial({ color, roughness: 1 });
      materials.set(color, value);
    }
    return value;
  };
  function mesh(geometry: THREE.BufferGeometry, color: number, position: Vec3) {
    generatedGeometry.add(geometry);
    const object = new THREE.Mesh(geometry, material(color));
    primitives.push(object);
    object.position.set(...position);
    object.receiveShadow = true;
    root.add(object);
    return object;
  }

  scene.background = null;
  scene.fog = new THREE.Fog(0x94afb0, 72, 225);
  const sky = new SkyMesh();
  sky.material.fog = false;
  sky.name = "ForestSky";
  sky.scale.setScalar(10000);
  sky.turbidity.value = 4;
  sky.rayleigh.value = 1.4;
  sky.mieCoefficient.value = 0.004;
  sky.mieDirectionalG.value = 0.78;
  sky.cloudCoverage.value = 0.56;
  sky.cloudDensity.value = 0.65;
  sky.cloudScale.value = 0.0014;
  sky.cloudSpeed.value = 0;
  sky.sunPosition.value.set(-0.45, 0.75, 0.4).normalize();
  root.add(sky);
  root.add(new THREE.HemisphereLight(0xc4dce3, 0x43543a, 2));
  const sun = new THREE.DirectionalLight(0xffedcf, 3.1);
  sun.position.copy(sky.sunPosition.value).multiplyScalar(105);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {
    left: -42,
    right: 42,
    top: 42,
    bottom: -42,
    near: 1,
    far: 250,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.08;
  root.add(sun, sun.target);

  // The distant floor is below the authored walkable surfaces and water.
  mesh(new THREE.BoxGeometry(700, 1, 700), 0x46573c, [0, -1.55, 0]);
  function ground(x: number, z: number) {
    let y = -1;
    for (const surface of world.walkables) {
      const height = surfaceHeight(surface, x, z);
      if (height !== null) y = Math.max(y, height);
    }
    return y;
  }

  for (const original of world.walkables) {
    const xs = [
      original.min[0],
      original.max[0],
      ...world.waters.flatMap((w) => [w.min[0], w.max[0]]),
    ]
      .filter((x) => x >= original.min[0] && x <= original.max[0])
      .sort((a, b) => a - b);
    const zs = [
      original.min[2],
      original.max[2],
      ...world.waters.flatMap((w) => [w.min[2], w.max[2]]),
    ]
      .filter((z) => z >= original.min[2] && z <= original.max[2])
      .sort((a, b) => a - b);
    for (let xi = 1; xi < xs.length; xi++)
      for (let zi = 1; zi < zs.length; zi++) {
        if (xs[xi] === xs[xi - 1] || zs[zi] === zs[zi - 1]) continue;
        const cx = (xs[xi] + xs[xi - 1]) / 2,
          cz = (zs[zi] + zs[zi - 1]) / 2;
        if (
          world.waters.some(
            (w) =>
              cx > w.min[0] && cx < w.max[0] && cz > w.min[2] && cz < w.max[2],
          )
        )
          continue;
        const surface = {
          ...original,
          min: [xs[xi - 1], original.min[1], zs[zi - 1]] as Vec3,
          max: [xs[xi], original.max[1], zs[zi]] as Vec3,
        };
        const corners = [
          [surface.min[0], surface.min[2]],
          [surface.min[0], surface.max[2]],
          [surface.max[0], surface.max[2]],
          [surface.max[0], surface.min[2]],
        ];
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(
            corners.flatMap(([x, z]) => [
              x,
              (surfaceHeight(original, x, z) ?? original.heightStart) - 0.015,
              z,
            ]),
            3,
          ),
        );
        geometry.setIndex([0, 1, 2, 0, 2, 3]);
        geometry.computeVertexNormals();
        mesh(
          geometry,
          surface.id.includes("bank") ? 0x635b43 : 0x506344,
          [0, 0, 0],
        );
      }
  }
  for (const trail of world.trails) {
    for (let i = 1; i < trail.points.length; i++) {
      const a = trail.points[i - 1],
        b = trail.points[i];
      const dx = b[0] - a[0],
        dz = b[2] - a[2],
        length = Math.hypot(dx, dz);
      const segments = Math.max(1, Math.ceil(length / 1.5));
      for (let n = 0; n < segments; n++) {
        const t = (n + 0.5) / segments;
        const x = a[0] + dx * t,
          z = a[2] + dz * t;
        if (!world.walkables.some((s) => surfaceHeight(s, x, z) !== null))
          continue;
        const path = mesh(
          new THREE.BoxGeometry(trail.width, 0.035, length / segments + 0.09),
          0x8b7f5c,
          [x, ground(x, z) - 0.015, z],
        );
        path.rotation.y = Math.atan2(dx, dz);
      }
    }
  }
  for (const waterBounds of world.waters) {
    const width = waterBounds.max[0] - waterBounds.min[0];
    const depth = waterBounds.max[2] - waterBounds.min[2];
    const water = mesh(new THREE.BoxGeometry(2, 0.025, 2), 0x688f91, [
      (waterBounds.min[0] + waterBounds.max[0]) / 2,
      waterBounds.max[1] - 0.025,
      (waterBounds.min[2] + waterBounds.max[2]) / 2,
    ]);
    water.scale.set(width * 0.5, 1, depth * 0.5);
    const waterMaterial = material(0x638f91);
    waterMaterial.roughness = 0.3;
    waterMaterial.metalness = 0.25;
    water.material = waterMaterial;
  }

  for (const point of world.pockets.flatMap((p) =>
    p.anchors.filter((a) => a.kind === "wash").map((a) => a.point),
  )) {
    const pool = mesh(new THREE.CylinderGeometry(1, 1, 0.015, 12), 0x638f91, [
      point[0],
      point[1] + 0.024,
      point[2],
    ]);
    pool.scale.set(1.15, 1, 0.7);
  }

  function findModel(name: string): THREE.Object3D | undefined {
    for (const source of assets.values()) {
      const model = source.getObjectByName(name);
      if (model) return model;
    }
  }
  const byModel = new Map<string, WorldPlacement[]>();
  const gateLeaves: { id: string; leaf: THREE.Object3D }[] = [];
  for (const placement of world.placements) {
    const key = `${placement.model}:${Math.floor(placement.position[0] / 48)}:${Math.floor(placement.position[2] / 48)}`;
    const entries = byModel.get(key) ?? [];
    entries.push(placement);
    byModel.set(key, entries);
  }
  for (const placements of byModel.values()) {
    const name = placements[0].model;
    const model = findModel(name);
    if (!model) {
      errors.push(`Forest model missing: ${name}`);
      continue;
    }
    if (name === "ForestGate") {
      for (const p of placements) {
        const gate = model.clone(true);
        gate.position.set(...p.position);
        gate.rotation.set(0, p.yaw, 0);
        gate.scale.set(...p.scale);
        root.add(gate);
        const leaf = findPart(gate, "GateLeaf");
        if (leaf)
          gateLeaves.push({
            id: world.fixtures.find(
              (f) =>
                f.kind === "gate" &&
                f.position.every((v, a) => v === p.position[a]),
            )!.id,
            leaf,
          });
        else errors.push("ForestGate has no GateLeaf pivot");
      }
    } else root.add(instanceModel(model, placements));
  }

  const distantTrees = findModel("MaturePineA");
  if (distantTrees) {
    const ring: WorldPlacement[] = [];
    for (let i = 0; i < 150; i++) {
      const angle = i * 2.399963;
      const radius = 270 + (i % 7) * 18;
      ring.push({
        id: `horizon-${i}`,
        model: "MaturePineA",
        position: [
          Math.cos(angle) * radius,
          -2 + Math.sin(i * 0.7) * 3,
          Math.sin(angle) * radius,
        ],
        yaw: angle,
        scale: [
          0.85 + (i % 3) * 0.1,
          0.8 + (i % 4) * 0.13,
          0.85 + (i % 3) * 0.1,
        ],
        solids: [],
        occluders: [],
      });
    }
    const horizon = instanceModel(distantTrees, ring);
    horizon.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = false;
    });
    root.add(horizon);
  }
  for (let i = 0; i < 11; i++) {
    const angle = (i * Math.PI * 2) / 11;
    const ridge = mesh(new THREE.IcosahedronGeometry(1, 1), 0x53726b, [
      Math.cos(angle) * 360,
      -24,
      Math.sin(angle) * 360,
    ]);
    ridge.scale.set(65, 42 + (i % 3) * 13, 58);
  }
  // Batch generated ground/trail pieces by material and spatial cell, keeping
  // imported model buffers shared and independently culled above.
  const batches = new Map<
    string,
    { material: THREE.Material; parts: THREE.BufferGeometry[] }
  >();
  for (const object of primitives) {
    object.updateMatrix();
    const material = object.material as THREE.Material,
      key = `${material.uuid}:${Math.floor(object.position.x / 48)}:${Math.floor(object.position.z / 48)}`;
    const batch = batches.get(key) ?? { material, parts: [] };
    batch.parts.push(object.geometry.clone().applyMatrix4(object.matrix));
    batches.set(key, batch);
    object.removeFromParent();
  }
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.parts);
    batch.parts.forEach((g) => g.dispose());
    if (!geometry) throw Error("Forest geometry could not be batched");
    generatedGeometry.add(geometry);
    const object = new THREE.Mesh(geometry, batch.material);
    object.receiveShadow = true;
    root.add(object);
  }
  return {
    errors,
    update(route: FixtureState) {
      for (const { id, leaf } of gateLeaves)
        leaf.rotation.y = route[id].open ? Math.PI / 2 : 0;
    },
    centerShadows(point: Vec3) {
      sun.target.position.set(...point);
      sun.target.updateMatrixWorld();
      sun.position
        .copy(sky.sunPosition.value)
        .multiplyScalar(105)
        .add(sun.target.position);
      sun.updateMatrixWorld();
    },
    dispose() {
      root.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      generatedGeometry.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      sky.geometry.dispose();
      sky.material.dispose();
      sun.shadow.dispose();
      root.removeFromParent();
    },
  };
}
