import * as THREE from 'three/webgpu';
import { addAtmosphere } from './atmosphere.ts';
import type { ReserveBlueprint } from '../../shared/world/world.ts';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WorldPlacement } from '../../shared/world/level.ts';
import {
    surfaceHeight,
    type FixtureState,
    type Vec3,
} from '../../shared/shared.ts';

/**
 * Find the first imported partName match, falling back to an ordinary object-name lookup.
 *
 * @param root - Scene subtree to search
 * @param name - Authored part name
 * @returns Matching scene object, or undefined.
 */
export function findPart(root: THREE.Object3D, name: string) {
    let found: THREE.Object3D | undefined;

    root.traverse((o) => {
        if (o.userData.partName === name) found ??= o;
    });

    return found ?? root.getObjectByName(name);
}

/**
 * Create instanced meshes sharing imported geometry/materials while preserving each part's
 * complete world transform. Updates source world matrices before instancing.
 *
 * @param model - Imported model root
 * @param placements - World placements to instantiate
 * @returns Group of instanced meshes; dispose instance resources without disposing shared
 * asset buffers.
 */
export function instanceModel(
    model: THREE.Object3D,
    placements: WorldPlacement[],
): THREE.Group {
    const group = new THREE.Group();

    group.name = model.name;
    model.updateWorldMatrix(true, true);
    const transform = new THREE.Object3D(),
        matrix = new THREE.Matrix4();

    model.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        const instances = new THREE.InstancedMesh(
            part.geometry,
            part.material,
            placements.length,
        );

        instances.name = part.name;
        instances.castShadow = true;
        instances.receiveShadow = true;
        for (const [index, placement] of placements.entries()) {
            transform.position.set(...placement.position);
            transform.rotation.set(0, placement.yaw, 0);
            transform.scale.set(...placement.scale);
            transform.updateMatrix();
            matrix.multiplyMatrices(transform.matrix, part.matrixWorld);
            instances.setMatrixAt(index, matrix);
        }
        instances.instanceMatrix.needsUpdate = true;
        instances.computeBoundingBox();
        instances.computeBoundingSphere();
        group.add(instances);
    });

    return group;
}

/**
 * Build terrain, instanced scenery, fixtures, sky, and shadow lighting in the scene. Tracks
 * generated resources separately from shared imported assets.
 *
 * @param scene - Scene receiving the forest root
 * @param assets - Shared loaded model roots
 * @param world - Validated reserve blueprint
 * @returns Fixture update, shadow centering, disposal, and collected asset errors.
 */
