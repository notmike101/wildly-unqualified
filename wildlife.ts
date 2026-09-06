import { type Animal, type Quat, type Vec3 } from "./shared.ts";
import { WILDLIFE_POINTS, SQUIRREL_CLIMB } from "./wildlife-data.ts";
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
      parts.Head = [0.12 + Math.sin(t * 12) * 0.07, 0, 0];
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
    parts.FootL = [0.95, 0, 0];
    parts.FootR = [0.95, 0, 0];
    parts.Head = [b === "tap" ? 0.67 + 0.09 * Math.cos(t * 14) : 0.76, 0, 0];
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
