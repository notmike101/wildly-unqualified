/** Interpolate a render-only copy; authoritative snapshots and frozen photos are never changed. */
import * as THREE from "three/webgpu";
import type { Snapshot } from "./shared.ts";
export function interpolateSnapshot(
  latest: Snapshot,
  prior: Snapshot | undefined,
  alpha: number,
): Snapshot {
  const renderState: Snapshot = {
    ...latest,
    players: latest.players.map((p) => ({
      ...p,
      position: [...p.position],
    })),
    animals: latest.animals.map((a) => ({
      ...a,
      pose: { ...a.pose, position: [...a.pose.position] },
    })),
    tin: {
      ...latest.tin,
      pose: { ...latest.tin.pose, position: [...latest.tin.pose.position] },
    },
    props: latest.props.map((prop) => ({
      ...prop,
      pose: {
        position: [...prop.pose.position],
        rotation: [...prop.pose.rotation],
      },
    })),
  };

  if (prior && !latest.paused) {
    for (const p of renderState.players) {
      const before = prior.players.find((x) => x.id === p.id);
      if (before)
        p.position = p.position.map(
          (n, i) => before.position[i] + (n - before.position[i]) * alpha,
        ) as [number, number, number];
    }
    for (const a of renderState.animals) {
      const before = prior.animals.find((x) => x.id === a.id);
      if (before)
        a.pose.position = a.pose.position.map(
          (n, i) =>
            before.pose.position[i] + (n - before.pose.position[i]) * alpha,
        ) as [number, number, number];
    }
    renderState.tin.pose.position = renderState.tin.pose.position.map(
      (n, i) =>
        prior!.tin.pose.position[i] + (n - prior!.tin.pose.position[i]) * alpha,
    ) as [number, number, number];
    for (const prop of renderState.props) {
      const before = prior.props.find((p) => p.id === prop.id);
      if (
        !before ||
        before.placed !== prop.placed ||
        before.holders.some((id, i) => id !== prop.holders[i])
      )
        continue;
      prop.pose.position = prop.pose.position.map(
        (n, i) =>
          before.pose.position[i] + (n - before.pose.position[i]) * alpha,
      ) as [number, number, number];
      prop.pose.rotation = new THREE.Quaternion(...before.pose.rotation)
        .slerp(new THREE.Quaternion(...prop.pose.rotation), alpha)
        .toArray() as [number, number, number, number];
    }
  }
  return renderState;
}
