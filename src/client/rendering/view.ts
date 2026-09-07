import { addFieldScenery } from './view-scenery.ts';
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
    PROP_CENTER_HEIGHT,
    PROP_DEFINITIONS,
    animalArticulation,
    fixtureBoxes,
} from '../../shared/world/level.ts';
import {
    residentName,
    type ReserveBlueprint,
} from '../../shared/world/world.ts';
import {
    eye,
    distance,
    isRayBlocked,
    equipmentTarget,
    heldProperty,
    propertyPoint,
    type Snapshot,
    type Vec3,
} from '../../shared/shared.ts';
import { addForest, findPart } from './forest-view.ts';
import { wildlifeParts, sightBlocked } from '../../shared/wildlife/wildlife.ts';
import { CREW_COLORS } from './view-constants.ts';
export { CREW_COLORS, CAMERA_FAR } from './view-constants.ts';
const palette = CREW_COLORS;

/**
 * Apply camera prediction to the rendered carry group, shifting held equipment and
 * participating players together. Call only on a render snapshot, never authority or frozen
 * photo data.
 *
 * @param state - Render-only snapshot to mutate
 * @param localId - Local player ID
 * @param position - Predicted local player foot position
 */
export function alignLocalCarry(
    state: Snapshot,
    localId: string,
    position: Vec3,
) {
    const local = state.players.find((p) => p.id === localId);
    const carried = heldProperty(localId, state.props);

    if (!local || (!carried && state.tin.holder !== localId)) return;

    // Apply camera prediction to the rendered carry group only; photos use authority.

    const delta = position.map((n, index) => n - local.position[index]);

    /**
     * Apply the current prediction displacement to a world point.
     *
     * @param point - Original world point
     * @returns New shifted point.
     */
    const shift = (point: Vec3) => point.map((n, index) => n + delta[index]) as Vec3;

    if (carried) carried.pose.position = shift(carried.pose.position);
    else state.tin.pose.position = shift(state.tin.pose.position);
    for (const p of state.players)
        if (p.id === localId || carried?.holders.includes(p.id))
            p.position = shift(p.position);
}

import { loadAsset } from './view-assets.ts';
export { loadAsset } from './view-assets.ts';

/**
 * Load shared assets and build one reserve's visual state. Collects asset errors for the
 * caller to inspect; returned disposal releases owned resources while preserving cached
 * imports.
 *
 * @param scene - Scene owned by this view
 * @param world - Validated reserve blueprint
 * @returns View update, shadow centering, world ID, disposal, and asset errors.
 */
