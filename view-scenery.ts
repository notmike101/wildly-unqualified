/** Static reserve signs, activity markers, tracks, and branch piles. Materials remain owned by the view. */
import * as THREE from "three/webgpu";
import { type WorldPlacement } from "./level.ts";
import { type ReserveBlueprint } from "./world.ts";
import { distance, type Vec3 } from "./shared.ts";
import { findPart, instanceModel } from "./forest-view.ts";
import { bankStance, rotate } from "./wildlife.ts";
/**
 * Add signs, activity/camera markers, tracks, and branch piles from authored reserve data.
 * Registers owned materials with the view; shared asset buffers remain shared.
 *
 * @param scene - Scene receiving scenery
 * @param world - Validated reserve blueprint
 * @param assets - Shared imported model roots
 * @param ownedMaterials - View-owned material registry for disposal
 * @param mesh - View helper that creates and owns a primitive mesh
 * @param field - View helper that clones and mounts a named field asset
 */
export function addFieldScenery(
  scene: THREE.Scene,
  world: ReserveBlueprint,
  assets: Map<string, THREE.Group>,
  ownedMaterials: Set<THREE.Material>,
  mesh: (
    geometry: THREE.BufferGeometry,
    color: number,
    position: Vec3,
    scale?: Vec3,
  ) => THREE.Mesh,
  field: (name: string, pos: Vec3, scale?: number) => THREE.Object3D | null,
) {
  /**
   * Draw a field-society sign to a canvas texture and mount its plane above the authored
   * position. Registers the material for view disposal.
   *
   * @param text - Main sign text
   * @param position - Authored sign base position
   * @param rotation - Yaw in radians, default 0
   */
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
  // Reuse the authored paw impressions as quiet trail clues; these flat marks
  // are scenery, not a second navigation or objective state.
  const tracks: WorldPlacement[] = [];
  for (const pocket of world.pockets) {
    const path = pocket.anchors.filter(
      (a) => a.kind === "passage" && !a.id.endsWith("-start"),
    );
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1].point,
        b = path[i].point,
        length = distance(a, b);
      for (let along = 0.6; along < length; along += 1.3)
        tracks.push({
          id: `track-${tracks.length}`,
          model: "RaccoonTracks",
          position: a.map(
            (v, axis) =>
              v + ((b[axis] - v) * along) / length + (axis === 1 ? 0.035 : 0),
          ) as Vec3,
          yaw: Math.atan2(a[0] - b[0], a[2] - b[2]),
          scale: [0.8, 1, 0.8],
          solids: [],
          occluders: [],
        });
    }
  }
  const trackModel = findPart(assets.get("reserve-kit")!, "RaccoonTracks");
  if (trackModel && tracks.length) scene.add(instanceModel(trackModel, tracks));
  for (const resident of world.residents.filter(
    (r) => r.species === "beaver",
  )) {
    const stance = bankStance(world, resident.id),
      offset = rotate([0, 0, -0.75], stance.rotation);
    const pile = field(
      "BranchPile",
      stance.position.map((v, i) => v + offset[i]) as Vec3,
      0.6,
    );
    if (pile) pile.quaternion.set(...stance.rotation);
  }
}
