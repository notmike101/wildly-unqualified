import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  PROP_CENTER_HEIGHT,
  PROP_DEFINITIONS,
  animalArticulation,
  fixtureBoxes,
} from "./level.ts";
import type { ReserveBlueprint } from "./world.ts";
import {
  eye,
  distance,
  rayBlocked,
  equipmentTarget,
  heldProp,
  propPoint,
  type PhotoFrame,
  type Snapshot,
  type Vec3,
} from "./shared.ts";
import { addForest, findPart } from "./forest-view.ts";
import { wildlifeParts } from "./wildlife.ts";

export const CREW_COLORS = [0xf4bd4f, 0xef7166, 0x51bddb, 0xb397ee];
export const CAMERA_FAR = 360;
const palette = CREW_COLORS;

export function alignLocalCarry(
  state: Snapshot,
  localId: string,
  position: Vec3,
) {
  const local = state.players.find((p) => p.id === localId);
  const carried = heldProp(localId, state.props);
  if (!local || (!carried && state.tin.holder !== localId)) return;
  // Apply camera prediction to the rendered carry group only; photos use authority.
  const delta = position.map((n, i) => n - local.position[i]);
  const shift = (point: Vec3) => point.map((n, i) => n + delta[i]) as Vec3;
  if (carried) carried.pose.position = shift(carried.pose.position);
  else state.tin.pose.position = shift(state.tin.pose.position);
  for (const p of state.players)
    if (p.id === localId || carried?.holders.includes(p.id))
      p.position = shift(p.position);
}

