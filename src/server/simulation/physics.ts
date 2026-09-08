import Box3D, { type Body, type V } from 'box3d-wasm/standard';
import type {
    Box,
    FieldProperty,
    FixtureState,
    Pose,
    RouteState,
    Tin,
    Vec3,
} from '../../shared/shared.ts';
import type { Fixture } from '../../shared/world/world.ts';
import {
    PLANK_PLACEMENTS,
    PROP_DEFINITIONS,
    TIN_HALF,
    routeBoxes,
    fixtureBoxes,
} from '../../shared/world/level.ts';

type MovingBody = Body & {
    createHull(options: {
        points: V[];
        density: number;
        friction: number;
        enableContactEvents: boolean;
        enableHitEvents: boolean;
    }): { delete(): void; setUserData(value: number): void };
    getLinearVelocity(): V;
    getAngularVelocity(): V;
    setLinearVelocity(v: V): void;
    setAngularVelocity(v: V): void;
    setTransform(position: V, rotation: V & { w: number }): void;
    destroy(): void;
};
export type PhysicsState = {
    pose: Pose;
    velocity: Vec3;
    angularVelocity: Vec3;
    impacts: { point: Vec3; sources: string[] }[];
    props: FieldProperty[];
};
export type ReservePhysics = {
    step(dt: number): PhysicsState;
    setTin(tin: Tin): void;
    setProps(properties: FieldProperty[], route: RouteState | FixtureState): void;
    dispose(): void;
};
export type TinPhysics = ReservePhysics;

/**
 * Convert a tuple to the native physics vector shape.
 *
 * @param components - World-space vector components
 * @param components.0 - X component.
 * @param components.1 - Y component.
 * @param components.2 - Z component.
 * @returns A new X/Y/Z object.
 */
const vector = ([x, y, z]: Vec3): V => ({ x, y, z });

/**
 * Copy a native physics vector into the shared tuple representation.
 *
 * @param v - Native vector to copy
 * @returns A new X/Y/Z tuple.
 */
const tuple = (v: V): Vec3 => [v.x, v.y, v.z];

/**
 * Compare equal-length numeric vectors without taking a square root.
 *
 * @param a - First vector
 * @param b - Second vector of the same length
 * @returns Sum of squared component differences.
 */
const distanceSquared = (a: number[], b: number[]) => a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
let modulePromise: ReturnType<typeof Box3D> | undefined;

/**
 * Initialize a single-threaded native world with static geometry and equipment bodies.
 * Shares only module initialization; each returned world owns resources that must be
 * disposed.
 *
 * @param boxes - Static collision boxes
 * @param tin - Initial tin state
 * @param equipment - Initial field equipment, default empty
 * @param route - Initial fixture or legacy route state
 * @param fixtures - Generated fixture definitions, omission selects legacy route geometry
 * @returns An independent physics adapter with setters, stepping, and disposal.
 * @throws {Error} Native initialization fails or the loaded build is not single-threaded.
 */
