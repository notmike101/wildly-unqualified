/**
Advance authoritative movement, equipment, and wildlife one tick.
 */
import {
    PROP_DEFINITIONS,
    fixtureBoxes,
    fixtureSurfaces,
} from '../../shared/world/level.ts';
import {
    distance,
    movePlayer,
    surfaceHeight,
    playerSpeed,
    propertyPoint,
    propertyBoxes,
    type Player,
    type Pose,
    type Quat,
    type Vec3,
} from '../../shared/shared.ts';
import { stepAnimals } from './wildlife/encounters.ts';
import { type RunState, nearby, event } from './game-state.ts';
import {
    yawPose,
    quatAngle,
    slerp,
    alignLocalX,
    gripOffset,
    clearGrips,
    sweepProp as sweepProperty,
} from './equipment.ts';
import {
    spillCase,
    updateHats,
    neutralize,
    safe,
    heldPose,
} from './game-support.ts';
const carryState = new WeakMap<
    RunState,
    Map<string, { blocked: number; ignore: boolean }>
>();

/**
 * Advance one authoritative tick, clamped to 1/60 second, including crew separation,
 * carried equipment, wildlife, and incident timers. Paused/exhibition runs do not advance;
 * an empty crew pauses the run.
 *
 * @param run - Authoritative run to mutate
 * @param dt - Positive finite elapsed seconds
 * @throws {Error} The supplied timestep is nonfinite or nonpositive.
 */
