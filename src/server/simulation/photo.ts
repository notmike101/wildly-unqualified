/** Photo scoring from a frozen frame and its reserve; never reads live run state. */
import {
  PROP_DEFINITIONS,
  SUBJECT_HEIGHT,
  subjectPoints,
  TIN_HALF,
  fixtureBoxes,
} from "../../shared/world/level.ts";
import {
  residentName,
  commissionInstructions,
  type ReserveBlueprint,
} from "../../shared/world/world.ts";
import {
  distance,
  forward,
  isRayBlocked,
  propertyRayBlocked,
  type Animal,
  type PhotoFrame,
  type PhotoVerdict,
  type Quat,
  type Vec3,
} from "../../shared/shared.ts";
import { sightBlocked, rotate } from "../../shared/wildlife/wildlife.ts";
import { nearby, flat } from "./game-state.ts";
/**
 * Transform a sight segment into the frozen tin's local coordinates and test its oriented
 * bounds.
 *
 * @param frame - Frozen photograph frame
 * @param from - World-space sight origin
 * @param to - World-space sight target
 * @returns Whether the tin blocks the segment.
 */
function tinBlocks(frame: PhotoFrame, from: Vec3, to: Vec3) {
  const q = frame.tin.pose.rotation,
    conjugate: Quat = [-q[0], -q[1], -q[2], q[3]];
  /**
   * Translate and inverse-rotate a point into the frozen tin's coordinate system.
   *
   * @param v - World-space point
   * @returns Tin-local point.
   */
  const local = (v: Vec3) =>
    rotate(v.map((n, i) => n - frame.tin.pose.position[i]) as Vec3, conjugate);
  return isRayBlocked(local(from), local(to), [
    { id: "tin", min: TIN_HALF.map((n) => -n) as Vec3, max: TIN_HALF },
  ]);
}
/**
 * Score visibility and commission requirements from the frozen frame and matching
 * blueprint. Produces feedback without consulting or mutating the live run.
 *
 * @param frame - Frozen scene and camera at the shutter tick
 * @param world - Validated blueprint matching the frame
 * @returns Earned commission IDs and a player-facing acceptance or framing reason.
 * @throws {Error} World IDs differ or photographed residents have duplicate or mismatched
 * identities.
 */