export async function createPhysics(
    boxes: Box[],
    tin: Tin,
    equipment: FieldProperty[] = [],
    route?: RouteState | FixtureState,
    fixtures?: Fixture[],
): Promise<ReservePhysics> {
    // eslint-disable-next-line unicorn/no-top-level-assignment-in-function -- Share one lazy WASM initialization across independently owned worlds.
    const b3 = await (modulePromise ??= Box3D());

    if (b3.threaded !== false)
        throw new Error('Expected Box3D standard single-threaded build');
    const sourceNames = ['tin', ...equipment.map((p) => p.id)],

        /**
         * Map a known equipment ID to its one-based contact-event tag.
         *
         * @param id - Tin or field-prop ID
         * @returns Contact tag, or zero when the ID is unknown.
         */
        sourceTag = (id: string) => sourceNames.indexOf(id) + 1;

    /**
     * Decode and deduplicate equipment IDs from a native contact pair, ignoring untagged
     * scenery.
     *
     * @param entry - Contact event containing both shape tags
     * @param entry.shapeUserDataA - Contact tag on the first shape; zero denotes scenery
     * @param entry.shapeUserDataB - Contact tag on the second shape; zero denotes scenery
     * @returns Distinct known equipment IDs involved in the contact.
     */
    const ids = (entry: { shapeUserDataA: number; shapeUserDataB: number }) => [
        ...new Set(
            [entry.shapeUserDataA, entry.shapeUserDataB].flatMap((tag) => (sourceNames[tag - 1] === undefined ? [] : [sourceNames[tag - 1]]),
            ),
        ),
    ];

    const world = new b3.World({ gravity: { x: 0, y: -10, z: 0 } }),
        statics: Body[] = [],
        propertyBodies = new Map<
            string,
            {
                body: MovingBody | undefined;
                state: FieldProperty;
                mode: 'held' | 'placed' | 'loose';
            }
        >();
    let body: MovingBody | undefined,
        routeBodies: Body[] = [],
        routeKey = '',
        isDisposed = false,
        accumulator = 0,
        state = structuredClone(tin);

    /**
     * Reject operations on a disposed physics owner.
     *
     * @throws {Error} This physics world has already been disposed.
     */
    const ensure = () => {
        if (isDisposed) throw new Error('Reserve physics is disposed');
    };

    /**
     * Destroy and release the current native tin body, if present.
     */
    const remove = () => {
        if (!body) {
            return;
        }

        body.destroy();
        body.delete();
        body = undefined;
    };

    /**
     * Destroy a prop's native body and remove its tracked state. Unknown IDs are ignored.
     *
     * @param id - Prop ID to remove
     */
    const removeProperty = (id: string) => {
        const entry = propertyBodies.get(id);

        if (entry?.body) {
            entry.body.destroy();
            entry.body.delete();
        }
        propertyBodies.delete(id);
    };

    /**
     * Construct collision hulls from the prop catalog and tag them for impact events. Dynamic
     * bodies receive the saved velocities.
     *
     * @param value - Prop pose and motion state
     * @param type - Native body mode
     * @returns New native body; the owning adapter must destroy and delete it.
     */
    const createPropertyBody = (
        value: FieldProperty,
        type: 'static' | 'kinematic' | 'dynamic',
    ) => {
        const [x, y, z, w] = value.pose.rotation,
            moving = world.createBody({
                type,
                position: vector(value.pose.position),
                rotation: { x, y, z, w },
            } as never) as MovingBody;

        const solids = PROP_DEFINITIONS[value.kind].solids;

        for (const solid of solids) {
            const half = solid.size.map((n) => n / 2) as Vec3,
                points = [-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [-1, 1].map((sz) => vector([
                    solid.center[0] + sx * half[0],
                    solid.center[1] + sy * half[1],
                    solid.center[2] + sz * half[2],
                ]),
                ),
                ),
                );
            const shape = moving.createHull({
                points,
                density: 1,
                friction: 0.75,
                enableContactEvents: true,
                enableHitEvents: true,
            });

            shape.setUserData(sourceTag(value.id));
            shape.delete();
        }
        if (type === 'dynamic') {
            moving.setLinearVelocity(vector(value.velocity));
            moving.setAngularVelocity(vector(value.angularVelocity));
        }

        return moving;
    };

    /**
     * Construct an untagged static collision box in the native world.
     *
     * @param box - World-space axis-aligned collision box
     * @returns New native body; the owning adapter must destroy and delete it.
     */
    const createStaticBox = (box: Box) => {
        const center = box.min.map((n, index) => (n + box.max[index]) / 2) as Vec3,
            half = box.min.map((n, index) => (box.max[index] - n) / 2) as Vec3,
            item = world.createBody({
                type: 'static',
                position: vector(center),
                rotation: { x: 0, y: 0, z: 0, w: 1 },
            });
        const shape = item.createBox({
            halfExtents: vector(half),
            density: 1,
            friction: 0.65,
            enableContactEvents: true,
        }) as { setUserData(value: number): void; delete(): void };

        shape.setUserData(0);
        shape.delete();

        return item;
    };

    /**
     * Rebuild fixture bodies and seated crossing planks only when serialized route state
     * changes.
     *
     * @param value - Generated fixture states or the legacy route state
     * @throws {Error} Generated fixture state is inconsistent with its definitions.
     */
    const setRoute = (value: RouteState | FixtureState) => {
        const key = JSON.stringify(value);

        if (routeKey === key) return;
        for (const item of routeBodies) {
            (item as MovingBody).destroy();
            item.delete();
        }
        routeBodies = (
            fixtures
                ? fixtureBoxes(fixtures, value as FixtureState)
                : routeBoxes(value as RouteState)
        ).map((element) => createStaticBox(element));
        routeKey = key;
        const seats = fixtures
            ? fixtures.flatMap((fixture) => {
                    const state = (value as FixtureState)[fixture.id];

                    return fixture.kind === 'crossing' && state.open && state.seat
                        ? [{ id: fixture.plankId!, pose: fixture.seats[state.seat] }]
                        : [];
                })
            : ((value as RouteState).crossing
                    ? [
                            {
                                id: 'seated-crossing',
                                pose: PLANK_PLACEMENTS[(value as RouteState).crossing!],
                            },
                        ]
                    : []);

        for (const seat of seats)
            routeBodies.push(
                createPropertyBody(
                    {
                        id: seat.id,
                        kind: 'plank',
                        pose: structuredClone(seat.pose),
                        velocity: [0, 0, 0],
                        angularVelocity: [0, 0, 0],
                        // eslint-disable-next-line unicorn/no-null -- The save schema represents each empty equipment handle with null.
                        holders: [null, null],
                        placed: true,
                        open: false,
                        spillUntilTick: 0,
                    },
                    'static',
                ),
            );
    };

    /**
     * Reconcile held, placed, and loose body modes with copied authoritative state, then update
     * fixture geometry.
     *
     * @param values - Current field prop states
     * @param nextRoute - Current generated or legacy route state
     * @throws {Error} The adapter is disposed or fixture state is invalid.
     */
    const setProperties = (
        values: FieldProperty[],
        nextRoute: RouteState | FixtureState,
    ) => {
        ensure();
        const ids = new Set(values.map((value) => value.id));

        for (const id of propertyBodies.keys()) if (!ids.has(id)) removeProperty(id);
        for (const value of values) {
            const mode = value.holders.some(Boolean)
                    ? 'held'
                    : (value.placed
                            ? 'placed'
                            : 'loose'),
                current = propertyBodies.get(value.id);
            const unchanged
                = current
                    && distanceSquared(current.state.pose.position, value.pose.position)
                    < 1e-8
                    && distanceSquared(current.state.pose.rotation, value.pose.rotation)
                    < 1e-8;

            if (current?.mode === mode && (mode !== 'loose' || unchanged)) {
                if (mode === 'held' && !unchanged) {
                    const [x, y, z, w] = value.pose.rotation;

                    current.body!.setTransform(vector(value.pose.position), {
                        x,
                        y,
                        z,
                        w,
                    });
                }
                current.state = structuredClone(value);
                continue;
            }
            removeProperty(value.id);
            propertyBodies.set(value.id, {
                body:
          mode === 'placed' && value.kind === 'plank'
              ? undefined
              : createPropertyBody(
                      value,
                      mode === 'placed'
                          ? 'static'
                          : (mode === 'held'
                                  ? 'kinematic'
                                  : 'dynamic'),
                  ),
                state: structuredClone(value),
                mode,
            });
        }
        setRoute(nextRoute);
    };

    /**
     * Idempotently destroy the native world and release every retained body and world wrapper.
     */
    const dispose = () => {
        if (isDisposed) return;
        isDisposed = true;
        world.destroy();
        body?.delete();
        body = undefined;
        for (const entry of propertyBodies.values()) entry.body?.delete();
        propertyBodies.clear();
        for (const item of routeBodies) item.delete();
        routeBodies = [];
        for (const item of statics) item.delete();
        world.delete();
    };

    /**
     * Replace the tin state and reset the substep accumulator. Held tins have no dynamic body;
     * loose tins are recreated with supplied velocities.
     *
     * @param value - Authoritative tin state to copy
     * @throws {Error} The adapter has been disposed.
     */
    const setTin = (value: Tin) => {
        ensure();
        remove();
        state = structuredClone(value);
        accumulator = 0;
        if (state.holder) return;
        const [x, y, z, w] = state.pose.rotation;

        body = world.createBody({
            type: 'dynamic',
            position: vector(state.pose.position),
            rotation: { x, y, z, w },
        }) as MovingBody;
        const options = {
            halfExtents: vector(TIN_HALF),
            density: 1,
            friction: 0.65,
            enableContactEvents: true,
            enableHitEvents: true,
        };
        const shape = body.createBox(options) as { setUserData(value: number): void; delete(): void };

        shape.setUserData(sourceTag('tin'));
        shape.delete();
        body.setLinearVelocity(vector(state.velocity));
        body.setAngularVelocity(vector(state.angularVelocity));
    };

    try {
        for (const box of boxes) {
            const item = createStaticBox(box);

            statics.push(item);
        }
        setTin(tin);
        // eslint-disable-next-line unicorn/no-null -- The route contract represents a closed crossing with an explicit null seat.
        setProperties(equipment, route ?? { crossing: null, gateOpen: false });
    } catch (error) {
        dispose();
        throw error;
    }

    return {
        setTin,
        setProps: setProperties,
        dispose,

        /**
         * Advance physics in 1/60-second substeps, clamping each supplied interval to 0.25 seconds.
         * Collect impacts and copy current body transforms back into adapter state.
         *
         * @param dt - Finite, nonnegative elapsed seconds
         * @returns Detached tin and prop state plus impact positions and source IDs.
         * @throws {Error} The adapter is disposed or the timestep is negative or nonfinite.
         */
        step(dt) {
            ensure();
            if (!Number.isFinite(dt) || dt < 0)
                throw new Error('Invalid physics timestep');
            const impacts: PhysicsState['impacts'] = [];

            accumulator += Math.min(dt, 0.25);
            while (accumulator >= 1 / 60 - 1e-9) {
                const tinVelocity = body ? tuple(body.getLinearVelocity()) : [0, 0, 0];
                const sources = new Map<string, { point: Vec3; speed: number }>([
                    ...(body
                        ? ([
                                [
                                    'tin',
                                    {
                                        point: tuple(body.getPosition()),
                                        speed: Math.hypot(...tinVelocity),
                                    },
                                ],
                            ] as const)
                        : []),
                    ...[...propertyBodies].flatMap(([id, entry]) => (entry.body
                        ? ([
                                [
                                    id,
                                    {
                                        point: tuple(entry.body.getPosition()),
                                        speed: Math.hypot(...tuple(entry.body.getLinearVelocity())),
                                    },
                                ],
                            ] as const)
                        : []),
                    ),
                ]);

                world.step(1 / 60, 4);
                accumulator -= 1 / 60;
                const events = world.getContactEvents() as {
                    begin: { shapeUserDataA: number; shapeUserDataB: number }[];
                    hit: {
                        point: V;
                        approachSpeed: number;
                        shapeUserDataA: number;
                        shapeUserDataB: number;
                    }[];
                };

                for (const hit of events.hit)
                    if (hit.approachSpeed > 1)
                        impacts.push({ point: tuple(hit.point), sources: ids(hit) });
                if (events.hit.length === 0)
                    for (const contact of events.begin) {
                        const involved = ids(contact),
                            moving = involved
                                .map((id) => sources.get(id))
                                .find((s) => s && s.speed > 1);

                        if (moving)
                            impacts.push({ point: moving.point, sources: involved });
                    }
            }
            if (body) {
                const q = body.getRotation();

                state.pose = {
                    position: tuple(body.getPosition()),
                    rotation: [q.x, q.y, q.z, q.w],
                };
                state.velocity = tuple(body.getLinearVelocity());
                state.angularVelocity = tuple(body.getAngularVelocity());
            } else accumulator = 0;
            for (const entry of propertyBodies.values())
                if (entry.body && entry.mode === 'loose') {
                    const q = entry.body.getRotation();

                    entry.state.pose = {
                        position: tuple(entry.body.getPosition()),
                        rotation: [q.x, q.y, q.z, q.w],
                    };
                    entry.state.velocity = tuple(entry.body.getLinearVelocity());
                    entry.state.angularVelocity = tuple(entry.body.getAngularVelocity());
                }

            return {
                pose: structuredClone(state.pose),
                velocity: [...state.velocity],
                angularVelocity: [...state.angularVelocity],
                impacts,
                props: propertyBodies.values().map((entry) => structuredClone(entry.state)).toArray(),
            };
        },
    };
}