export function advanceRun(run: RunState, dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0)
        throw new Error('Invalid simulation timestep');
    if (run.paused || run.phase === 'exhibition') return;
    if (run.players.every((p) => !p.connected)) {
        run.paused = true;
        run.pauseReason = 'Waiting for crew';
        neutralize(run);

        return;
    }
    dt = Math.min(dt, 1 / 60);
    run.tick++;
    if (run.phase === 'outing') run.seconds += dt;
    const before = new Map(
        run.players.map((p) => [p.id, [...p.position] as Vec3]),
    );

    for (const property of run.props)
        for (const [handle, id] of property.holders.entries()) {
            const p = id
                ? run.players.find((value) => value.id === id && value.connected)
                : undefined;

            if (p) gripOffset(run, property, handle, p);
        }

    /**
     * Combine world and fixture blockers with loose equipment the player is not holding.
     *
     * @param p - Player whose held equipment is excluded
     * @returns Collision boxes applicable to this player.
     */
    const playerWalls = (p: Player) => [
        ...run.world.walls,
        ...fixtureBoxes(run.world.fixtures, run.route),
        ...run.props
            .filter((property) => !property.holders.includes(p.id) && !property.placed)
            .flatMap((property) => propertyBoxes(property, PROP_DEFINITIONS[property.kind])),
    ];

    /**
     * Find the highest reachable support under a separation candidate and test standing
     * clearance.
     *
     * @param p - Player being separated
     * @param point - Proposed foot position
     * @returns Supported candidate, or undefined when it is blocked or above the step limit.
     */
    const separationPoint = (p: Player, point: Vec3): Vec3 | undefined => {
        const heights = [
                ...run.world.walkables,
                ...fixtureSurfaces(run.world.fixtures, run.route),
            ]
                .map((surface) => surfaceHeight(surface, point[0], point[2]))
                .filter((height): height is number => height !== undefined)
                .filter((height) => height <= p.position[1] + 0.45),
            height = heights.length > 0 ? Math.max(...heights) : undefined;

        if (height === undefined) return undefined;
        const supported: Vec3 = [point[0], height, point[2]];

        return safe(run, supported, playerWalls(p)) ? supported : undefined;
    };

    for (const p of run.players) {
        if (!p.connected) continue;
        if (p.lastInput && run.tick - p.inputTick <= 15) {
            Object.assign(
                p,
                movePlayer(
                    p,
                    p.lastInput,
                    dt,
                    playerWalls(p),
                    [
                        ...run.world.walkables,
                        ...fixtureSurfaces(run.world.fixtures, run.route),
                    ],
                    playerSpeed(p.id, p.lastInput, run.props),
                ),
            );
        } else delete p.lastInput;
        if (!nearby(p.position, run.world.camp, 6))
            run.ready = run.ready.filter((id) => id !== p.id);
    }
    const pairs
        = carryState.get(run)
            ?? new Map<string, { blocked: number; ignore: boolean }>();

    carryState.set(run, pairs);

    /**
     * Separate one connected crew pair while retaining the blocked-pair timeout.
     *
     * @param a - First crew member
     * @param b - Second crew member
     */
    const separatePair = (a: Player, b: Player) => {
        const key = (a.id < b.id ? [a.id, b.id] : [b.id, a.id]).join('\0'),
            state = pairs.get(key) ?? { blocked: 0, ignore: false },
            separation = Math.hypot(
                a.position[0] - b.position[0],
                a.position[2] - b.position[2],
            );

        if (
            !a.connected
            || !b.connected
            || Math.abs(a.position[1] - b.position[1]) > 1.8
        ) {
            pairs.delete(key);

            return;
        }
        if (state.ignore) {
            if (separation > 0.9) pairs.delete(key);
            else pairs.set(key, state);

            return;
        }
        if (separation >= 0.7) {
            pairs.delete(key);

            return;
        }
        const movedA = distance(a.position, before.get(a.id)!),
            movedB = distance(b.position, before.get(b.id)!);

        if ((movedA > 0.001) === (movedB > 0.001)) {
            const dx = a.position[0] - b.position[0] || 1,
                dz = a.position[2] - b.position[2],
                length = Math.hypot(dx, dz),
                push = (0.7 - separation) / 2;
            const nextA: Vec3 = [
                    a.position[0] + (dx / length) * push,
                    a.position[1],
                    a.position[2] + (dz / length) * push,
                ],
                nextB: Vec3 = [
                    b.position[0] - (dx / length) * push,
                    b.position[1],
                    b.position[2] - (dz / length) * push,
                ];
            const supportedA = separationPoint(a, nextA),
                supportedB = separationPoint(b, nextB);

            if (supportedA) a.position = supportedA;
            if (supportedB) b.position = supportedB;
        } else {
            state.blocked += dt;
            if (state.blocked >= 1.5) state.ignore = true;
            else if (movedA > movedB) a.position = [...before.get(a.id)!];
            else b.position = [...before.get(b.id)!];
        }
        pairs.set(key, state);
    };

    for (let index = 0; index < run.players.length; index++)
        for (let other = index + 1; other < run.players.length; other++)
            separatePair(run.players[index], run.players[other]);
    for (const property of run.props) {
        const holders = property.holders.flatMap((id, handle) => {
            const p = id
                ? run.players.find((value) => value.id === id && value.connected)
                : undefined;

            return p ? [{ p, handle }] : [];
        });

        if (holders.length === 0) continue;
        const definition = PROP_DEFINITIONS[property.kind],

            /**
             * Add the remembered grip displacement to the holder's current position.
             *
             * @param grip - Player and handle index for this grip
             * @param grip.p - Player holding this grip
             * @param grip.handle - Index of the held equipment handle
             * @returns Desired world position of the held handle.
             */
            targetPoint = ({ p, handle }: (typeof holders)[number]): Vec3 => {
                const offset = gripOffset(run, property, handle, p);

                return p.position.map((value, axis) => value + offset[axis]) as Vec3;
            };
        let targetRotation: Quat;

        if (holders.length === 2) {
            const ordered = holders.toSorted((a, b) => a.handle - b.handle),
                points = ordered.map((element) => targetPoint(element)),
                localA = definition.handles[ordered[0].handle],
                localB = definition.handles[ordered[1].handle],

                /**
                 * Compare the two desired grip positions with the equipment's fixed handle spacing.
                 *
                 * @returns Whether the spacing mismatch exceeds 15 cm.
                 */
                isIncompatible = () => Math.abs(distance(points[0], points[1]) - distance(localA, localB))
                    > 0.15;

            if (isIncompatible()) {
                for (const { p } of holders) p.position = [...before.get(p.id)!];
                points.splice(0, 2, ...ordered.map((element) => targetPoint(element)));
                if (isIncompatible()) {
                    for (const { p, handle } of holders) {
                        // eslint-disable-next-line unicorn/no-null -- The save schema represents each empty equipment handle with null.
                        property.holders[handle] = null;
                        clearGrips(run, property, p.id);
                    }
                    property.velocity = [0, 0, 0];
                    property.angularVelocity = [0, 0, 0];
                    continue;
                }
            }
            targetRotation = alignLocalX(
                points[1].map((value, axis) => value - points[0][axis]) as Vec3,
            );
        } else targetRotation = yawPose([0, 0, 0], holders[0].p.yaw).rotation;
        const rotationDistance = quatAngle(property.pose.rotation, targetRotation),
            rotationStep = Math.min(Math.PI * dt, rotationDistance),
            nextRotation = slerp(
                property.pose.rotation,
                targetRotation,
                rotationDistance ? rotationStep / rotationDistance : 1,
            ),
            targets = holders.map((holder) => targetPoint(holder)),
            centers = holders.map(({ handle }, index) => {
                const offset = propertyPoint(definition.handles[handle], {
                    position: [0, 0, 0],
                    rotation: nextRotation,
                });

                return targets[index].map(
                    (value, axis) => value - offset[axis],
                ) as Vec3;
            });
        const position: Vec3 = [0, 0, 0];

        for (const center of centers)
            for (const axis of [0, 1, 2]) position[axis] += center[axis] / centers.length;
        const desired: Pose = { position, rotation: nextRotation },
            endpointError = Math.max(
                ...holders.map(({ handle }, index) => distance(
                    propertyPoint(definition.handles[handle], desired),
                    targets[index],
                ),
                ),
            );

        if (endpointError > 0.15) {
            for (const { p, handle } of holders) {
                p.position = [...before.get(p.id)!];
                if (
                    distance(
                        propertyPoint(definition.handles[handle], property.pose),
                        targetPoint({ p, handle }),
                    ) > 0.15
                ) {
                    // eslint-disable-next-line unicorn/no-null -- The save schema represents each empty equipment handle with null.
                    property.holders[handle] = null;
                    clearGrips(run, property, p.id);
                }
            }
            property.velocity = [0, 0, 0];
            property.angularVelocity = [0, 0, 0];
            continue;
        }
        const moved = sweepProperty(run, property, desired);
        const displacement = desired.position.map(
                (value, axis) => value - property.pose.position[axis],
            ) as Vec3,
            oldPose = structuredClone(property.pose);

        if (
            (moved.hit && Math.hypot(...property.velocity) > 0.5)
            || (!moved.hit
                && rotationStep / dt > 2
                && Math.hypot(...property.angularVelocity) <= 2)
        )
            spillCase(run, property);
        property.pose = moved.hit ? oldPose : moved.pose;
        property.velocity = displacement.map((value) => value / dt) as Vec3;
        property.angularVelocity = [0, rotationStep / dt, 0];
        if (moved.hit) {
            for (const { p } of holders) p.position = [...before.get(p.id)!];
            property.velocity = [0, 0, 0];
            property.angularVelocity = [0, 0, 0];
            if (run.tick - run.lastImpactTick > 15) {
                run.lastImpactTick = run.tick;
                event(run, 'impact', holders[0].p, property.pose.position);
                event(run, 'noise', holders[0].p, property.pose.position);
            }
        }
    }
    heldPose(run);
    run.spills = run.spills.filter(
        (s) => s.portions > 0 && s.untilTick > run.tick,
    );
    run.pings = run.pings.filter((p) => p.until > run.tick);
    run.events = run.events.filter((entry) => entry.tick >= run.tick - 1200);
    if (run.phase === 'outing') {
        run.decisionSeconds += dt;
        if (run.decisionSeconds >= 0.1 - 1e-9) {
            run.decisionSeconds = Math.max(0, run.decisionSeconds - 0.1);
            for (const p of run.players)
                if (
                    p.connected
                    && p.lastInput?.run
                    && !p.lastInput.crouch
                    && Math.hypot(p.lastInput.x, p.lastInput.z) > 0.1
                )
                    event(run, 'noise', p, p.position);
            stepAnimals(run, 0.1);
            heldPose(run);
        }
    }
    updateHats(run);
}
