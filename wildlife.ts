import {
  rayBlocked,
  type Animal,
  type Quat,
  type Vec3,
  type Box,
} from "./shared.ts";
import type { ReserveBlueprint } from "./world.ts";
import { SUPPORT_MESHES } from "./support-meshes.ts";
import { WILDLIFE_POINTS, SQUIRREL_CLIMB } from "./wildlife-data.ts";
export function bankStance(world: ReserveBlueprint, id: string) {
  const resident = world.residents.find((r) => r.id === id)!;
  const pocket = world.pockets.find((p) => p.id === resident.home)!;
  const anchor = pocket.anchors.find(
    (a) => a.kind === (resident.species === "otter" ? "rest" : "feed"),
  )!;
  const yaw = world.placements.find(
    (p) => p.id === resident.home + "-landmark",
  )!.yaw;
  const index = Number(id.split("-").at(-1));
  const offset = rotate(
    [(index - 1.5) * 0.65, 0, resident.species === "mallard" ? 1.1 : 0],
    xyz([0, yaw, 0]),
  );
  return {
    position: anchor.point.map((v, i) => v + offset[i]) as Vec3,
    rotation: xyz([0, yaw, 0]),
  };
}
export function rotate(p: Vec3, q: Quat): Vec3 {
  const [x, y, z, w] = q,
    [a, b, c] = p;
  const ix = w * a + y * c - z * b,
    iy = w * b + z * a - x * c,
    iz = w * c + x * b - y * a,
    iw = -x * a - y * b - z * c;
  return [
    ix * w - iw * x - iy * z + iz * y,
    iy * w - iw * y - iz * x + ix * z,
    iz * w - iw * z - ix * y + iy * x,
  ];
}

