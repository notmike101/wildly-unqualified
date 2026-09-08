import {
    isRayBlocked,
    type Animal,
    type Quat,
    type Vec3,
    type Box,
} from '../shared.ts';
import type { ReserveBlueprint } from '../world/world.ts';
import { SUPPORT_MESHES } from './support-meshes.ts';
import { WILDLIFE_POINTS, SQUIRREL_CLIMB } from './wildlife-data.ts';

/**
 * Resolve a water resident's calibrated bank pose from its home anchors, landmark yaw, and
 * resident index. Requires a validated matching blueprint.
 *
 * @param world - Validated reserve blueprint
 * @param id - Water resident ID
 * @returns New world-space bank pose.
 */
export function bankStance(world: ReserveBlueprint, id: string) {
    const resident = world.residents.find((r) => r.id === id)!;
    const pocket = world.pockets.find((p) => p.id === resident.home)!;
    const anchor = pocket.anchors.find(
        (a) => a.kind === (resident.species === 'otter' ? 'rest' : 'feed'),
    )!;
    const yaw = world.placements.find(
        (p) => p.id === resident.home + '-landmark',
    )!.yaw;
    const index = Number(id.split('-').at(-1));
    const offset = rotate(
        [(index - 1.5) * 0.65, 0, resident.species === 'mallard' ? 1.1 : 0],
        xyz([0, yaw, 0]),
    );

    return {
        position: anchor.point.map((v, index_) => v + offset[index_]) as Vec3,
        rotation: xyz([0, yaw, 0]),
    };
}

/**
 * Rotate a vector by a unit XYZW quaternion without changing the inputs.
 *
 * @param p - Vector to rotate
 * @param q - Unit XYZW quaternion
 * @returns Rotated vector.
 */
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

/**
 * Convert XYZ Euler angles using the exact rotation convention of the exported rigid
 * hierarchy.
 *
 * @param components - XYZ Euler angles in radians
 * @param components.0 - X rotation in radians.
 * @param components.1 - Y rotation in radians.
 * @param components.2 - Z rotation in radians.
 * @returns Unit XYZW quaternion.
 */
export function xyz([x, y, z]: Vec3): Quat {
    const a = Math.sin(x / 2),
        b = Math.sin(y / 2),
        c = Math.sin(z / 2);
    const d = Math.cos(x / 2),
        entry = Math.cos(y / 2),
        f = Math.cos(z / 2);

    return [
        a * entry * f + d * b * c,
        d * b * f - a * entry * c,
        d * entry * c + a * b * f,
        d * entry * f - a * b * c,
    ];
}

/**
 * Compose quaternions as a times b; for column-vector rotations, b is applied first.
 *
 * @param a - Left quaternion
 * @param b - Right quaternion
 * @returns Product XYZW quaternion.
 */
export function multiply(a: Quat, b: Quat): Quat {
    return [
        a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
        a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
        a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
        a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
    ];
}