const assetLoads = new Map<string, ReturnType<GLTFLoader["loadAsync"]>>();
export function loadAsset(name: string, loader: GLTFLoader) {
  let promise = assetLoads.get(name);
  if (!promise) {
    promise = loader.loadAsync(`/models/${name}.glb`).catch((error) => {
      if (assetLoads.get(name) === promise) assetLoads.delete(name);
      throw error;
    });
    assetLoads.set(name, promise);
  }
  return promise;
}
export async function createView(scene: THREE.Scene, world: ReserveBlueprint) {
  const loader = new GLTFLoader();
  const assets = new Map<string, THREE.Group>();
  const ownedMaterials = new Set<THREE.Material>();
  const actors = new Map<string, THREE.Object3D>();
  const bases = new Map<THREE.Object3D, THREE.Euler>();
  function material(color: number) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    ownedMaterials.add(m);
    return m;
  }
  function mesh(
    geometry: THREE.BufferGeometry,
    color: number,
    position: Vec3,
    scale: Vec3 = [1, 1, 1],
  ) {
    const o = new THREE.Mesh(geometry, material(color));
    o.position.set(...position);
    o.scale.set(...scale);
    o.castShadow = true;
    o.receiveShadow = true;
    scene.add(o);
    return o;
  }
  const errors: string[] = [];
  for (const name of [
    "raccoon",
    "heron",
    "field-kit",
    "reserve-kit",
    "forest-kit-v3",
    "deer-v3",
    "researcher-forest-v3",
    "headwear-v3",
    "expedition-kit-v3",
    "raccoon-dark",
    "heron-reed",
    "wildlife-kit-v4",
    "wildlife-habitat-v4",
  ]) {
    try {
      const gltf = await loadAsset(name, loader);
      assets.set(name, gltf.scene);
      gltf.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
    } catch (e) {
      errors.push(`${name}: ${String(e)}`);
    }
  }
  function clone(name: string) {
    const src =
      assets.get(name) ??
      (assets.has("wildlife-kit-v4")
        ? findPart(
            assets.get("wildlife-kit-v4")!,
            name[0].toUpperCase() + name.slice(1),
          )
        : undefined);
    if (!src) return null;
    const model = src.clone(true);
    model.traverse((o) => bases.set(o, o.rotation.clone()));
    return model;
  }
  function field(name: string, pos: Vec3, scale = 1) {
    const src = [...assets.values()]
      .map((group) => group.getObjectByName(name))
      .find(Boolean);
    if (!src) return null;
    const o = src.clone(true);
    o.traverse((part) => bases.set(part, part.rotation.clone()));
    o.position.set(...pos);
    o.scale.multiplyScalar(scale);
    scene.add(o);
    return o;
  }
  const forest = addForest(scene, assets, world);
  errors.push(...forest.errors);
  function sign(text: string, position: Vec3, rotation = 0) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 170;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#254b37";
    c.fillRect(0, 0, 512, 170);
    c.strokeStyle = "#dacf9a";
    c.lineWidth = 5;
    c.strokeRect(10, 10, 492, 150);
    c.fillStyle = "#f4edcd";
    c.font = "bold 31px Georgia";
    c.textAlign = "center";
    c.fillText(text, 256, 75);
    c.font = "17px sans-serif";
    c.fillText("WILLOWMERE FIELD SOCIETY", 256, 115);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
    ownedMaterials.add(m);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 0.7), m);
    s.position.set(position[0], position[1] + 1.75, position[2] + 0.165);
    s.rotation.y = rotation;
    scene.add(s);
  }
  for (const p of world.placements.filter((p) => p.model === "TrailBoard"))
    sign("WILLOWMERE", p.position, p.yaw);
  for (const anchor of world.pockets
    .flatMap((p) => p.anchors)
    .filter((a) => ["feed", "wash"].includes(a.kind))) {
    const marker = mesh(new THREE.RingGeometry(1.2, 1.27, 24), 0xcac198, [
      anchor.point[0],
      anchor.point[1] + 0.04,
      anchor.point[2],
    ]);
    marker.rotation.x = -Math.PI / 2;
  }
  for (const point of world.navNodes.filter((n) => n.id.includes("-camera-"))) {
    const marker = mesh(new THREE.RingGeometry(0.3, 0.35, 16), 0xdec378, [
      point.position[0],
      point.position[1] + 0.026,
      point.position[2],
    ]);
    marker.rotation.x = -Math.PI / 2;
  }
  const tin =
    field("Tin", [...world.tinStart]) ??
    mesh(new THREE.CylinderGeometry(0.147, 0.147, 0.218, 10), 0xcaae60, [
      ...world.tinStart,
    ]);
  function actor(id: string, species: string, index = 0) {
    let o = actors.get(id);
    if (o) return o;
    const imported = clone(species);
    o = imported ?? new THREE.Group();
    if (!imported) {
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.3, 0.8, 4, 8),
        material(palette[index % 4]),
      );
      body.position.y = 0.8;
      o.add(body);
    }
    if (species.startsWith("researcher"))
      o.traverse((part) => {
        if (part instanceof THREE.Mesh) {
          const old = Array.isArray(part.material)
            ? part.material
            : [part.material];
          part.material = old.map((m) => {
            if (!["Outfit", "Raincoat", "Vest", "CrewAccent"].includes(m.name))
              return m;
            const c = m.clone() as THREE.MeshStandardMaterial;
            c.color.setHex(palette[index % 4]);
            ownedMaterials.add(c);
            return c;
          });
          if (old.length === 1)
            part.material = (part.material as THREE.Material[])[0];
        }
      });
    scene.add(o);
    actors.set(id, o);
    return o;
  }
  const pingMeshes = new Map<string, THREE.Object3D>();
  const equipment = new Map<string, THREE.Object3D>();
  const gripMaterials = new WeakMap<
    THREE.Object3D,
    THREE.MeshStandardMaterial[]
  >();
  const handleBadges = new Map<string, THREE.Sprite>();
  const badgeMaterials = [null, 0, 1, 2, 3].map((slot) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const c = canvas.getContext("2d")!;
    c.fillStyle =
      slot === null
        ? "#fff2c9"
        : `#${palette[slot].toString(16).padStart(6, "0")}`;
    c.beginPath();
    c.arc(32, 32, 28, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#14251f";
    c.font = "bold 38px sans-serif";
    c.textAlign = "center";
    c.fillText(slot === null ? "+" : String(slot + 1), 32, 45);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.SpriteMaterial({
      map: texture,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    ownedMaterials.add(m);
    return m;
  });
  const crossingGuides = world.fixtures
    .filter((f) => f.kind === "crossing")
    .flatMap((f) =>
      Object.entries(f.seats).map(([seat, placement]) => ({
        id: f.id,
        plankId: f.plankId,
        seat,
        placement,
      })),
    )
    .map(({ id, plankId, seat, placement }) => {
      const guideMaterial = new THREE.MeshBasicMaterial({
        color: 0xe7cf86,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      ownedMaterials.add(guideMaterial);
      const guide = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.025, 0.65),
        guideMaterial,
      );
      guide.position.set(...placement.position);
      guide.quaternion.set(...placement.rotation);
      guide.visible = false;
      scene.add(guide);
      for (const x of [-1.51, 1.51]) {
        const mark = mesh(
          new THREE.BoxGeometry(0.16, 0.012, 0.76),
          0xe7cf86,
          [0, 0, 0],
        );
        mark.position
          .set(x, -0.085, 0)
          .applyQuaternion(guide.quaternion)
          .add(guide.position);
        mark.quaternion.copy(guide.quaternion);
      }
      return { id, plankId, seat, placement, guide };
    });
  const headwear = new Map<string, THREE.Object3D>();
  const piles = new Map<string, THREE.Object3D>();
  const offset = new THREE.Vector3();
  const labels = new Map<
    string,
    { sprite: THREE.Sprite; name: string; texture: THREE.CanvasTexture }
  >();
  function playerLabel(id: string, name: string, slot: number) {
    const prior = labels.get(id);
    if (prior?.name === name) return prior.sprite;
    if (prior) {
      prior.sprite.removeFromParent();
      prior.texture.dispose();
      prior.sprite.material.dispose();
    }
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 88;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#162b24";
    context.fillRect(0, 0, 512, 88);
    context.fillStyle = "#" + palette[slot].toString(16).padStart(6, "0");
    context.fillRect(0, 0, 72, 88);
    context.fillStyle = "#14251f";
    context.font = "bold 42px sans-serif";
    context.fillText(String(slot + 1), 23, 59);
    context.fillStyle = "#fff6e4";
    context.font = "bold 36px sans-serif";
    const text = name.length > 18 ? name.slice(0, 17) + "…" : name;
    context.fillText(text, 90, 57, 402);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const labelMaterial = new THREE.SpriteMaterial({
      map: texture,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    ownedMaterials.add(labelMaterial);
    const sprite = new THREE.Sprite(labelMaterial);
    sprite.name = "CrewName";
    sprite.scale.set(2.8, 0.48, 1);
    scene.add(sprite);
    labels.set(id, { sprite, name, texture });
    return sprite;
  }
  function update(state: Snapshot, localId: string, photo = false) {
    const alive = new Set<string>();
    const local = state.players.find((p) => p.id === localId);
    if (state.worldId !== world.id) throw Error("View world mismatch");
    const occluders = [
      ...world.walls,
      ...fixtureBoxes(world.fixtures, state.route),
    ];
    const target =
      local && !heldProp(localId, state.props) && state.tin.holder !== localId
        ? equipmentTarget(local, state.props, PROP_DEFINITIONS, occluders)
        : null;
    state.players.forEach((p) => {
      const i = p.slot;
      const o = actor(p.id, "researcher-forest-v3", i);
      alive.add(p.id);
      o.visible = p.connected && p.id !== localId;
      o.position.set(...p.position);
      o.rotation.y = p.yaw;
      o.scale.y = p.lastInput?.crouch ? 0.7 : 1;
      const label = playerLabel(p.id, p.name, i);
      const labelWidth = Math.min(
        2.8,
        local ? distance(local.position, p.position) * 0.23 : 2.8,
      );
      label.scale.set(labelWidth, labelWidth * 0.17, 1);
      label.position.set(
        p.position[0],
        p.position[1] + (p.lastInput?.crouch ? 1.85 : 2.55),
        p.position[2],
      );
      label.visible =
        !photo &&
        o.visible &&
        !!local &&
        distance(local.position, p.position) < 24 &&
        !rayBlocked(
          eye(local),
          [p.position[0], p.position[1] + 1.7, p.position[2]],
          occluders,
        );
      for (const n of ["LegL", "LegR", "ArmL", "ArmR"]) {
        const part = findPart(o, n);
        if (part) {
          part.rotation.copy(bases.get(part) ?? new THREE.Euler());
          if (p.lastInput && (p.lastInput.x || p.lastInput.z))
            part.rotation.x +=
              Math.sin(state.tick * 0.15 + (n.endsWith("R") ? Math.PI : 0)) *
              0.35;
        }
      }
    });
    forest.update(state.route);
    const variant = world.seed % 2;
    state.animals.forEach((a) => {
      const o = actor(
        a.id,
        a.species === "deer"
          ? "deer-v3"
          : !["raccoon", "heron"].includes(a.species)
            ? a.species
            : variant
              ? a.species === "raccoon"
                ? "raccoon-dark"
                : "heron-reed"
              : a.species,
      );
      alive.add(a.id);
      o.visible = true;
      o.position.set(...a.pose.position);
      o.quaternion.set(...a.pose.rotation);
      const phase = state.tick / 60;
      if (!["raccoon", "deer", "heron"].includes(a.species)) {
        for (const [name, angles] of Object.entries(
          wildlifeParts(a, state.tick),
        )) {
          const part = findPart(o, name);
          if (part) part.rotation.set(...angles, "XYZ");
        }
        return;
      }
      const walking =
        ["wander", "approach", "carry", "investigate", "retreat"].includes(
          a.behavior,
        ) && distance(a.pose.position, a.target) > 0.2;
      for (const n of [
        "LegL",
        "LegR",
        "HindLegL",
        "HindLegR",
        "LegFL",
        "LegFR",
        "LegBL",
        "LegBR",
      ]) {
        const part = findPart(o, n);
        if (part) {
          const b = bases.get(part);
          part.rotation.copy(b ?? new THREE.Euler());
          if (walking)
            part.rotation.x +=
              Math.sin(phase * 8 + (n.endsWith("R") ? Math.PI : 0)) * 0.28;
          if (
            a.species === "raccoon" &&
            a.behavior === "wash" &&
            ["LegL", "LegR"].includes(n)
          )
            part.rotation.x +=
              -0.65 + Math.sin(phase * 11 + (n === "LegR" ? Math.PI : 0)) * 0.3;
          if (a.behavior === "hat-reach" && ["LegL", "LegR"].includes(n))
            part.rotation.x += -1.15 + Math.sin(phase * 6) * 0.15;
        }
      }
      for (const n of a.species === "heron" ? ["WingL", "WingR"] : []) {
        const part = findPart(o, n);
        if (part) {
          part.rotation.copy(bases.get(part) ?? new THREE.Euler());
          part.rotation.z +=
            (n === "WingL" ? 1 : -1) *
            (a.behavior === "display" || a.behavior === "retreat"
              ? Math.sin(phase * 3) * 0.08
              : 1);
        }
      }
      const articulation = animalArticulation(a, state.tick);
      const neck = findPart(o, "Neck");
      if (neck) {
        neck.rotation.copy(bases.get(neck) ?? new THREE.Euler());
        neck.rotation.x += articulation.neckX;
      }
      const head = findPart(o, "Head");
      if (head) {
        head.rotation.copy(bases.get(head) ?? new THREE.Euler());
        head.rotation.x += articulation.headX;
        head.rotation.y += articulation.headY;
      }
      for (const n of ["EarL", "EarR"]) {
        const ear = findPart(o, n);
        if (ear) {
          ear.rotation.copy(bases.get(ear) ?? new THREE.Euler());
          ear.rotation.z +=
            (n === "EarL" ? 1 : -1) *
            (a.behavior === "alert" ? -0.18 : Math.sin(phase * 1.5) * 0.035);
        }
      }
    });
    for (const [id, o] of actors) if (!alive.has(id)) o.visible = false;
    for (const [id, label] of labels)
      if (!alive.has(id)) label.sprite.visible = false;
    const propModels = {
      case: "FieldCase",
      plank: "CrossingPlank",
      screen: "FoldingScreen",
      decoy: "WildlifeDecoy",
    };
    for (const p of state.props) {
      let object = equipment.get(p.id);
      if (!object) {
        object = field(propModels[p.kind], [0, 0, 0]) ?? undefined;
        if (!object) continue;
        if (p.kind === "decoy") {
          const fill = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.075, 0),
            material(0xdec378),
          );
          fill.name = "BaitFill";
          fill.scale.set(1, 0.45, 1);
          fill.position.y = 0.02;
          findPart(object, "BaitCup")?.add(fill);
        }
        equipment.set(p.id, object);
      }
      object.quaternion.set(...p.pose.rotation);
      object.position
        .set(...p.pose.position)
        .add(
          offset
            .set(0, -PROP_CENTER_HEIGHT[p.kind], 0)
            .applyQuaternion(object.quaternion),
        );
      const lid = findPart(object, "Lid");
      const fill = object.getObjectByName("BaitFill");
      if (fill) fill.visible = p.open;
      if (lid) {
        lid.rotation.copy(bases.get(lid) ?? new THREE.Euler());
        if (p.open) lid.rotation.x += 1.1;
      }
      const definition = PROP_DEFINITIONS[p.kind];
      definition.handles.forEach((point, i) => {
        const owner = state.players.find(
          (player) => player.id === p.holders[i],
        );
        const part = findPart(
          object!,
          p.kind === "decoy" ? "Handle" : i === 0 ? "HandleL" : "HandleR",
        );
        if (part) {
          let materials = gripMaterials.get(part);
          if (!materials) {
            materials = [];
            part.traverse((node) => {
              if (!(node instanceof THREE.Mesh)) return;
              const replace = (source: THREE.Material) => {
                const m = source.clone() as THREE.MeshStandardMaterial;
                ownedMaterials.add(m);
                materials!.push(m);
                return m;
              };
              node.material = Array.isArray(node.material)
                ? node.material.map(replace)
                : replace(node.material);
            });
            gripMaterials.set(part, materials);
          }
          for (const m of materials)
            m.color?.setHex(owner ? palette[owner.slot] : 0xe7cf86);
        }
        const key = `${p.id}:${i}`;
        let badge = handleBadges.get(key);
        if (!badge) {
          badge = new THREE.Sprite(badgeMaterials[0]);
          handleBadges.set(key, badge);
          scene.add(badge);
        }
        badge.position.set(...propPoint(point, p.pose));
        badge.position.y += 0.22;
        badge.material = badgeMaterials[owner ? owner.slot + 1 : 0];
        const selected = target?.propId === p.id && target.handle === i;
        badge.scale.setScalar(selected ? 0.22 : 0.15);
        badge.visible =
          !photo &&
          !!local &&
          !p.placed &&
          distance(local.position, badge.position.toArray() as Vec3) < 5 &&
          !rayBlocked(eye(local), badge.position.toArray() as Vec3, occluders);
      });
    }
    const carriedPlank = state.props.find(
      (p) => p.kind === "plank" && p.holders.includes(localId),
    );
    for (const { id, plankId, placement, guide } of crossingGuides) {
      guide.visible =
        !photo &&
        !state.route[id].open &&
        !!carriedPlank &&
        carriedPlank.id === plankId &&
        !!local &&
        distance(local.position, guide.position.toArray() as Vec3) < 9;
      if (guide.visible && carriedPlank) {
        const aligned =
          distance(carriedPlank.pose.position, placement.position) <= 0.75 &&
          Math.abs(
            new THREE.Quaternion(...carriedPlank.pose.rotation).dot(
              new THREE.Quaternion(...placement.rotation),
            ),
          ) >= Math.cos(Math.PI / 18);
        (guide.material as THREE.MeshBasicMaterial).color.setHex(
          aligned ? 0x86d7a8 : 0xe7cf86,
        );
      }
    }
    for (const [owner, hat] of headwear)
      hat.visible = state.hats.some((h) => h.owner === owner);
    for (const h of state.hats) {
      const player = state.players.find((p) => p.id === h.owner);
      if (!player) continue;
      let hat = headwear.get(h.owner);
      if (!hat) {
        hat =
          field(
            ["HatBrim", "HatBeanie", "HatCap", "HatBucket"][player.slot],
            [0, 0, 0],
          ) ?? undefined;
        if (!hat) continue;
        hat.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const replace = (m: THREE.Material) =>
              m.name === "CrewAccent" ? material(palette[player.slot]) : m;
            o.material = Array.isArray(o.material)
              ? o.material.map(replace)
              : replace(o.material);
          }
        });
        headwear.set(h.owner, hat);
      }
      hat.visible =
        h.carrier !== "owner" || (player.connected && player.id !== localId);
      const parent = actors.get(
        h.carrier.startsWith("animal:") ? h.carrier.slice(7) : h.owner,
      );
      const mount =
        parent &&
        findPart(parent, h.carrier.startsWith("animal:") ? "Head" : "HatMount");
      if (h.carrier !== "ground" && mount) {
        mount.updateWorldMatrix(true, false);
        mount.getWorldPosition(hat.position);
        mount.getWorldQuaternion(hat.quaternion);
        if (h.carrier.startsWith("animal:")) hat.position.y += 0.23;
      } else {
        hat.position.set(...h.position);
        hat.quaternion.identity();
      }
    }
    for (const [id, pile] of piles)
      pile.visible = state.spills.some((s) => s.id === id);
    for (const spill of state.spills) {
      let pile = piles.get(spill.id);
      if (!pile) {
        pile = mesh(
          new THREE.DodecahedronGeometry(0.16, 0),
          0xb99554,
          spill.position,
          [1, 0.35, 1],
        );
        piles.set(spill.id, pile);
      }
      pile.visible = spill.portions > 0;
      pile.position.set(
        spill.position[0],
        spill.position[1] + 0.06,
        spill.position[2],
      );
    }
    tin.quaternion.set(...state.tin.pose.rotation);
    tin.position
      .set(...state.tin.pose.position)
      .add(offset.set(0, -0.109, 0).applyQuaternion(tin.quaternion));
    for (const [id, o] of pingMeshes)
      o.visible = state.pings.some((p) => p.player === id);
    for (const p of state.pings) {
      let o = pingMeshes.get(p.player);
      if (!o) {
        const slot =
          state.players.find((player) => player.id === p.player)?.slot ?? 0;
        o = mesh(new THREE.ConeGeometry(0.2, 0.5, 5), palette[slot], [
          ...p.point,
        ]);
        pingMeshes.set(p.player, o);
      }
      o.visible = !photo;
      o.position.set(
        p.point[0],
        2 + Math.sin(state.seconds * 3) * 0.2,
        p.point[2],
      );
      o.rotation.z = Math.PI;
    }
  }
  function dispose() {
    const sharedGeometry = new Set<THREE.BufferGeometry>(),
      sharedMaterials = new Set<THREE.Material>();
    for (const asset of assets.values())
      asset.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          sharedGeometry.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            sharedMaterials.add(m);
        }
      });
    const geometry = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(ownedMaterials);
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        geometry.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
    geometry.forEach((g) => {
      if (!sharedGeometry.has(g)) g.dispose();
    });
    const textures = new Set<THREE.Texture>();
    materials.forEach((m) => {
      if (sharedMaterials.has(m)) return;
      const textured = m as THREE.MeshStandardMaterial;
      if (textured.map) textures.add(textured.map);
      m.dispose();
    });
    textures.forEach((t) => t.dispose());
  }
  return {
    update,
    worldId: world.id,
    centerShadows: forest.centerShadows,
    dispose: () => {
      forest.dispose();
      dispose();
      scene.clear();
    },
    errors,
  };
}

