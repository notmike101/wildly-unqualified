/**
 * Load a model and select its named scene object.
 *
 * @param file Model asset path to load.
 * @param name Display name or named scene node to select.
 * @returns The loaded scene object.
 */
async function load(file: string, name: string) {
    const bytes = await readFile(
        new URL(`../../public/models/${file}.glb`, import.meta.url),
    );
    const gltf = await new GLTFLoader().parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
    );
    const root = findPart(gltf.scene, name)!;

    root.removeFromParent();
    root.position.set(0, 0, 0);
    root.quaternion.identity();
    root.traverse((o) => {
        const mesh = o as Mesh;

        if (mesh.isMesh) {
            const loopItems3 = Array.isArray(mesh.material)
                ? mesh.material
                : [mesh.material];

            for (const m of loopItems3)
                m.side = DoubleSide;
        }
    });
    root.updateMatrixWorld(true);

    return root;
}
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
    Vector3,
    Raycaster,
    DoubleSide,
    type Object3D,
    type Mesh,
} from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { findPart } from '../../src/client/rendering/forest-view.ts';
import { subjectPoints } from '../../src/shared/world/level.ts';
import {
    wildlifeParts,
    rotate,
    xyz,
    sightBlocked,
} from '../../src/shared/wildlife/wildlife.ts';
import { SUPPORT_SOURCE_SHA256 } from '../../src/shared/wildlife/support-meshes.ts';
import { generateReserve } from '../../src/shared/world/world.ts';
import {
    ARCH_STANCES,
    SQUIRREL_CLIMB,
} from '../../src/shared/wildlife/wildlife-data.ts';
import {
    isRayBlocked,
    type Animal,
    type Behavior,
    type Vec3,
} from '../../src/shared/shared.ts';

test('support sight refinement matches preserved opaque GLBs through four quarter turns', async () => {
    const bytes = await readFile(
        new URL('../../public/models/forest-kit-v3.glb', import.meta.url),
    );

    assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        SUPPORT_SOURCE_SHA256,
    );
    const gltf = await new GLTFLoader().parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
    );
    const world = generateReserve(7, 'sight-geometry');

    // Geometry fixtures only: the separate command tests reach and photograph real birds.

    for (const name of ['RootArch', 'SnagTall']) {
        const source = findPart(gltf.scene, name)!;

        source.removeFromParent();
        source.position.set(0, 0, 0);
        source.quaternion.identity();
        source.traverse((o) => {
            const mesh = o as Mesh;

            if (mesh.isMesh) {
                const loopItems1 = Array.isArray(mesh.material)
                    ? mesh.material
                    : [mesh.material];

                for (const material of loopItems1)
                    material.side = DoubleSide;
            }
        });
        source.updateMatrixWorld(true);
        const original = world.placements.find((p) => p.model === name)!;
        const probes: [Vec3, Vec3, boolean][]
            = name === 'RootArch'
                ? [
                        [[-2.2, 1, 2], [-2.2, 1, -2], true],
                        [[0, 3.1, 2], [0, 3.1, -2], false],
                    ]
                : [
                        [[0, 3, 2], [0, 3, -2], true],
                        [[0, 3, 2], [0, 3, 0.74], false],
                    ];

        for (let turn = 0; turn < 4; turn++) {
            const placement = {
                ...original,
                position: [17, 0, -11] as Vec3,
                yaw: (turn * Math.PI) / 2,
            };
            const fixture = { ...world, placements: [placement] };
            const transform = (p: Vec3) => rotate(p, xyz([0, placement.yaw, 0])).map(
                (v, index) => v + placement.position[index],
            ) as Vec3;

            for (const [from, to, blocked] of probes) {
                const direction = new Vector3(...to).sub(new Vector3(...from));
                const isActual
                    = new Raycaster(
                        new Vector3(...from),
                        direction.clone().normalize(),
                        1e-5,
                        direction.length() - 1e-5,
                    ).intersectObject(source, true).length > 0;

                assert.equal(isActual, blocked, `${name} actual mesh probe`);
                const corners = [
                    [-3, 0, -2],
                    [3, 14, 2],
                ].map((p) => transform(p as Vec3));
                const box = {
                    id: placement.id + '-probe',
                    min: corners[0].map((v, index) => Math.min(v, corners[1][index]),
                    ) as Vec3,
                    max: corners[0].map((v, index) => Math.max(v, corners[1][index]),
                    ) as Vec3,
                };

                assert.equal(
                    sightBlocked(fixture, transform(from), transform(to), [box]),
                    isActual,
                    `${name} turn ${turn}`,
                );
                assert.ok(
                    isRayBlocked(transform(from), transform(to), [box]),
                    'conservative movement box remains solid',
                );
                assert.equal(
                    sightBlocked(fixture, transform(from), transform(to), [
                        { ...box, id: 'unrelated-wall' },
                    ]),
                    true,
                    'unrelated geometry is never waived',
                );
            }
        }
    }
});