/**
 * Resolve deterministic local part rotations for wildlife-kit species, shared by rendering
 * and frozen photo geometry.
 *
 * @param a - Animal pose, behavior, and progress state
 * @param tick - Authoritative tick at 60 ticks per second
 * @returns Part-name map of XYZ Euler rotations in radians.
 */
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
        ['wander', 'stalk', 'passage', 'sniff', 'approach', 'retreat'].includes(b)
    )
        for (const n of ['LegFL', 'LegFR', 'LegBL', 'LegBR', 'FootL', 'FootR'])
            parts[n] = [
                Math.sin(t * 8 + (n.endsWith('R') ? Math.PI : 0)) * 0.16,
                0,
                0,
            ];
    switch (a.species) {
        case 'fox': {
            parts.Head = [b === 'stalk' ? -0.18 : (b === 'pounce' ? 0.32 : 0), 0, 0];
            parts.Tail = [0, Math.sin(t * 2) * 0.12, 0];
            if (b === 'pounce') {
                parts.LegFL = [-0.55, 0, 0];
                parts.LegFR = [-0.55, 0, 0];
            }

            break;
        }
        case 'rabbit': {
            parts.Head = [b === 'nibble' ? -0.12 + Math.sin(t * 9) * 0.06 : 0, 0, 0];
            parts.EarL = [b === 'freeze' ? -0.2 : 0.08, 0, -0.04];
            parts.EarR = [b === 'freeze' ? -0.2 : 0.08, 0, 0.04];
            if (b === 'bound')
                for (const n of ['LegBL', 'LegBR']) parts[n] = [-0.5, 0, 0];

            break;
        }
        case 'squirrel': {
            if (b === 'cache') {
                parts.Head = [-0.15, 0, 0];
                parts.ForepawL = [-0.45 + Math.sin(t * 7) * 0.1, 0, 0];
                parts.ForepawR = [-0.45 - Math.sin(t * 7) * 0.1, 0, 0];
            }
            if (['climb', 'descend'].includes(b)) {
                const phase = Math.max(0, Math.min(1, (a.remaining + 1) / 0.99)) * 84;
                const index = Math.floor(phase),
                    amount = phase - index;
                const from = SQUIRREL_CLIMB[index],
                    to = SQUIRREL_CLIMB[Math.min(84, index + 1)];

                for (const [name, angles] of Object.entries(from.parts))
                    parts[name] = angles.map(
                        (v, index_) => v + (to.parts[name][index_] - v) * amount,
                    ) as Vec3;
            }

            break;
        }
        case 'beaver': {
            if (b === 'gnaw') {
                parts.Head = [-0.35 + Math.sin(t * 12) * 0.04, 0, 0];
                parts.LegFL = [-0.3, 0, 0];
                parts.LegFR = [-0.3, 0, 0];
            }
            parts.Tail = [0, Math.sin(t * 2) * 0.06, 0];

            break;
        }
        case 'otter': {
            switch (b) {
                case 'groom': {
                    parts.Head = [0.12, 0.45 + Math.sin(t * 3) * 0.1, 0];
                    parts.LegFL = [-0.6 + Math.sin(t * 7) * 0.12, 0, 0];
                    break;
                }
                case 'swim': {
                    parts.Tail = [0, Math.sin(t * 4) * 0.18, 0];
                    break;
                }
                case 'surface': {
                    parts.Head = [0.2, 0, 0];
                    break;
                }
                default: { break; }
            }
            break;
        }
        case 'badger': {
            parts.Head = [b === 'dig' ? 0.35 : -0.15, Math.sin(t * 2) * 0.08, 0];
            if (b === 'dig') {
                parts.LegFL = [-0.3 + Math.sin(t * 7) * 0.3, 0, 0];
                parts.LegFR = [-0.3 - Math.sin(t * 7) * 0.3, 0, 0];
            }

            break;
        }
        case 'owl': {
            parts.Head = [0, b === 'roost' ? Math.sin(t * 0.6) * 0.75 : 0, 0];
            if (b === 'fly') {
                parts.WingL = [0, 0, -0.9 + Math.sin(t * 12) * 0.45];
                parts.WingR = [0, 0, 0.9 - Math.sin(t * 12) * 0.45];
            }

            break;
        }
        case 'woodpecker': {
            parts.FootL = [b === 'fly' ? 0 : 0.95, 0, 0];
            parts.FootR = [b === 'fly' ? 0 : 0.95, 0, 0];
            parts.Head = [b === 'tap' ? 0.67 + 0.09 * Math.cos(t * 14) : 0.76, 0, 0];
            if (b === 'fly') {
                parts.WingL = [0, 0, -0.7 + Math.sin(t * 18) * 0.4];
                parts.WingR = [0, 0, 0.7 - Math.sin(t * 18) * 0.4];
            }

            break;
        }
        case 'mallard': {
            switch (b) {
                case 'dabble': {
                    parts.Head = [-0.4 + Math.sin(t * 4) * 0.12, 0, 0];
                    break;
                }
                case 'preen': {
                    parts.Head = [0.15, 0.9, 0];
                    break;
                }
                case 'swim': {
                    parts.FootL = [Math.sin(t * 7) * 0.2, 0, 0];
                    parts.FootR = [-Math.sin(t * 7) * 0.2, 0, 0];
                    break;
                }
                default: { break; }
            }
            break;
        }
        default: { break; }
    }

    return parts;
}

/**
 * Apply calibrated body/head pivots and current articulation to wildlife-kit photo samples.
 *
 * @param a - Animal state
 * @param tick - Authoritative shutter/render tick
 * @returns New model-local samples, or null for species using legacy geometry.
 */