/** XYZ, exactly the rotation convention used by the exported rigid hierarchy. */
export function xyz([x, y, z]: Vec3): Quat {
  const a = Math.sin(x / 2),
    b = Math.sin(y / 2),
    c = Math.sin(z / 2);
  const d = Math.cos(x / 2),
    e = Math.cos(y / 2),
    f = Math.cos(z / 2);
  return [
    a * e * f + d * b * c,
    d * b * f - a * e * c,
    d * e * c + a * b * f,
    d * e * f - a * b * c,
  ];
}
export function multiply(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

/** Shared by the actual imported parts and authoritative frozen subject points. */
export function wildlifeParts(a: Animal, tick: number): Record<string, Vec3> {
  const t = tick / 60,
    b = a.behavior;
  const parts: Record<string, Vec3> = {
    Body: [0, 0, 0],
    Head: [0, 0, 0],
    Tail: [0, 0, 0],
    EarL: [0, 0, 0],
    EarR: [0, 0, 0],
    LegFL: [0, 0, 0],
    LegFR: [0, 0, 0],
    LegBL: [0, 0, 0],
    LegBR: [0, 0, 0],
    ForepawL: [0, 0, 0],
    ForepawR: [0, 0, 0],
    FootL: [0, 0, 0],
    FootR: [0, 0, 0],
    WingL: [0, 0, 0],
    WingR: [0, 0, 0],
  };
  if (
    ["wander", "stalk", "passage", "sniff", "approach", "retreat"].includes(b)
  )
    for (const n of ["LegFL", "LegFR", "LegBL", "LegBR", "FootL", "FootR"])
      parts[n] = [
        Math.sin(t * 8 + (n.endsWith("R") ? Math.PI : 0)) * 0.16,
        0,
        0,
      ];
  if (a.species === "fox") {
    parts.Head = [b === "stalk" ? -0.18 : b === "pounce" ? 0.32 : 0, 0, 0];
    parts.Tail = [0, Math.sin(t * 2) * 0.12, 0];
    if (b === "pounce") {
      parts.LegFL = [-0.55, 0, 0];
      parts.LegFR = [-0.55, 0, 0];
    }
  } else if (a.species === "rabbit") {
    parts.Head = [b === "nibble" ? -0.12 + Math.sin(t * 9) * 0.06 : 0, 0, 0];
    parts.EarL = [b === "freeze" ? -0.2 : 0.08, 0, -0.04];
    parts.EarR = [b === "freeze" ? -0.2 : 0.08, 0, 0.04];
    if (b === "bound")
      for (const n of ["LegBL", "LegBR"]) parts[n] = [-0.5, 0, 0];
  } else if (a.species === "squirrel") {
    if (b === "cache") {
      parts.Head = [-0.15, 0, 0];
      parts.ForepawL = [-0.45 + Math.sin(t * 7) * 0.1, 0, 0];
      parts.ForepawR = [-0.45 - Math.sin(t * 7) * 0.1, 0, 0];
    }
    if (["climb", "descend"].includes(b)) {
      const phase = Math.max(0, Math.min(1, (a.remaining + 1) / 0.99)) * 84;
      const index = Math.floor(phase),
        amount = phase - index;
      const from = SQUIRREL_CLIMB[index],
        to = SQUIRREL_CLIMB[Math.min(84, index + 1)];
      for (const [name, angles] of Object.entries(from.parts))
        parts[name] = angles.map(
          (v, i) => v + (to.parts[name][i] - v) * amount,
        ) as Vec3;
    }
  } else if (a.species === "beaver") {
    if (b === "gnaw") {
      parts.Head = [-0.35 + Math.sin(t * 12) * 0.04, 0, 0];
      parts.LegFL = [-0.3, 0, 0];
      parts.LegFR = [-0.3, 0, 0];
    }
    parts.Tail = [0, Math.sin(t * 2) * 0.06, 0];
  } else if (a.species === "otter") {
    if (b === "groom") {
      parts.Head = [0.12, 0.45 + Math.sin(t * 3) * 0.1, 0];
      parts.LegFL = [-0.6 + Math.sin(t * 7) * 0.12, 0, 0];
    }
    if (b === "swim") parts.Tail = [0, Math.sin(t * 4) * 0.18, 0];
    if (b === "surface") parts.Head = [0.2, 0, 0];
  } else if (a.species === "badger") {
    parts.Head = [b === "dig" ? 0.35 : -0.15, Math.sin(t * 2) * 0.08, 0];
    if (b === "dig") {
      parts.LegFL = [-0.3 + Math.sin(t * 7) * 0.3, 0, 0];
      parts.LegFR = [-0.3 - Math.sin(t * 7) * 0.3, 0, 0];
    }
  } else if (a.species === "owl") {
    parts.Head = [0, b === "roost" ? Math.sin(t * 0.6) * 0.75 : 0, 0];
    if (b === "fly") {
      parts.WingL = [0, 0, -0.9 + Math.sin(t * 12) * 0.45];
      parts.WingR = [0, 0, 0.9 - Math.sin(t * 12) * 0.45];
    }
  } else if (a.species === "woodpecker") {
    parts.FootL = [b === "fly" ? 0 : 0.95, 0, 0];
    parts.FootR = [b === "fly" ? 0 : 0.95, 0, 0];
    parts.Head = [b === "tap" ? 0.67 + 0.09 * Math.cos(t * 14) : 0.76, 0, 0];
    if (b === "fly") {
      parts.WingL = [0, 0, -0.7 + Math.sin(t * 18) * 0.4];
      parts.WingR = [0, 0, 0.7 - Math.sin(t * 18) * 0.4];
    }
  } else if (a.species === "mallard") {
    if (b === "dabble") parts.Head = [-0.4 + Math.sin(t * 4) * 0.12, 0, 0];
    if (b === "preen") parts.Head = [0.15, 0.9, 0];
    if (b === "swim") {
      parts.FootL = [Math.sin(t * 7) * 0.2, 0, 0];
      parts.FootR = [-Math.sin(t * 7) * 0.2, 0, 0];
    }
  }
  return parts;
}

export function wildlifeSubjectPoints(a: Animal, tick: number): Vec3[] | null {
  const p = WILDLIFE_POINTS[a.species];
  if (!p) return null;
  const rotations = wildlifeParts(a, tick);
  const around = (point: Vec3, pivot: Vec3, rotation: Vec3): Vec3 =>
    rotate(point.map((n, i) => n - pivot[i]) as Vec3, xyz(rotation)).map(
      (n, i) => n + pivot[i],
    ) as Vec3;
  return [
    around(p.photoBody, p.body, rotations.Body),
    around(around(p.photoHead, p.head, rotations.Head), p.body, rotations.Body),
  ];
}

/** Tight visual support geometry inside the deliberately generous carry colliders. */
export function sightBlocked(
  world: ReserveBlueprint,
  from: Vec3,
  to: Vec3,
  boxes: Box[],
) {
  if (!rayBlocked(from, to, boxes)) return false;
  let supports = sightSupports.get(world);
  if (!supports) {
    supports = world.placements.filter((p) => SUPPORT_MESHES[p.model]);
    sightSupports.set(world, supports);
  }
  const hitSupports = new Set<string>();
  for (const box of boxes) {
    if (!rayBlocked(from, to, [box])) continue;
    const support = supports.find((p) => box.id.startsWith(p.id + "-"));
    if (!support) return true;
    hitSupports.add(support.id);
  }
  const sub = (a: Vec3, b: Vec3) => a.map((v, i) => v - b[i]) as Vec3;
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: Vec3, b: Vec3): Vec3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  for (const placement of supports) {
    if (!hitSupports.has(placement.id)) continue;
    const mesh = SUPPORT_MESHES[placement.model];
    const local = (p: Vec3) =>
      rotate(sub(p, placement.position), xyz([0, -placement.yaw, 0])).map(
        (v, i) => v / placement.scale[i],
      ) as Vec3;
    const start = local(from),
      end = local(to);
    if (
      !rayBlocked(start, end, [
        { id: "support", min: mesh.min as Vec3, max: mesh.max as Vec3 },
      ])
    )
      continue;
    const direction = sub(end, start),
      v = mesh.triangles;
    for (let i = 0; i < v.length; i += 9) {
      const a: Vec3 = [v[i], v[i + 1], v[i + 2]],
        b: Vec3 = [v[i + 3], v[i + 4], v[i + 5]],
        c: Vec3 = [v[i + 6], v[i + 7], v[i + 8]];
      const e1 = sub(b, a),
        e2 = sub(c, a),
        p = cross(direction, e2),
        det = dot(e1, p);
      if (Math.abs(det) < 1e-10) continue;
      const t = sub(start, a),
        u = dot(t, p) / det;
      if (u < 0 || u > 1) continue;
      const q = cross(t, e1),
        w = dot(direction, q) / det;
      if (w < 0 || u + w > 1) continue;
      const amount = dot(e2, q) / det;
      if (amount > 1e-5 && amount < 1 - 1e-5) return true;
    }
  }
  return false;
}
const sightSupports = new WeakMap<
  ReserveBlueprint,
  ReserveBlueprint["placements"]
>();