test('frozen v4 characteristic poses agree with real exported head/body attachments', async () => {
    const bytes = await readFile(
        new URL('../../public/models/wildlife-kit-v4.glb', import.meta.url),
    );
    const gltf = await new GLTFLoader().parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
    );
    const actions: [Animal['species'], Behavior][] = [
        ['fox', 'pounce'],
        ['rabbit', 'nibble'],
        ['squirrel', 'cache'],
        ['beaver', 'gnaw'],
        ['otter', 'groom'],
        ['badger', 'dig'],
        ['owl', 'roost'],
        ['woodpecker', 'tap'],
        ['mallard', 'dabble'],
    ];

    // Geometry-only fixtures: these do not establish action accessibility. That
    // comes from the ordinary-command, real-tick expedition-wildlife tests.

    for (const [species, action] of actions) {
        const source = findPart(
            gltf.scene,
            species[0].toUpperCase() + species.slice(1),
        )!;
        const model = source.clone(true);

        for (const behavior of [action, 'wander' as const, action]) {
            const animal: Animal = {
                id: `pose-${species}`,
                species,
                behavior,
                pose: { position: [13, 2, -7], rotation: xyz([0.12, 1.2, -0.07]) },
                target: [14, 2, -8],
                remaining: 2,
            };
            const frozen = structuredClone(animal);
            const tick = 937;

            const items1 = Object.entries(wildlifeParts(frozen, tick));

            for (const [name, angles] of items1) {
                findPart(model, name)?.rotation.set(...angles, 'XYZ');
            }
            model.position.set(...frozen.pose.position);
            model.quaternion.set(...frozen.pose.rotation);
            model.updateMatrixWorld(true);
            const actual = ['PhotoBody', 'PhotoHead'].map((name) => findPart(model, name)!.getWorldPosition(new Vector3()),
            );
            const expected = subjectPoints(frozen, tick).map((point) => new Vector3(...rotate(point, frozen.pose.rotation)).add(
                new Vector3(...frozen.pose.position),
            ),
            );

            const loopItems2 = actual.entries();

            for (const [index, point] of loopItems2) {
                assert.ok(
                    point.distanceTo(expected[index]) < 0.00015,
                    `${species}/${behavior}/${index}: CPU and exported hierarchy differ by ${point.distanceTo(expected[index])}m`,
                );
            }
            animal.behavior = 'alert';
            animal.pose.position[0] += 100;
            assert.deepEqual(
                subjectPoints(frozen, tick),
                subjectPoints(structuredClone(frozen), tick),
            );
        }
    }
});

test('calibrated crown pose data retains proper unit rotations', () => {
    assert.equal(ARCH_STANCES.length, 4);
    for (const pose of ARCH_STANCES) {
        assert.ok(Math.abs(Math.hypot(...pose.rotation) - 1) < 1e-10);
        assert.ok(pose.position[1] > 3.6 && pose.position[1] < 4);
    }
});

test('actual moving squirrel meshes retain bark contact without material body/head penetration', async () => {
    const tree = await load('forest-kit-v3', 'RootArch'),
        model = await load('wildlife-kit-v4', 'Squirrel');

    /**
     * Collect geometry points beneath a named scene object.
     *
     * @param name Display name or named scene node to select.
     * @returns The collected model points.
     */
    function points(name: string) {
        const root = findPart(model, name)!,
            result: Vector3[] = [];

        /**
         * Inspect geometry in this scene subtree.
         *
         * @param o Scene object whose descendants are inspected.
         */
        function visit(o: Object3D) {
            if (o !== root && o.userData.partName) return;
            const mesh = o as Mesh;

            if (mesh.isMesh) {
                const p = mesh.geometry.attributes.position;

                for (let index = 0; index < p.count; index++)
                    result.push(
                        new Vector3()
                            .fromBufferAttribute(p, index)
                            .applyMatrix4(mesh.matrixWorld),
                    );
            }
            for (const c of o.children) visit(c);
        }
        visit(root);

        return result;
    }
    const items2 = SQUIRREL_CLIMB.entries();

    for (const [index, at] of items2) {
        const wrap = Math.max(0, (index - 60) / 24);
        const animal: Animal = {
            id: 'mesh-climber',
            species: 'squirrel',
            behavior: 'climb',
            pose: at,
            target: at.position,
            remaining: -1 + (0.99 * index) / 84,
        };

        const items3 = Object.entries(wildlifeParts(animal, 900));

        for (const [name, angles] of items3)
            findPart(model, name)?.rotation.set(...angles, 'XYZ');
        model.position.set(...at.position);
        model.quaternion.set(...at.rotation);
        model.updateMatrixWorld(true);
        const normal = new Vector3(
            0,
            Math.sin((wrap * Math.PI) / 2),
            Math.cos((wrap * Math.PI) / 2),
        );
        const hindGaps: number[] = [];

        for (const name of [
            'Body',
            'Head',
            'LegBL',
            'LegBR',
            'ForepawL',
            'ForepawR',
        ]) {
            const gaps = points(name).map((p) => {
                const hit = new Raycaster(
                    p.clone().addScaledVector(normal, 2),
                    normal.clone().negate(),
                    0,
                    4,
                ).intersectObject(tree, true)[0];

                return hit ? p.clone().sub(hit.point).dot(normal) : Infinity;
            });
            const minimum = Math.min(...gaps);

            assert.ok(
                minimum >= -0.003,
                `${name} penetrates arch at sample ${index}: ${minimum}m`,
            );
            if (name === 'LegBL' || name === 'LegBR') hindGaps.push(minimum);
        }
        assert.ok(
            Math.min(...hindGaps) < 0.005,
            `both hind paws lose bark support at ${index}`,
        );
    }
});