export function wildlifeSubjectPoints(a: Animal, tick: number): Vec3[] | null {
    const p = WILDLIFE_POINTS[a.species];

    // eslint-disable-next-line unicorn/no-null -- Legacy species use null to select the legacy photo sample geometry.
    if (!p) return null;
    const rotations = wildlifeParts(a, tick);

    /**
     * Rotate a local point about an authored pivot using XYZ Euler angles.
     *
     * @param point - Point to rotate
     * @param pivot - Rotation pivot
     * @param rotation - XYZ Euler angles in radians
     * @returns New point in the same coordinate space.
     */
    const around = (point: Vec3, pivot: Vec3, rotation: Vec3): Vec3 => rotate(point.map((n, index) => n - pivot[index]) as Vec3, xyz(rotation)).map(
        (n, index) => n + pivot[index],
    ) as Vec3;

    return [
        around(p.photoBody, p.body, rotations.Body),
        around(around(p.photoHead, p.head, rotations.Head), p.body, rotations.Body),
    ];
}

/**
 * Refine broad sight-box hits against measured support triangles where available.
 * Unrecognized scenery boxes remain opaque; support placement lookup is cached by blueprint
 * identity.
 *
 * @param world - Validated reserve blueprint
 * @param from - World-space sight origin
 * @param to - World-space sight target
 * @param boxes - Broad-phase sight blockers
 * @returns Whether the finite sight segment is obstructed.
 */
export function sightBlocked(
    world: ReserveBlueprint,
    from: Vec3,
    to: Vec3,
    boxes: Box[],
) {
    if (!isRayBlocked(from, to, boxes)) return false;
    let supports = sightSupports.get(world);

    if (!supports) {
        supports = world.placements.filter((p) => SUPPORT_MESHES[p.model]);
        sightSupports.set(world, supports);
    }
    const hitSupports = new Set<string>();

    for (const box of boxes) {
        if (!isRayBlocked(from, to, [box])) continue;
        const support = supports.find((p) => box.id.startsWith(p.id + '-'));

        if (!support) return true;
        hitSupports.add(support.id);
    }

    /**
     * Subtract vector components without modifying either input.
     *
     * @param a - First vector
     * @param b - Vector to subtract
     * @returns New difference vector a minus b.
     */
    const sub = (a: Vec3, b: Vec3) => a.map((v, index) => v - b[index]) as Vec3;

    /**
     * Compute the scalar product used by triangle intersection tests.
     *
     * @param a - First vector
     * @param b - Second vector
     * @returns Scalar dot product.
     */
    const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

    /**
     * Compute the right-handed vector product used by triangle intersection tests.
     *
     * @param a - First vector
     * @param b - Second vector
     * @returns New cross-product vector a cross b.
     */
    const cross = (a: Vec3, b: Vec3): Vec3 => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];

    for (const placement of supports) {
        if (!hitSupports.has(placement.id)) continue;
        const mesh = SUPPORT_MESHES[placement.model];

        /**
         * Inverse-transform a world point through the current support placement's translation, yaw,
         * and scale.
         *
         * @param p - World-space point
         * @returns Support-mesh-local point.
         */
        const local = (p: Vec3) => rotate(sub(p, placement.position), xyz([0, -placement.yaw, 0])).map(
            (v, index) => v / placement.scale[index],
        ) as Vec3;
        const start = local(from),
            end = local(to);

        if (
            !isRayBlocked(start, end, [
                { id: 'support', min: mesh.min as Vec3, max: mesh.max as Vec3 },
            ])
        )
            continue;
        const direction = sub(end, start),
            v = mesh.triangles;

        /**
         * Test a single support triangle against the local sight segment.
         *
         * @param index - First triangle component in the packed vertex array
         * @returns Whether the segment crosses the triangle away from its endpoints.
         */
        const intersectsTriangle = (index: number) => {
            const a: Vec3 = [v[index], v[index + 1], v[index + 2]],
                b: Vec3 = [v[index + 3], v[index + 4], v[index + 5]],
                c: Vec3 = [v[index + 6], v[index + 7], v[index + 8]];
            const edge1 = sub(b, a),
                edge2 = sub(c, a),
                p = cross(direction, edge2),
                det = dot(edge1, p);

            if (Math.abs(det) < 1e-10) return false;
            const t = sub(start, a),
                u = dot(t, p) / det;

            if (u < 0 || u > 1) return false;
            const q = cross(t, edge1),
                w = dot(direction, q) / det;

            if (w < 0 || u + w > 1) return false;
            const amount = dot(edge2, q) / det;

            return amount > 1e-5 && amount < 1 - 1e-5;
        };

        for (let index = 0; index < v.length; index += 9)
            if (intersectsTriangle(index)) return true;
    }

    return false;
}
const sightSupports = new WeakMap<
    ReserveBlueprint,
    ReserveBlueprint['placements']
>();
