/**
Wildlife articulation and photograph subject geometry shared by scoring and rendering.
 */
import type { Animal, Species, Vec3 } from '../shared.ts';
import { wildlifeSubjectPoints } from '../wildlife/wildlife.ts';
export const SUBJECT_POINTS: Record<Species, Vec3[]> = {
    badger: [
        [0, 0.33, 0.04],
        [0, 0.4, -0.38],
    ],
    beaver: [
        [0, 0.32, 0.04],
        [0, 0.4, -0.32],
    ],
    fox: [
        [0, 0.48, 0.02],
        [0, 0.7, -0.37],
    ],
    mallard: [
        [0, 0.248, 0.04],
        [0, 0.518, -0.225],
    ],
    otter: [
        [0, 0.22, 0.03],
        [0, 0.28, -0.38],
    ],
    owl: [
        [0, 0.3, 0],
        [0, 0.58, -0.035],
    ],
    rabbit: [
        [0, 0.26, 0.04],
        [0, 0.37, -0.18],
    ],
    squirrel: [
        [0, 0.25, 0.02],
        [0, 0.455, -0.105],
    ],
    woodpecker: [
        [0, 0.21, 0.015],
        [0, 0.365, -0.04],
    ],
    raccoon: [
        [-0.15, 0.35, -0.2],
        [0.15, 0.35, -0.2],
        [0, 0.6, -0.4],
    ],
    heron: [
        [0, 0.2, 0],
        [0, 0.9, -0.05],
        [0, 1.45, -0.1],
    ],
    deer: [
        [0, 1.12, 0.1],
        [0, 1.64, -0.83],
    ],
};
export const SUBJECT_HEIGHT: Record<Species, number> = {
    badger: 0.551,
    beaver: 0.555,
    fox: 0.965,
    mallard: 0.623,
    otter: 0.385,
    owl: 0.79043,
    rabbit: 0.77,
    squirrel: 0.7,
    woodpecker: 0.485,
    raccoon: 0.703,
    heron: 1.56,
    deer: 1.9,
};

/**
 * Resolve deterministic head/neck angles for legacy species from behavior and simulation
 * tick.
 *
 * @param animal - Animal state
 * @param tick - Authoritative tick at 60 ticks per second
 * @returns Articulation angles in radians.
 */
export function animalArticulation(animal: Animal, tick: number) {
    const time = tick / 60;

    return {
        neckX:
      animal.species === 'deer' && animal.behavior === 'graze'
          ? -0.7 + 0.035 * Math.sin(time * 3)
          : 0,
        headX:
      (animal.species === 'raccoon'
          && ['inspect', 'wash'].includes(animal.behavior))
      || (animal.species === 'heron' && animal.behavior === 'feed')
          ? -(0.2 + 0.12 * Math.sin(time * 3))
          : (animal.species === 'raccoon' && animal.behavior === 'hat-reach'
                  ? 0.3
                  : 0),
        headY:
      animal.behavior === 'alert'
      || (animal.species === 'deer' && animal.behavior === 'settle')
          ? 0.3 * Math.sin(time * 1.5)
          : (animal.species === 'heron' && animal.behavior === 'preen'
                  ? 0.65 + 0.12 * Math.sin(time * 2)
                  : 0),
    };
}

/**
 * Resolve articulated local photo samples shared with rendering, preferring calibrated
 * wildlife-kit samples over legacy species geometry.
 *
 * @param animal - Animal state
 * @param tick - Authoritative shutter/render tick
 * @returns New model-local sample vectors; callers apply the animal's world pose.
 */
export function subjectPoints(animal: Animal, tick: number): Vec3[] {
    const wildlife = wildlifeSubjectPoints(animal, tick);

    if (wildlife) return wildlife;
    const points = SUBJECT_POINTS[animal.species].map((p) => [...p] as Vec3);

    if (animal.species === 'raccoon' || animal.species === 'heron') {
        const pivot: Vec3
                = animal.species === 'raccoon' ? [0, 0.45, -0.26] : [0, 1.446, -0.3],
            p = points[2],
            { headX, headY } = animalArticulation(animal, tick),
            x = p[0] - pivot[0],
            y = p[1] - pivot[1],
            z = p[2] - pivot[2],
            rx = x * Math.cos(headY) + z * Math.sin(headY),
            rz = -x * Math.sin(headY) + z * Math.cos(headY);

        p[0] = pivot[0] + rx;
        p[1] = pivot[1] + y * Math.cos(headX) - rz * Math.sin(headX);
        p[2] = pivot[2] + y * Math.sin(headX) + rz * Math.cos(headX);
    } else if (animal.species === 'deer') {
        const { neckX, headY } = animalArticulation(animal, tick),
            p = points[1],
            head: Vec3 = [0, 1.6, -0.74],
            neck: Vec3 = [0, 1.2, -0.46],
            x = p[0] - head[0],
            z = p[2] - head[2];

        p[0] = head[0] + x * Math.cos(headY) + z * Math.sin(headY);
        p[2] = head[2] - x * Math.sin(headY) + z * Math.cos(headY);
        const y = p[1] - neck[1],
            nz = p[2] - neck[2];

        p[1] = neck[1] + y * Math.cos(neckX) - nz * Math.sin(neckX);
        p[2] = neck[2] + y * Math.sin(neckX) + nz * Math.cos(neckX);
    }

    return points;
}