export function evaluatePhoto(
  frame: PhotoFrame,
  world: ReserveBlueprint,
): PhotoVerdict {
  if (frame.worldId !== world.id) throw Error("Photo belongs to another world");
  const c = frame.camera,
    occluders = [
      ...world.placements.flatMap((p) => p.occluders),
      ...world.walls,
      ...fixtureBoxes(world.fixtures, frame.route),
    ],
    f = forward(c.yaw, c.pitch),
    right: Vec3 = [Math.cos(c.yaw), 0, -Math.sin(c.yaw)],
    up: Vec3 = [
      Math.sin(c.yaw) * Math.sin(c.pitch),
      Math.cos(c.pitch),
      Math.cos(c.yaw) * Math.sin(c.pitch),
    ];
  /**
   * Compute a three-dimensional dot product for camera projection.
   *
   * @param a - First vector
   * @param b - Second vector
   * @returns Scalar dot product.
   */
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    scale = Math.tan((c.fov * Math.PI) / 360);
  /**
   * Check camera framing and occlusion by scenery, the tin, and equipment.
   *
   * @param point - World-space sample point
   * @param boxes - Scenery blockers, defaults to all photo occluders
   * @returns Whether the world point is visible within the photograph.
   */
  const pointVisible = (point: Vec3, boxes = occluders) => {
    const d = point.map((v, i) => v - c.position[i]) as Vec3,
      depth = dot(d, f);
    return (
      depth > 0.1 &&
      Math.abs(dot(d, right) / ((depth * scale * 16) / 9)) <= 1 &&
      Math.abs(dot(d, up) / (depth * scale)) <= 1 &&
      !sightBlocked(world, c.position, point, boxes) &&
      !tinBlocks(frame, c.position, point) &&
      !propertyRayBlocked(c.position, point, frame.props, PROP_DEFINITIONS)
    );
  };
  const reasons: string[] = [];
  const framed: { animal: Animal; center: number; reason: string | null }[] =
    [];
  /**
   * Test an animal's projected size, framing, immersion, and occlusion. Appends framing
   * feedback and rejection reasons while evaluating samples.
   *
   * @param a - Animal in the frozen frame
   * @returns Whether enough subject samples qualify as visible.
   */
  const qualifies = (a: Animal) => {
    const points = subjectPoints(a, frame.tick).map((local) => {
      const v = rotate(local, a.pose.rotation);
      return v.map((n, i) => n + a.pose.position[i]) as Vec3;
    });
    const projected = points.map((point) => {
      const d = point.map((n, i) => n - c.position[i]) as Vec3,
        depth = dot(d, f);
      return {
        point,
        depth,
        x: dot(d, right) / ((depth * scale * 16) / 9),
        y: dot(d, up) / (depth * scale),
      };
    });
    const inside = projected.filter(
      (p) => p.depth > 0.1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1,
    );
    const feedback = {
      animal: a,
      center: Math.min(...inside.map((p) => Math.hypot(p.x, p.y))),
      reason: null as string | null,
    };
    if (inside.length >= 2) framed.push(feedback);
    if (projected.filter((p) => p.depth > 0.1).length < 2) {
      reasons.push("Subject is behind the camera");
      return false;
    }
    const heights = [0, SUBJECT_HEIGHT[a.species]].map((y) => {
      const point = rotate([0, y, 0], a.pose.rotation).map(
        (n, i) => n + a.pose.position[i] - c.position[i],
      ) as Vec3;
      return dot(point, up) / (dot(point, f) * scale);
    });
    if (Math.abs(heights[1] - heights[0]) / 2 < 0.03) {
      feedback.reason = "Move closer: subject is too small";
      reasons.push("Move closer: subject is too small");
      return false;
    }
    if (inside.length < 2) {
      reasons.push("Keep the subject inside the frame");
      return false;
    }
    if (
      inside.filter(
        (p) =>
          !world.waters.some(
            (w) =>
              p.point[0] > w.min[0] &&
              p.point[0] < w.max[0] &&
              p.point[2] > w.min[2] &&
              p.point[2] < w.max[2] &&
              p.point[1] < w.max[1] - 0.0125,
          ) &&
          !sightBlocked(world, c.position, p.point, occluders) &&
          !tinBlocks(frame, c.position, p.point) &&
          !propertyRayBlocked(c.position, p.point, frame.props, PROP_DEFINITIONS),
      ).length < 2
    ) {
      feedback.reason = "Subject hidden by a solid object";
      reasons.push("Subject hidden by a solid object");
      return false;
    }
    return true;
  };
  const visible = frame.animals.filter(qualifies);
  const ids = new Set(frame.animals.map((a) => a.id));
  if (
    ids.size !== frame.animals.length ||
    frame.animals.some(
      (a) =>
        !world.residents.some((r) => r.id === a.id && r.species === a.species),
    )
  )
    throw Error("Photo resident identity mismatch");
  const visibleIds = new Set(visible.map((a) => a.id));
  /**
   * Recognize a raccoon inspecting an open tin within the required horizontal range.
   *
   * @param a - Animal in the frozen frame
   * @returns Whether the frozen scene satisfies the inspection condition.
   */
  const inspection = (a: Animal) =>
    a.species === "raccoon" &&
    a.behavior === "inspect" &&
    frame.tin.open &&
    nearby(a.pose.position, frame.tin.pose.position, 1.5);
  const credits = world.commissions
    .filter((commission) => {
      const pocket = world.pockets.find((p) => p.id === commission.pocket),
        anchor = pocket?.anchors.find((a) => a.id === commission.anchor),
        subjects = commission.subjects.map((id) =>
          frame.animals.find((a) => a.id === id),
        );
      if (
        !anchor ||
        !subjects.length ||
        subjects.some(
          (a) =>
            !a ||
            !visibleIds.has(a.id) ||
            !world.residents.some(
              (r) =>
                r.id === a.id &&
                r.home === pocket!.id &&
                r.anchors.includes(anchor.id),
            ),
        )
      )
        return false;
      const animals = subjects as Animal[],
        a = animals[0];
      if (commission.kind === "behavior" && animals.length === 1) {
        if (a.species === "raccoon")
          return (
            commission.behavior === "wash" &&
            a.behavior === "wash" &&
            nearby(a.pose.position, anchor.point, 1) &&
            frame.tin.open &&
            frame.tin.portions > 0 &&
            nearby(frame.tin.pose.position, anchor.point, 2)
          );
        if (a.species === "deer")
          return (
            commission.behavior === "graze" &&
            a.behavior === "graze" &&
            nearby(a.pose.position, anchor.point, 3)
          );
        if (a.species === "heron")
          return (
            commission.behavior === "preen" &&
            a.behavior === "preen" &&
            nearby(a.pose.position, anchor.point, 8)
          );
        return (
          commission.behavior === a.behavior &&
          nearby(a.pose.position, anchor.point, 2)
        );
      }
      if (
        commission.kind === "setup" &&
        animals.length === 1 &&
        ["raccoon", "deer", "heron", "rabbit", "mallard"].includes(a.species)
      ) {
        const decoy = frame.props.find(
            (p) =>
              p.kind === "decoy" &&
              p.open &&
              !p.holders.some(Boolean) &&
              nearby(p.pose.position, anchor.point, 3),
          ),
          screen = frame.props.find(
            (p) =>
              p.kind === "screen" &&
              !p.holders.some(Boolean) &&
              distance(p.pose.position, frame.camera.position) < 4,
          );
        if (
          !decoy ||
          !screen ||
          !frame.tin.open ||
          !nearby(frame.tin.pose.position, anchor.point, 3) ||
          !nearby(a.pose.position, anchor.point, 3)
        )
          return false;
        return a.species === "raccoon"
          ? inspection(a)
          : a.species === "heron"
            ? a.behavior === "display"
            : a.species === "rabbit" || a.species === "mallard"
              ? a.behavior === "feed"
              : a.behavior === "investigate" &&
                nearby(a.pose.position, decoy.pose.position, 2) &&
                nearby(a.target, decoy.pose.position, 2);
      }
      if (commission.kind === "pair" && animals.length === 2) {
        const raccoon = animals.find((a) => a.species === "raccoon"),
          heron = animals.find((a) => a.species === "heron");
        if (!raccoon && !heron)
          return (
            [
              ["deer", "rabbit"],
              ["beaver", "mallard"],
            ].some((pair) =>
              pair.every((s) => animals.some((a) => a.species === s)),
            ) &&
            animals.every(
              (a) =>
                nearby(a.pose.position, anchor.point, 3) &&
                ["graze", "nibble", "gnaw", "feed", "preen"].includes(
                  a.behavior,
                ),
            ) &&
            distance(animals[0].pose.position, animals[1].pose.position) >= 0.55
          );
        return (
          !!raccoon &&
          !!heron &&
          inspection(raccoon) &&
          heron.behavior === "display" &&
          nearby(heron.pose.position, anchor.point, 3) &&
          distance(flat(raccoon.pose.position), flat(heron.pose.position)) >=
            3 &&
          nearby(raccoon.pose.position, heron.pose.position, 8)
        );
      }
      if (commission.kind === "passage")
        return (
          a.behavior === "passage" && nearby(a.pose.position, anchor.point, 2)
        );
      if (commission.kind === "cameo")
        return nearby(a.pose.position, anchor.point, 12);
      if (commission.kind === "incident")
        return (
          frame.hats.some(
            (h) => h.carrier === `animal:${a.id}` && pointVisible(h.position),
          ) ||
          frame.spills.some(
            (s) =>
              s.portions > 0 &&
              s.untilTick > frame.tick &&
              a.behavior === "investigate" &&
              nearby(s.position, a.pose.position, 2) &&
              pointVisible([
                s.position[0],
                s.position[1] + 0.04,
                s.position[2],
              ]),
          )
        );
      if (commission.kind === "composition") {
        const landmark = world.placements.find(
          (p) => p.id === commission.landmark,
        );
        if (!landmark || !nearby(a.pose.position, anchor.point, 3))
          return false;
        const boxes = [...landmark.solids, ...landmark.occluders];
        if (!boxes.length) return false;
        const min = [0, 1, 2].map((i) =>
          Math.min(...boxes.map((b) => b.min[i])),
        ) as Vec3;
        const max = [0, 1, 2].map((i) =>
          Math.max(...boxes.map((b) => b.max[i])),
        ) as Vec3;
        const other = occluders.filter((b) => !b.id.startsWith(landmark.id));
        let count = 0;
        for (const x of [min[0], max[0]])
          for (const y of [min[1], max[1]])
            for (const z of [min[2], max[2]]) {
              if (pointVisible([x, y, z], other)) count++;
            }
        return count >= 3;
      }
      return false;
    })
    .map((commission) => commission.id);
  const subject = framed.sort((a, b) => a.center - b.center)[0];
  const hint =
    subject &&
    world.commissions.find((c) => c.subjects.includes(subject.animal.id));
  return {
    credits,
    reason: credits.length
      ? "Commission photograph accepted"
      : (subject?.reason ??
        (subject
          ? `${residentName(world, subject.animal.id)}: ${hint ? commissionInstructions(world, hint) : "Wildlife photograph recorded"}`
          : (reasons[0] ?? "Find a wildlife subject in the frame"))),
  };
}