export async function capturePhoto(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  frame: PhotoFrame,
  world: ReserveBlueprint,
  apply: () => void,
  restore: () => void,
): Promise<Blob> {
  if (frame.worldId !== world.id) throw Error("Capture world mismatch");
  const target = new THREE.RenderTarget(640, 360, {
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const cam = new THREE.PerspectiveCamera(
    frame.camera.fov,
    16 / 9,
    0.05,
    CAMERA_FAR,
  );
  cam.position.set(...frame.camera.position);
  cam.rotation.set(frame.camera.pitch, frame.camera.yaw, 0, "YXZ");
  const previous = renderer.getRenderTarget();
  try {
    try {
      apply();
      renderer.setRenderTarget(target);
      renderer.render(scene, cam);
    } finally {
      renderer.setRenderTarget(previous);
      restore();
    }
    const pixels = await renderer.readRenderTargetPixelsAsync(
      target,
      0,
      0,
      640,
      360,
    );
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    canvas
      .getContext("2d")!
      .putImageData(
        new ImageData(
          new Uint8ClampedArray(
            new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength),
          ),
          640,
          360,
        ),
        0,
        0,
      );
    for (const quality of [0.85, 0.65, 0.4, 0.2]) {
      const blob = await new Promise<Blob | null>((r) =>
        canvas.toBlob(r, "image/jpeg", quality),
      );
      if (blob && blob.size <= 65536) return blob;
    }
    throw Error("Photo could not fit the album. Please try again.");
  } finally {
    target.dispose();
  }
}

let audio: AudioContext | undefined;
export function playSound(
  kind:
    | "shutter"
    | "whistle"
    | "notice"
    | "rattle"
    | "impact"
    | "alert"
    | "footstep",
  volume: number,
) {
  if (volume <= 0) return;
  audio ??= new AudioContext();
  void audio.resume();
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  oscillator.connect(gain);
  gain.connect(audio.destination);
  const t = audio.currentTime;
  oscillator.type = ["shutter", "rattle", "impact"].includes(kind)
    ? "square"
    : "sine";
  oscillator.frequency.setValueAtTime(
    kind === "whistle"
      ? 1200
      : kind === "shutter"
        ? 150
        : kind === "rattle"
          ? 260
          : kind === "impact"
            ? 90
            : kind === "footstep"
              ? 70
              : 420,
    t,
  );
  oscillator.frequency.exponentialRampToValueAtTime(
    kind === "whistle" ? 1600 : kind === "alert" ? 750 : 80,
    t + 0.12,
  );
  gain.gain.setValueAtTime(volume * 0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  oscillator.start(t);
  oscillator.stop(t + 0.16);
}
