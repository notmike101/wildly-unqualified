import { generateReserve } from '../../src/shared/world/world.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three/webgpu';
import {
    addForest,
    findPart,
    instanceModel,
} from '../../src/client/rendering/forest-view.ts';

test('articulation resolves exporter-suffixed names within the correct model', () => {
    const caseModel = new THREE.Group(),
        screen = new THREE.Group();
    const handle = new THREE.Object3D(),
        otherHandle = new THREE.Object3D();

    handle.name = 'HandleL_004';
    handle.userData.partName = 'HandleL';
    otherHandle.name = 'HandleL';
    caseModel.add(handle);
    screen.add(otherHandle);
    assert.equal(findPart(caseModel, 'HandleL'), handle);
    assert.equal(findPart(screen, 'HandleL'), otherHandle);
    assert.equal(findPart(caseModel, 'Missing'), undefined);
});

test("forest instances keep each authored transform and the model's local branch offset", () => {
    const model = new THREE.Group();

    model.name = 'TestTree';
    const trunk = new THREE.Mesh(
        new THREE.BoxGeometry(1, 8, 1),
        new THREE.MeshStandardMaterial(),
    );

    trunk.position.set(0, 4, 0);
    model.add(trunk);
    const forest = instanceModel(model, [
        {
            id: 'a',
            model: 'TestTree',
            position: [10, 0, 20],
            yaw: 0,
            scale: [1, 1, 1],
            solids: [],
            occluders: [],
        },
        {
            id: 'b',
            model: 'TestTree',
            position: [-10, 2, 5],
            yaw: Math.PI / 2,
            scale: [2, 2, 2],
            solids: [],
            occluders: [],
        },
    ]);
    // eslint-disable-next-line unicorn/better-dom-traversing -- Three.js scene children are not DOM elements.
    const instances = forest.children[0] as THREE.InstancedMesh;

    assert.equal(instances.count, 2);
    const matrix = new THREE.Matrix4(),
        position = new THREE.Vector3();

    instances.getMatrixAt(0, matrix);
    position.setFromMatrixPosition(matrix);
    assert.deepEqual(position.toArray(), [10, 4, 20]);
    instances.getMatrixAt(1, matrix);
    position.setFromMatrixPosition(matrix);
    assert.deepEqual(position.toArray(), [-10, 10, 5]);
    const center = new THREE.Vector3(0, -4, 0).applyMatrix4(matrix);

    assert.ok(center.distanceTo(new THREE.Vector3(-10, 2, 5)) < 1e-6);
    assert.equal(instances.geometry, trunk.geometry);
    assert.equal(instances.material, trunk.material);
    instances.dispose();
    trunk.geometry.dispose();
    (trunk.material as THREE.Material).dispose();
});

test('generated brook wash pools remain visible above the trail surface', () => {
    const scene = new THREE.Scene();
    const world = generateReserve(1, 'forest-test'),
        forest = addForest(scene, new Map(), world);

    scene.updateMatrixWorld(true);
    const points = world.pockets
        .flatMap((p) => p.anchors)
        .filter((a) => a.kind === 'wash')
        .map((a) => a.point);

    try {
        for (const point of points) {
            const ray = new THREE.Raycaster(
                new THREE.Vector3(point[0], 2, point[2]),
                new THREE.Vector3(0, -1, 0),
                0,
                3,
            );
            const hit = ray.intersectObject(scene, true)[0];
            const surface = hit.object as THREE.Mesh<
                THREE.BufferGeometry,
                THREE.MeshStandardMaterial
            >;

            assert.equal(surface.material.color.getHex(), 0x63_8F_91);
        }
    } finally {
        forest.dispose();
    }
});