export function addForest(
    scene: THREE.Scene,
    assets: Map<string, THREE.Group>,
    world: ReserveBlueprint,
) {
    const root = new THREE.Group();

    root.name = 'WillowmereForest';
    scene.add(root);
    const errors: string[] = [];
    const generatedGeometry = new Set<THREE.BufferGeometry>();
    const primitives: THREE.Mesh[] = [];
    const materials = new Map<number, THREE.MeshStandardMaterial>();

    /**
     * Reuse a rough terrain material by color within this forest owner.
     *
     * @param color - Hexadecimal RGB color
     * @returns Shared per-color material owned by this forest.
     */
    const material = (color: number) => {
        let value = materials.get(color);

        if (!value) {
            value = new THREE.MeshStandardMaterial({ color, roughness: 1 });
            materials.set(color, value);
        }

        return value;
    };

    /**
     * Create and register a generated terrain primitive for later batching and disposal.
     *
     * @param geometry - Generated geometry whose lifetime transfers to the forest
     * @param color - Hexadecimal RGB color
     * @param position - World position
     * @returns Mesh added to the forest root.
     */
    function mesh(geometry: THREE.BufferGeometry, color: number, position: Vec3) {
        generatedGeometry.add(geometry);
        const object = new THREE.Mesh(geometry, material(color));

        primitives.push(object);
        object.position.set(...position);
        object.receiveShadow = true;
        root.add(object);

        return object;
    }

    // eslint-disable-next-line unicorn/no-null -- Three.js requires null to clear a scene background.
    scene.background = null;
    const atmosphere = addAtmosphere(scene, root);

    // The distant floor is below the authored walkable surfaces and water.

    mesh(new THREE.BoxGeometry(700, 1, 700), 0x46_57_3C, [0, -1.55, 0]);

    /**
     * Find the highest authored walkable surface at a horizontal location for scenery
     * placement.
     *
     * @param x - World X coordinate
     * @param z - World Z coordinate
     * @returns Highest surface height, with -1 as the fallback below the terrain.
     */
    function ground(x: number, z: number) {
        let y = -1;

        for (const surface of world.walkables) {
            const height = surfaceHeight(surface, x, z);

            if (height !== undefined) y = Math.max(y, height);
        }

        return y;
    }

    for (const original of world.walkables) {
        const xs = [
            original.min[0],
            original.max[0],
            ...world.waters.flatMap((w) => [w.min[0], w.max[0]]),
        ]
            .filter((x) => x >= original.min[0] && x <= original.max[0])
            .toSorted((a, b) => a - b);
        const zs = [
            original.min[2],
            original.max[2],
            ...world.waters.flatMap((w) => [w.min[2], w.max[2]]),
        ]
            .filter((z) => z >= original.min[2] && z <= original.max[2])
            .toSorted((a, b) => a - b);

        /**
         * Add one nonempty dry terrain tile.
         *
         * @param xi - Tile boundary index on X.
         * @param zi - Tile boundary index on Z.
         */
        function addTile(xi: number, zi: number) {
            if (xs[xi] === xs[xi - 1] || zs[zi] === zs[zi - 1]) {
                return;
            }

            const cx = (xs[xi] + xs[xi - 1]) / 2,
                cz = (zs[zi] + zs[zi - 1]) / 2;

            if (
                world.waters.every(
                    (w) => !(cx > w.min[0] && cx < w.max[0] && cz > w.min[2] && cz < w.max[2]),
                )
            ) {
                const surface = {
                    ...original,
                    min: [xs[xi - 1], original.min[1], zs[zi - 1]] as Vec3,
                    max: [xs[xi], original.max[1], zs[zi]] as Vec3,
                };
                const corners = [
                    [surface.min[0], surface.min[2]],
                    [surface.min[0], surface.max[2]],
                    [surface.max[0], surface.max[2]],
                    [surface.max[0], surface.min[2]],
                ];
                const geometry = new THREE.BufferGeometry();

                geometry.setAttribute(
                    'position',
                    new THREE.Float32BufferAttribute(
                        corners.flatMap(([x, z]) => [
                            x,
                            (surfaceHeight(original, x, z) ?? original.heightStart) - 0.015,
                            z,
                        ]),
                        3,
                    ),
                );
                geometry.setIndex([0, 1, 2, 0, 2, 3]);
                geometry.computeVertexNormals();
                mesh(
                    geometry,
                    surface.id.includes('bank') ? 0x63_5B_43 : 0x50_63_44,
                    [0, 0, 0],
                );
            }
        }
        for (let xi = 1; xi < xs.length; xi++)
            for (let zi = 1; zi < zs.length; zi++) addTile(xi, zi);
    }
    for (const trail of world.trails) {
        for (let index = 1; index < trail.points.length; index++) {
            const a = trail.points[index - 1],
                b = trail.points[index];
            const dx = b[0] - a[0],
                dz = b[2] - a[2],
                length = Math.hypot(dx, dz);
            const segments = Math.max(1, Math.ceil(length / 1.5));

            for (let n = 0; n < segments; n++) {
                const t = (n + 0.5) / segments;
                const x = a[0] + dx * t,
                    z = a[2] + dz * t;

                if (world.walkables.some((s) => surfaceHeight(s, x, z) !== undefined)) {
                    const path = mesh(
                        new THREE.BoxGeometry(trail.width, 0.035, length / segments + 0.09),
                        0x8B_7F_5C,
                        [x, ground(x, z) - 0.015, z],
                    );

                    path.rotation.y = Math.atan2(dx, dz);
                }
            }
        }
    }
    for (const waterBounds of world.waters) {
        const width = waterBounds.max[0] - waterBounds.min[0];
        const depth = waterBounds.max[2] - waterBounds.min[2];
        const water = mesh(new THREE.BoxGeometry(2, 0.025, 2), 0x68_8F_91, [
            (waterBounds.min[0] + waterBounds.max[0]) / 2,
            waterBounds.max[1] - 0.025,
            (waterBounds.min[2] + waterBounds.max[2]) / 2,
        ]);

        water.scale.set(width * 0.5, 1, depth * 0.5);
        const waterMaterial = material(0x63_8F_91);

        waterMaterial.roughness = 0.3;
        waterMaterial.metalness = 0.25;
        water.material = waterMaterial;
    }

    const washPoints = world.pockets.flatMap((p) => p.anchors.filter((a) => a.kind === 'wash').map((a) => a.point));

    for (const point of washPoints) {
        const pool = mesh(new THREE.CylinderGeometry(1, 1, 0.015, 12), 0x63_8F_91, [
            point[0],
            point[1] + 0.024,
            point[2],
        ]);

        pool.scale.set(1.15, 1, 0.7);
    }

    /**
     * Find a named object among the loaded asset roots.
     *
     * @param name - Model object name
     * @returns Imported model object, or undefined.
     */
    function findModel(name: string): THREE.Object3D | undefined {
        for (const source of assets.values()) {
            const model = source.getObjectByName(name);

            if (model) return model;
        }
    }
    const byModel = new Map<string, WorldPlacement[]>();
    const gateLeaves: { id: string; leaf: THREE.Object3D }[] = [];

    for (const placement of world.placements) {
        const key = `${placement.model}:${Math.floor(placement.position[0] / 48)}:${Math.floor(placement.position[2] / 48)}`;
        const entries = byModel.get(key) ?? [];

        entries.push(placement);
        byModel.set(key, entries);
    }
    for (const placements of byModel.values()) {
        const name = placements[0].model;
        const model = findModel(name);

        if (!model) {
            errors.push(`Forest model missing: ${name}`);
            continue;
        }
        if (name === 'ForestGate') {
            for (const p of placements) {
                const gate = model.clone(true);

                gate.position.set(...p.position);
                gate.rotation.set(0, p.yaw, 0);
                gate.scale.set(...p.scale);
                root.add(gate);
                const leaf = findPart(gate, 'GateLeaf');

                if (leaf)
                    gateLeaves.push({
                        id: world.fixtures.find(
                            (f) => f.kind === 'gate'
                                && f.position.every((v, a) => v === p.position[a]),
                        )!.id,
                        leaf,
                    });
                else errors.push('ForestGate has no GateLeaf pivot');
            }
        } else root.add(instanceModel(model, placements));
    }

    const distantTrees = findModel('MaturePineA');

    if (distantTrees) {
        const ring: WorldPlacement[] = [];

        for (let index = 0; index < 150; index++) {
            const angle = index * 2.399963;
            const radius = 270 + (index % 7) * 18;

            ring.push({
                id: `horizon-${index}`,
                model: 'MaturePineA',
                position: [
                    Math.cos(angle) * radius,
                    -2 + Math.sin(index * 0.7) * 3,
                    Math.sin(angle) * radius,
                ],
                yaw: angle,
                scale: [
                    0.85 + (index % 3) * 0.1,
                    0.8 + (index % 4) * 0.13,
                    0.85 + (index % 3) * 0.1,
                ],
                solids: [],
                occluders: [],
            });
        }
        const horizon = instanceModel(distantTrees, ring);

        horizon.traverse((o) => {
            if (o instanceof THREE.Mesh) o.castShadow = false;
        });
        root.add(horizon);
    }
    for (let index = 0; index < 11; index++) {
        const angle = (index * Math.PI * 2) / 11;
        const ridge = mesh(new THREE.IcosahedronGeometry(1, 1), 0x53_72_6B, [
            Math.cos(angle) * 360,
            -24,
            Math.sin(angle) * 360,
        ]);

        ridge.scale.set(65, 42 + (index % 3) * 13, 58);
    }

    // Batch generated ground/trail pieces by material and spatial cell, keeping
    // imported model buffers shared and independently culled above.

    const batches = new Map<
        string,
        { material: THREE.Material; parts: THREE.BufferGeometry[] }
    >();

    for (const object of primitives) {
        object.updateMatrix();
        const material = object.material as THREE.Material,
            key = `${material.uuid}:${Math.floor(object.position.x / 48)}:${Math.floor(object.position.z / 48)}`;
        const batch = batches.get(key) ?? { material, parts: [] };

        batch.parts.push(object.geometry.clone().applyMatrix4(object.matrix));
        batches.set(key, batch);
        object.removeFromParent();
    }
    for (const batch of batches.values()) {
        const geometry = mergeGeometries(batch.parts);

        for (const geometry of batch.parts) geometry.dispose();
        if (!geometry) throw new Error('Forest geometry could not be batched');
        generatedGeometry.add(geometry);
        const object = new THREE.Mesh(geometry, batch.material);

        object.receiveShadow = true;
        root.add(object);
    }

    return {
        errors,

        /**
         * Set each gate leaf's visual rotation from authoritative fixture state.
         *
         * @param route - States indexed by fixture ID
         * @param tick - Authoritative live or frozen-photo tick; defaults to daylight
         */
        update(route: FixtureState, tick = 0) {
            atmosphere.update(tick);
            for (const { id, leaf } of gateLeaves)
                leaf.rotation.y = route[id].open ? Math.PI / 2 : 0;
        },

        centerShadows: atmosphere.centerShadows,

        /**
         * Release generated terrain/materials, instance buffers, sky, and shadow resources, then
         * detach the forest root. Shared imported asset geometry/materials remain cached.
         */
        dispose() {
            root.traverse((o) => {
                if (o instanceof THREE.InstancedMesh) o.dispose();
            });
            generatedGeometry.forEach((g) => g.dispose());
            materials.forEach((m) => m.dispose());
            atmosphere.dispose();
            root.removeFromParent();
        },
    };
}
