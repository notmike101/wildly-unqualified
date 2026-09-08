/**
Interpolate a render-only copy; authoritative snapshots and frozen photos are never changed.
 */
import * as THREE from 'three/webgpu';
import type { Snapshot } from '../../shared/shared.ts';

/**
 * Create render-only position copies and interpolate from the prior snapshot. Paused
 * snapshots and prop holder/placement transitions bypass interpolation; authoritative
 * inputs remain unchanged.
 *
 * @param latest - Newest authoritative snapshot
 * @param prior - Previous snapshot, if available
 * @param alpha - Interpolation fraction supplied by the render loop, normally 0 to 1
 * @returns A render snapshot; only interpolated fields are detached, while unchanged nested
 * fields may remain shared.
 */
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
        props: latest.props.map((property) => ({
            ...property,
            pose: {
                position: [...property.pose.position],
                rotation: [...property.pose.rotation],
            },
        })),
    };

    if (prior && !latest.paused) {
        for (const p of renderState.players) {
            const before = prior.players.find((x) => x.id === p.id);

            if (before)
                p.position = p.position.map(
                    (n, index) => before.position[index] + (n - before.position[index]) * alpha,
                ) as [number, number, number];
        }
        for (const a of renderState.animals) {
            const before = prior.animals.find((x) => x.id === a.id);

            if (before)
                a.pose.position = a.pose.position.map(
                    (n, index) => before.pose.position[index] + (n - before.pose.position[index]) * alpha,
                ) as [number, number, number];
        }
        renderState.tin.pose.position = renderState.tin.pose.position.map(
            (n, index) => prior!.tin.pose.position[index] + (n - prior!.tin.pose.position[index]) * alpha,
        ) as [number, number, number];
        for (const property of renderState.props) {
            const before = prior.props.find((p) => p.id === property.id);

            if (
                !before
                || before.placed !== property.placed
                || before.holders.some((id, index) => id !== property.holders[index])
            )
                continue;
            property.pose.position = property.pose.position.map(
                (n, index) => before.pose.position[index] + (n - before.pose.position[index]) * alpha,
            ) as [number, number, number];
            property.pose.rotation = new THREE.Quaternion(...before.pose.rotation)
                .slerp(new THREE.Quaternion(...property.pose.rotation), alpha)
                .toArray() as [number, number, number, number];
        }
    }

    return renderState;
}