export async function createView(scene: THREE.Scene, world: ReserveBlueprint) {
    const loader = new GLTFLoader();
    const assets = new Map<string, THREE.Group>();
    const ownedMaterials = new Set<THREE.Material>();
    const actors = new Map<string, THREE.Object3D>();
    const bases = new Map<THREE.Object3D, THREE.Euler>();

    /**
     * Create a rough standard material and register it for view disposal.
     *
     * @param color - Hexadecimal RGB color
     * @returns New material owned by the view.
     */
    function material(color: number) {
        const m = new THREE.MeshStandardMaterial({ color, roughness: 1 });

        ownedMaterials.add(m);

        return m;
    }

    /**
     * Create a shadow-casting mesh with an owned material and add it to the scene.
     *
     * @param geometry - Geometry whose lifetime transfers to the view
     * @param color - Hexadecimal RGB color
     * @param position - World position
     * @param scale - Per-axis scale, default unit scale
     * @returns New scene mesh owned by the view.
     */
    function mesh(
        geometry: THREE.BufferGeometry,
        color: number,
        position: Vec3,
        scale: Vec3 = [1, 1, 1],
    ) {
        const o = new THREE.Mesh(geometry, material(color));

        o.position.set(...position);
        o.scale.set(...scale);
        o.castShadow = true;
        o.receiveShadow = true;
        scene.add(o);

        return o;
    }
    const errors: string[] = [];

    for (const name of [
        'raccoon',
        'heron',
        'field-kit',
        'reserve-kit',
        'forest-kit-v3',
        'deer-v3',
        'researcher-forest-v3',
        'headwear-v3',
        'expedition-kit-v3',
        'raccoon-dark',
        'heron-reed',
        'wildlife-kit-v4',
        'wildlife-habitat-v4',
    ]) {
        try {
            const gltf = await loadAsset(name, loader);

            assets.set(name, gltf.scene);
            gltf.scene.traverse((o) => {
                if (!(o instanceof THREE.Mesh)) {
                    return;
                }

                o.castShadow = true;
                o.receiveShadow = true;
            });
        } catch (error) {
            errors.push(`${name}: ${String(error)}`);
        }
    }

    /**
     * Clone an imported actor hierarchy and remember base rotations for animation. Geometry and
     * unchanged materials remain shared.
     *
     * @param name - Asset/species name
     * @returns Cloned actor root, or undefined if its source asset is missing.
     */
    function clone(name: string) {
        const source
            = assets.get(name)
                ?? (assets.has('wildlife-kit-v4')
                    ? findPart(
                            assets.get('wildlife-kit-v4')!,
                            name[0].toUpperCase() + name.slice(1),
                        )
                    : undefined);

        if (!source) return;
        const model = source.clone(true);

        model.traverse((o) => bases.set(o, o.rotation.clone()));

        return model;
    }

    /**
     * Clone a named field object from loaded assets, remember base rotations, and mount it in
     * the scene.
     *
     * @param name - Imported object name
     * @param pos - World position
     * @param scale - Uniform scale multiplier, default 1
     * @returns Mounted object, or undefined when no source object exists.
     */
    function field(name: string, pos: Vec3, scale = 1) {
        const source = assets
            .values()
            .map((group) => group.getObjectByName(name))
            .find(Boolean);

        if (!source) return;
        const o = source.clone(true);

        o.traverse((part) => bases.set(part, part.rotation.clone()));
        o.position.set(...pos);
        o.scale.multiplyScalar(scale);
        scene.add(o);

        return o;
    }
    const forest = addForest(scene, assets, world);

    errors.push(...forest.errors);
    addFieldScenery(scene, world, assets, ownedMaterials, mesh, field);
    const tin
        = field('Tin', [...world.tinStart])
            ?? mesh(new THREE.CylinderGeometry(0.147, 0.147, 0.218, 10), 0xCA_AE_60, [
                ...world.tinStart,
            ]);

    /**
     * Reuse or create an actor by ID, cloning its model or a fallback and applying crew colors
     * where applicable.
     *
     * @param id - Stable player or resident ID
     * @param species - Model/species name
     * @param index - Crew palette index, default 0
     * @returns Cached scene actor for this ID.
     */
    function actor(id: string, species: string, index = 0) {
        let o = actors.get(id);

        if (o) return o;
        const imported = clone(species);

        o = imported ?? new THREE.Group();
        if (!imported) {
            const body = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.3, 0.8, 4, 8),
                material(palette[index % 4]),
            );

            body.position.y = 0.8;
            o.add(body);
        }
        if (species.startsWith('researcher'))
            o.traverse((part) => {
                if (!(part instanceof THREE.Mesh)) {
                    return;
                }

                const old = Array.isArray(part.material)
                    ? part.material
                    : [part.material];

                part.material = old.map((m) => {
                    if (!['Outfit', 'Raincoat', 'Vest', 'CrewAccent'].includes(m.name))
                        return m;
                    const c = m.clone() as THREE.MeshStandardMaterial;

                    c.color.setHex(palette[index % 4]);
                    ownedMaterials.add(c);

                    return c;
                });
                if (old.length === 1)
                    part.material = (part.material as THREE.Material[])[0];
            });
        scene.add(o);
        actors.set(id, o);

        return o;
    }
    const pingMeshes = new Map<string, THREE.Object3D>();
    const equipment = new Map<string, THREE.Object3D>();
    const gripMaterials = new WeakMap<
        THREE.Object3D,
        THREE.MeshStandardMaterial[]
    >();
    const handleBadges = new Map<string, THREE.Sprite>();
    const badgeMaterials = [undefined, 0, 1, 2, 3].map((slot) => {
        const canvas = document.createElement('canvas');

        canvas.width = 64;
        canvas.height = 64;
        const c = canvas.getContext('2d')!;

        c.fillStyle
            = slot === undefined
                ? '#fff2c9'
                : `#${palette[slot].toString(16).padStart(6, '0')}`;
        c.beginPath();
        c.arc(32, 32, 28, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#14251f';
        c.font = 'bold 38px sans-serif';
        c.textAlign = 'center';
        c.fillText(slot === undefined ? '+' : String(slot + 1), 32, 45);
        const texture = new THREE.CanvasTexture(canvas);

        texture.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.SpriteMaterial({
            map: texture,
            depthTest: true,
            depthWrite: false,
            toneMapped: false,
        });

        ownedMaterials.add(m);

        return m;
    });
    const crossingGuides = world.fixtures
        .filter((f) => f.kind === 'crossing')
        .flatMap((f) => Object.entries(f.seats).map(([seat, placement]) => ({
            id: f.id,
            plankId: f.plankId,
            seat,
            placement,
        })),
        )
        .map(({ id, plankId, seat, placement }) => {
            const guideMaterial = new THREE.MeshBasicMaterial({
                color: 0xE7_CF_86,
                transparent: true,
                opacity: 0.35,
                depthWrite: false,
            });

            ownedMaterials.add(guideMaterial);
            const guide = new THREE.Mesh(
                new THREE.BoxGeometry(3.2, 0.025, 0.65),
                guideMaterial,
            );

            guide.position.set(...placement.position);
            guide.quaternion.set(...placement.rotation);
            guide.visible = false;
            scene.add(guide);
            for (const x of [-1.51, 1.51]) {
                const mark = mesh(
                    new THREE.BoxGeometry(0.16, 0.012, 0.76),
                    0xE7_CF_86,
                    [0, 0, 0],
                );

                mark.position
                    .set(x, -0.085, 0)
                    .applyQuaternion(guide.quaternion)
                    .add(guide.position);
                mark.quaternion.copy(guide.quaternion);
            }

            return { id, plankId, seat, placement, guide };
        });
    const headwear = new Map<string, THREE.Object3D>();
    const piles = new Map<string, THREE.Object3D>();
    const offset = new THREE.Vector3();
    const labels = new Map<
        string,
        { sprite: THREE.Sprite; name: string; texture: THREE.CanvasTexture }
    >();

    /**
     * Reuse a crew label or replace it when the name changes, disposing the previous label
     * texture/material.
     *
     * @param id - Player ID
     * @param name - Display name
     * @param slot - Zero-based crew color/number slot
     * @returns Scene sprite for the player's name and slot.
     */
    function playerLabel(id: string, name: string, slot: number) {
        const prior = labels.get(id);

        if (prior?.name === name) return prior.sprite;
        if (prior) {
            prior.sprite.removeFromParent();
            prior.texture.dispose();
            prior.sprite.material.dispose();
        }
        const canvas = document.createElement('canvas');

        canvas.width = 512;
        canvas.height = 88;
        const context = canvas.getContext('2d')!;

        context.fillStyle = '#162b24';
        context.fillRect(0, 0, 512, 88);
        context.fillStyle = '#' + palette[slot].toString(16).padStart(6, '0');
        context.fillRect(0, 0, 72, 88);
        context.fillStyle = '#14251f';
        context.font = 'bold 42px sans-serif';
        context.fillText(String(slot + 1), 23, 59);
        context.fillStyle = '#fff6e4';
        context.font = 'bold 36px sans-serif';
        const text = name.length > 18 ? name.slice(0, 17) + '…' : name;

        context.fillText(text, 90, 57, 402);
        const texture = new THREE.CanvasTexture(canvas);

        texture.colorSpace = THREE.SRGBColorSpace;
        const labelMaterial = new THREE.SpriteMaterial({
            map: texture,
            depthTest: true,
            depthWrite: false,
            toneMapped: false,
        });

        ownedMaterials.add(labelMaterial);
        const sprite = new THREE.Sprite(labelMaterial);

        sprite.name = 'CrewName';
        sprite.scale.set(2.8, 0.48, 1);
        scene.add(sprite);
        labels.set(id, { sprite, name, texture });

        return sprite;
    }

    /**
     * Apply authoritative or render-only snapshot poses, animation, equipment, incidents, and
     * UI markers to this reserve's scene. Photo mode suppresses interactive overlays.
     *
     * @param state - Snapshot belonging to this view's world
     * @param localId - Local player or photographer ID
     * @param isPhoto - Render a frozen photograph when true, default false
     * @throws {Error} Snapshot and view world IDs differ.
     */
    function update(state: Snapshot, localId: string, isPhoto = false) {
        const alive = new Set<string>();
        const local = state.players.find((p) => p.id === localId);

        if (state.worldId !== world.id) throw new Error('View world mismatch');
        const occluders = [
            ...world.walls,
            ...fixtureBoxes(world.fixtures, state.route),
        ];
        const target
            = local && !heldProperty(localId, state.props) && state.tin.holder !== localId
                ? equipmentTarget(local, state.props, PROP_DEFINITIONS, occluders)
                : undefined;

        for (const p of state.players) {
            const index = p.slot;
            const o = actor(p.id, 'researcher-forest-v3', index);

            alive.add(p.id);
            o.visible = p.connected && p.id !== localId;
            o.position.set(...p.position);
            o.rotation.y = p.yaw;
            o.scale.y = p.lastInput?.crouch ? 0.7 : 1;
            const label = playerLabel(p.id, p.name, index);
            const labelWidth = Math.min(
                2.8,
                local ? distance(local.position, p.position) * 0.23 : 2.8,
            );

            label.scale.set(labelWidth, labelWidth * 0.17, 1);
            label.position.set(
                p.position[0],
                p.position[1] + (p.lastInput?.crouch ? 1.85 : 2.55),
                p.position[2],
            );
            label.visible
                = !isPhoto
                    && o.visible
                    && !!local
                    && distance(local.position, p.position) < 24
                    && !isRayBlocked(
                        eye(local),
                        [p.position[0], p.position[1] + 1.7, p.position[2]],
                        occluders,
                    );
            for (const n of ['LegL', 'LegR', 'ArmL', 'ArmR']) {
                const part = findPart(o, n);

                if (part) {
                    part.rotation.copy(bases.get(part) ?? new THREE.Euler());
                    if (p.lastInput && (p.lastInput.x || p.lastInput.z))
                        part.rotation.x
                            += Math.sin(state.tick * 0.15 + (n.endsWith('R') ? Math.PI : 0))
                                * 0.35;
                }
            }
        }
        forest.update(state.route);
        const variant = world.seed % 2;

        for (const a of state.animals) {
            let model: string = a.species;

            if (a.species === 'deer') model = 'deer-v3';
            else if (variant && ['raccoon', 'heron'].includes(a.species))
                model = a.species === 'raccoon' ? 'raccoon-dark' : 'heron-reed';
            const o = actor(a.id, model);

            alive.add(a.id);
            o.visible = true;
            o.position.set(...a.pose.position);
            o.quaternion.set(...a.pose.rotation);
            const fieldLabel = playerLabel(
                a.id,
                residentName(world, a.id),
                world.residents
                    .filter((r) => r.species === a.species)
                    .findIndex((r) => r.id === a.id) % 4,
            );

            fieldLabel.position.set(
                a.pose.position[0],
                a.pose.position[1]
                + (a.species === 'deer' ? 2.2 : (a.species === 'heron' ? 1.9 : 1.15)),
                a.pose.position[2],
            );
            fieldLabel.scale.set(2.1, 0.36, 1);
            fieldLabel.visible
                = !isPhoto
                    && !!local
                    && distance(local.position, a.pose.position) < 18
                    && !sightBlocked(
                        world,
                        eye(local),
                        [a.pose.position[0], a.pose.position[1] + 0.5, a.pose.position[2]],
                        occluders,
                    );
            const phase = state.tick / 60;

            if (!['raccoon', 'deer', 'heron'].includes(a.species)) {
                const partAngles = wildlifeParts(a, state.tick);

                for (const [name, angles] of Object.entries(partAngles)) {
                    const part = findPart(o, name);

                    if (part) part.rotation.set(...angles, 'XYZ');
                }

                continue;
            }
            const isWalking
                = ['wander', 'approach', 'carry', 'investigate', 'retreat'].includes(
                    a.behavior,
                ) && distance(a.pose.position, a.target) > 0.2;

            for (const n of [
                'LegL',
                'LegR',
                'HindLegL',
                'HindLegR',
                'LegFL',
                'LegFR',
                'LegBL',
                'LegBR',
            ]) {
                const part = findPart(o, n);

                if (part) {
                    const b = bases.get(part);

                    part.rotation.copy(b ?? new THREE.Euler());
                    if (isWalking)
                        part.rotation.x
                            += Math.sin(phase * 8 + (n.endsWith('R') ? Math.PI : 0)) * 0.28;
                    if (
                        a.species === 'raccoon'
                        && a.behavior === 'wash'
                        && ['LegL', 'LegR'].includes(n)
                    )
                        part.rotation.x
                            += -0.65 + Math.sin(phase * 11 + (n === 'LegR' ? Math.PI : 0)) * 0.3;
                    if (a.behavior === 'hat-reach' && ['LegL', 'LegR'].includes(n))
                        part.rotation.x += -1.15 + Math.sin(phase * 6) * 0.15;
                }
            }
            const wingParts = a.species === 'heron' ? ['WingL', 'WingR'] : [];

            for (const n of wingParts) {
                const part = findPart(o, n);

                if (part) {
                    part.rotation.copy(bases.get(part) ?? new THREE.Euler());
                    part.rotation.z
                        += (n === 'WingL' ? 1 : -1)
                            * (a.behavior === 'display' || a.behavior === 'retreat'
                                ? Math.sin(phase * 3) * 0.08
                                : 1);
                }
            }
            const articulation = animalArticulation(a, state.tick);
            const neck = findPart(o, 'Neck');

            if (neck) {
                neck.rotation.copy(bases.get(neck) ?? new THREE.Euler());
                neck.rotation.x += articulation.neckX;
            }
            const head = findPart(o, 'Head');

            if (head) {
                head.rotation.copy(bases.get(head) ?? new THREE.Euler());
                head.rotation.x += articulation.headX;
                head.rotation.y += articulation.headY;
            }
            for (const n of ['EarL', 'EarR']) {
                const ear = findPart(o, n);

                if (ear) {
                    ear.rotation.copy(bases.get(ear) ?? new THREE.Euler());
                    ear.rotation.z
                        += (n === 'EarL' ? 1 : -1)
                            * (a.behavior === 'alert' ? -0.18 : Math.sin(phase * 1.5) * 0.035);
                }
            }
        }
        for (const [id, o] of actors) if (!alive.has(id)) o.visible = false;
        for (const [id, label] of labels)
            if (!alive.has(id)) label.sprite.visible = false;
        const propertyModels = {
            case: 'FieldCase',
            plank: 'CrossingPlank',
            screen: 'FoldingScreen',
            decoy: 'WildlifeDecoy',
        };

        for (const p of state.props) {
            let object = equipment.get(p.id);

            if (!object) {
                object = field(propertyModels[p.kind], [0, 0, 0]);
                if (!object) continue;
                if (p.kind === 'decoy') {
                    const fill = new THREE.Mesh(
                        new THREE.DodecahedronGeometry(0.075, 0),
                        material(0xDE_C3_78),
                    );

                    fill.name = 'BaitFill';
                    fill.scale.set(1, 0.45, 1);
                    fill.position.y = 0.02;
                    findPart(object, 'BaitCup')?.add(fill);
                }
                equipment.set(p.id, object);
            }
            object.quaternion.set(...p.pose.rotation);
            object.position
                .set(...p.pose.position)
                .add(
                    offset
                        .set(0, -PROP_CENTER_HEIGHT[p.kind], 0)
                        .applyQuaternion(object.quaternion),
                );
            const lid = findPart(object, 'Lid');
            const fill = object.getObjectByName('BaitFill');

            if (fill) fill.visible = p.open;
            if (lid) {
                lid.rotation.copy(bases.get(lid) ?? new THREE.Euler());
                if (p.open) lid.rotation.x += 1.1;
            }
            const definition = PROP_DEFINITIONS[p.kind];

            for (const [index, point] of definition.handles.entries()) {
                const owner = state.players.find(
                    (player) => player.id === p.holders[index],
                );
                const part = findPart(
                    object!,
                    p.kind === 'decoy' ? 'Handle' : (index === 0 ? 'HandleL' : 'HandleR'),
                );

                if (part) {
                    let materials = gripMaterials.get(part);

                    if (!materials) {
                        materials = [];
                        part.traverse((node) => {
                            if (!(node instanceof THREE.Mesh)) return;

                            /**
                             * Clone a handle material for independent grip highlighting and register it with the view
                             * and grip cache.
                             *
                             * @param source - Shared source material
                             * @returns New owned highlight material.
                             */
                            const replace = (source: THREE.Material) => {
                                const m = source.clone() as THREE.MeshStandardMaterial;

                                ownedMaterials.add(m);
                                materials!.push(m);

                                return m;
                            };

                            node.material = Array.isArray(node.material)
                                ? node.material.map((source) => replace(source))
                                : replace(node.material);
                        });
                        gripMaterials.set(part, materials);
                    }
                    for (const m of materials)
                        m.color?.setHex(owner ? palette[owner.slot] : 0xE7_CF_86);
                }
                const key = `${p.id}:${index}`;
                let badge = handleBadges.get(key);

                if (!badge) {
                    badge = new THREE.Sprite(badgeMaterials[0]);
                    handleBadges.set(key, badge);
                    scene.add(badge);
                }
                badge.position.set(...propertyPoint(point, p.pose));
                badge.position.y += 0.22;
                badge.material = badgeMaterials[owner ? owner.slot + 1 : 0];
                const isSelected = target?.propId === p.id && target.handle === index;

                badge.scale.setScalar(isSelected ? 0.22 : 0.15);
                badge.visible
                    = !isPhoto
                        && !!local
                        && !p.placed
                        && distance(local.position, badge.position.toArray() as Vec3) < 5
                        && !isRayBlocked(eye(local), badge.position.toArray() as Vec3, occluders);
            }
        }
        const carriedPlank = state.props.find(
            (p) => p.kind === 'plank' && p.holders.includes(localId),
        );

        for (const { id, plankId, placement, guide } of crossingGuides) {
            guide.visible
                = !isPhoto
                    && !state.route[id].open
                    && !!carriedPlank
                    && carriedPlank.id === plankId
                    && !!local
                    && distance(local.position, guide.position.toArray() as Vec3) < 9;
            if (carriedPlank && guide.visible) {
                const isAligned
                    = distance(carriedPlank.pose.position, placement.position) <= 0.75
                        && Math.abs(
                            new THREE.Quaternion(...carriedPlank.pose.rotation).dot(
                                new THREE.Quaternion(...placement.rotation),
                            ),
                        ) >= Math.cos(Math.PI / 18);

                (guide.material as THREE.MeshBasicMaterial).color.setHex(
                    isAligned ? 0x86_D7_A8 : 0xE7_CF_86,
                );
            }
        }
        for (const [owner, hat] of headwear)
            hat.visible = state.hats.some((h) => h.owner === owner);
        for (const h of state.hats) {
            const player = state.players.find((p) => p.id === h.owner);

            if (!player) continue;
            let hat = headwear.get(h.owner);

            if (!hat) {
                hat = field(
                    ['HatBrim', 'HatBeanie', 'HatCap', 'HatBucket'][player.slot],
                    [0, 0, 0],
                );
                if (!hat) continue;
                hat.traverse((o) => {
                    if (!(o instanceof THREE.Mesh)) {
                        return;
                    }

                    /**
                     * Replace only the hat's CrewAccent material with an owned crew-colored material.
                     *
                     * @param m - Original hat material
                     * @returns New accent material, or the unchanged shared material.
                     */
                    const replace = (m: THREE.Material) => (m.name === 'CrewAccent' ? material(palette[player.slot]) : m);

                    o.material = Array.isArray(o.material)
                        ? o.material.map((m) => replace(m))
                        : replace(o.material);
                });
                headwear.set(h.owner, hat);
            }
            hat.visible
                = h.carrier !== 'owner' || (player.connected && player.id !== localId);
            const parent = actors.get(
                h.carrier.startsWith('animal:') ? h.carrier.slice(7) : h.owner,
            );
            const mount
                = parent
                    && findPart(parent, h.carrier.startsWith('animal:') ? 'Head' : 'HatMount');

            if (mount && h.carrier !== 'ground') {
                mount.updateWorldMatrix(true, false);
                mount.getWorldPosition(hat.position);
                mount.getWorldQuaternion(hat.quaternion);
                if (h.carrier.startsWith('animal:')) hat.position.y += 0.23;
            } else {
                hat.position.set(...h.position);
                hat.quaternion.identity();
            }
        }
        for (const [id, pile] of piles)
            pile.visible = state.spills.some((s) => s.id === id);
        for (const spill of state.spills) {
            let pile = piles.get(spill.id);

            if (!pile) {
                pile = mesh(
                    new THREE.DodecahedronGeometry(0.16, 0),
                    0xB9_95_54,
                    spill.position,
                    [1, 0.35, 1],
                );
                piles.set(spill.id, pile);
            }
            pile.visible = spill.portions > 0;
            pile.position.set(
                spill.position[0],
                spill.position[1] + 0.06,
                spill.position[2],
            );
        }
        tin.quaternion.set(...state.tin.pose.rotation);
        tin.position
            .set(...state.tin.pose.position)
            .add(offset.set(0, -0.109, 0).applyQuaternion(tin.quaternion));
        for (const [id, o] of pingMeshes)
            o.visible = state.pings.some((p) => p.player === id);
        for (const p of state.pings) {
            let o = pingMeshes.get(p.player);

            if (!o) {
                const slot
                    = state.players.find((player) => player.id === p.player)?.slot ?? 0;

                o = mesh(new THREE.ConeGeometry(0.2, 0.5, 5), palette[slot], [
                    ...p.point,
                ]);
                pingMeshes.set(p.player, o);
            }
            o.visible = !isPhoto;
            o.position.set(
                p.point[0],
                2 + Math.sin(state.seconds * 3) * 0.2,
                p.point[2],
            );
            o.rotation.z = Math.PI;
        }
    }

    /**
     * Release scene-owned geometry, materials, and textures while excluding resources belonging
     * to cached imported assets.
     */
    function dispose() {
        const sharedGeometry = new Set<THREE.BufferGeometry>(),
            sharedMaterials = new Set<THREE.Material>();

        for (const asset of assets.values())
            asset.traverse((o) => {
                if (!(o instanceof THREE.Mesh)) {
                    return;
                }

                sharedGeometry.add(o.geometry);
                const assetMaterials = Array.isArray(o.material)
                    ? o.material
                    : [o.material];

                for (const m of assetMaterials) sharedMaterials.add(m);
            });
        const geometry = new Set<THREE.BufferGeometry>(),
            materials = new Set<THREE.Material>(ownedMaterials);

        scene.traverse((o) => {
            if (o instanceof THREE.InstancedMesh) o.dispose();
            if (o instanceof THREE.Mesh) {
                geometry.add(o.geometry);
                const meshMaterials = Array.isArray(o.material)
                    ? o.material
                    : [o.material];

                for (const m of meshMaterials) materials.add(m);
            }
        });
        geometry.forEach((g) => {
            if (!sharedGeometry.has(g)) g.dispose();
        });
        const textures = new Set<THREE.Texture>();

        materials.forEach((m) => {
            if (sharedMaterials.has(m)) return;
            const textured = m as THREE.MeshStandardMaterial;

            if (textured.map) textures.add(textured.map);
            m.dispose();
        });
        textures.forEach((t) => t.dispose());
    }

    return {
        update,
        worldId: world.id,
        centerShadows: forest.centerShadows,

        /**
         * Dispose the forest and view-owned resources, then clear the scene. The caller must stop
         * using this view afterward.
         */
        dispose: () => {
            forest.dispose();
            dispose();
            scene.clear();
        },
        errors,
    };
}

export { capturePhoto } from './photo-capture.ts';
export { playSound } from '../audio/legacy-sound.ts';
