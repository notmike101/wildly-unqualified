/**
Read-only route guidance and ordinary keyboard/button navigation for the visible acceptance driver.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, rename } from 'node:fs/promises';
import pathModule from 'node:path';
import { type Page } from 'playwright';
import { PROP_DEFINITIONS } from '../../src/shared/world/level.ts';
import { fixtureBoxes, fixtureSurfaces } from '../../src/shared/world/level.ts';
import type { ReserveBlueprint } from '../../src/shared/world/world.ts';
import { animalRoute } from '../../src/server/simulation/wildlife/encounters.ts';
import {
    distance,
    propertyPoint,
    propertyBoxes,
    movePlayer,
    heldProperty,
    eye,
    surfaceHeight,
    type FixtureState,
    type Player,
    type Snapshot,
    type Vec3,
} from '../../src/shared/shared.ts';

/**
 * Wait between ordinary browser actions without advancing simulation directly.
 *
 * @param ms - Delay in milliseconds
 * @returns A promise resolving after the requested delay.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Read the admitted page's local player from its diagnostic snapshot. Requires an admitted
 * player present in the snapshot.
 *
 * @param p - Admitted browser page
 * @returns Current local player state.
 */
const me = (p: Page) => p.evaluate(() => globalThis.window.wildly.snapshot!.players.find(
    (x) => x.id === globalThis.window.wildly.playerId,
)!,
);

/**
 * Wrap an angle to the shortest signed heading interval.
 *
 * @param angle - Angle in radians
 * @returns Angle in radians between -pi and pi.
 */
const wrapped = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/**
 * Measure horizontal distance for driver arrival checks.
 *
 * @param a - First world point
 * @param b - Second world point
 * @returns Distance in metres, ignoring Y.
 */
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/**
 * Create route guidance and ordinary keyboard/button helpers for the visible acceptance
 * driver. Reads diagnostic state but never assigns authoritative positions.
 *
 * @param options - Driver timing and evidence dependencies
 * @param options.latency - Simulated network latency in milliseconds
 * @param options.evidence - Directory for screenshots, logs, and recovery files
 * @param options.startedAt - Outing start time in Unix milliseconds
 * @param options.log - Shared evidence log to append to
 * @returns Navigation helpers sharing the active blueprint and evidence log.
 */
export function createDriverNavigation({
    latency,
    evidence,
    startedAt,
    log,
}: {
    latency: number;
    evidence: string;
    startedAt: number;
    log: unknown[];
}) {
    let activeWorld: ReserveBlueprint | undefined;

    /**
     * Return the world most recently observed by snapshot.
     *
     * @returns The active blueprint read from the browser.
     * @throws {Error} No generated world has been loaded yet.
     */
    const reserve = () => {
        if (!activeWorld) throw new Error('Generated world not loaded');

        return activeWorld;
    };

    /**
     * Resolve active collision boxes for the driver's loaded reserve.
     *
     * @param state - Fixture states indexed by ID
     * @returns Current fixture collision boxes.
     * @throws {Error} No world is loaded or fixture state is invalid.
     */
    const routeBoxes = (state: FixtureState) => fixtureBoxes(reserve().fixtures, state);

    /**
     * Resolve active walking surfaces for the driver's loaded reserve.
     *
     * @param state - Fixture states indexed by ID
     * @returns Current fixture walking surfaces.
     * @throws {Error} No world is loaded or fixture state is invalid.
     */
    const routeSurfaces = (state: FixtureState) => fixtureSurfaces(reserve().fixtures, state);

    /**
     * Read the browser's diagnostic snapshot and refresh the cached blueprint when its world
     * changes.
     *
     * @param p - Admitted browser page
     * @returns Current snapshot copied through browser evaluation.
     * @throws {Error} A matching loaded world cannot be resolved, or page evaluation fails.
     */
    const snapshot = async (p: Page) => {
        const state = await p.evaluate(() => globalThis.window.wildly.snapshot!);

        if (state.worldId !== activeWorld?.id)
            activeWorld = (await p.evaluate(() => globalThis.window.wildly.world)) ?? undefined;
        if (state.worldId !== reserve().id) throw new Error('Driver world mismatch');

        return state;
    };

    /**
     * Hold a keyboard key for a duration and always release it afterward.
     *
     * @param p - Browser page to control
     * @param key - Playwright key name
     * @param ms - Hold duration in milliseconds
     * @throws {Error} Browser keyboard interaction fails.
     */
    async function hold(p: Page, key: string, ms: number) {
        await p.keyboard.down(key);
        try {
            await sleep(ms);
        } finally {
            await p.keyboard.up(key);
        }
    }

    /**
     * Turn toward a world point using arrow keys and snapshot feedback, with a bounded number
     * of attempts.
     *
     * @param p - Browser page to control
     * @param point - World point to face horizontally
     * @throws {Error} The camera cannot reach the heading tolerance or browser interaction
     * fails.
     */
    async function face(p: Page, point: Vec3) {
        for (let n = 0; n < 16; n++) {
            const player = await me(p);
            const angle = Math.atan2(
                player.position[0] - point[0],
                player.position[2] - point[2],
            );
            const delta = wrapped(angle - player.yaw);

            if (Math.abs(delta) < 0.035) return;
            const duration = Math.max(20, Math.min(700, (Math.abs(delta) / 1.6) * 1000));

            await hold(p, delta > 0 ? 'ArrowLeft' : 'ArrowRight', duration);
            await sleep(150 + latency);
        }
        throw new Error('Camera could not face the next waypoint with arrow keys');
    }

    // Read-only route guidance for the UI driver. All actual travel still uses keys.
    /**
     * Find and smooth a bounded local route using the shared movement solver against scenery,
     * loose equipment, and crew. Does not move the player.
     *
     * @param player - Player at the search origin
     * @param goal - Desired world destination
     * @param state - Current snapshot supplying route, props, and crew
     * @returns Waypoints, or an empty array if the bounded search fails.
     */
    function detour(player: Player, goal: Vec3, state: Snapshot): Vec3[] {
        const walls = [
            ...reserve().walls,
            ...routeBoxes(state.route),
            ...state.props
                .filter((p) => !p.placed && !p.holders.includes(player.id))
                .flatMap((p) => propertyBoxes(p, PROP_DEFINITIONS[p.kind])),
            ...state.players
                .filter((p) => p.connected && p.id !== player.id)
                .map((p) => ({
                    id: p.id,
                    min: [
                        p.position[0] - 0.35,
                        p.position[1],
                        p.position[2] - 0.35,
                    ] as Vec3,
                    max: [
                        p.position[0] + 0.35,
                        p.position[1] + 1.8,
                        p.position[2] + 0.35,
                    ] as Vec3,
                })),
        ].filter(
            (b) => b.max[0] >= Math.min(player.position[0], goal[0]) - 8
                && b.min[0] <= Math.max(player.position[0], goal[0]) + 8
                && b.max[2] >= Math.min(player.position[2], goal[2]) - 8
                && b.min[2] <= Math.max(player.position[2], goal[2]) + 8,
        );
        const surfaces = [...reserve().walkables, ...routeSurfaces(state.route)];

        /**
         * Simulate a straight walking segment in small steps and reject any deviation caused by
         * collision.
         *
         * @param from - Segment start
         * @param to - Segment end
         * @returns Reached grounded point, or undefined when direct travel is blocked.
         */
        const reach = (from: Vec3, to: Vec3) => {
            const dx = to[0] - from[0],
                dz = to[2] - from[2],
                length = Math.hypot(dx, dz);

            if (!length) return from;
            const input = {
                seq: 1,
                x: dx / length,
                z: dz / length,
                yaw: 0,
                pitch: 0,
                run: false,
                crouch: false,
            };
            const steps = Math.ceil(length / 0.05);
            let next = from;

            for (let index = 0; index < steps; index++) {
                next = movePlayer(
                    { ...player, position: next },
                    input,
                    length / steps / 3,
                    walls,
                    surfaces,
                ).position;
                const fraction = (index + 1) / steps;

                if (
                    Math.hypot(
                        next[0] - from[0] - dx * fraction,
                        next[2] - from[2] - dz * fraction,
                    ) > 0.01
                )
                    return;
            }

            return Math.hypot(next[0] - to[0], next[2] - to[2]) < 0.01 ? next : undefined;
        };

        type Node = {
            x: number;
            z: number;
            position: Vec3;
            cost: number;
            parent?: Node;
        };
        const origin: Node = { x: 0, z: 0, position: player.position, cost: 0 };
        const open = [origin],
            seen = new Map([['0,0', 0]]);

        /**
         * Estimate remaining horizontal distance for local path search.
         *
         * @param n - Search node
         * @returns Distance to the current goal in metres.
         */
        const heuristic = (n: Node) => Math.hypot(n.position[0] - goal[0], n.position[2] - goal[2]);

        for (let expanded = 0; open.length > 0 && expanded < 3000; expanded++) {
            open.sort((a, b) => a.cost + heuristic(a) - b.cost - heuristic(b));
            const node = open.shift()!;

            if (heuristic(node) < 1.5 && reach(node.position, goal)) {
                const path = [goal];
                let cursor: Node | undefined = node;

                while (cursor?.parent) {
                    path.unshift(cursor.position);
                    cursor = cursor.parent;
                }
                const smooth: Vec3[] = [];
                let from = player.position;

                for (let index = 0; index < path.length;) {
                    let last = index;

                    while (last + 1 < path.length && reach(from, path[last + 1])) last++;
                    smooth.push(path[last]);
                    from = path[last];
                    index = last + 1;
                }

                return smooth;
            }
            for (const [dx, dz] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
                const x = node.x + dx,
                    z = node.z + dz,
                    cost = node.cost + 0.5 * Math.hypot(dx, dz),
                    key = `${x},${z}`;

                if ((seen.get(key) ?? Infinity) > cost) {
                    const target: Vec3 = [
                        player.position[0] + x * 0.5,
                        node.position[1],
                        player.position[2] + z * 0.5,
                    ];

                    if (
                        target[0] >= Math.min(player.position[0], goal[0]) - 8
                        && target[0] <= Math.max(player.position[0], goal[0]) + 8
                        && target[2] >= Math.min(player.position[2], goal[2]) - 8
                        && target[2] <= Math.max(player.position[2], goal[2]) + 8
                    ) {
                        const position = reach(node.position, target);

                        if (position) {
                            seen.set(key, cost);
                            open.push({ x, z, position, cost, parent: node });
                        }
                    }
                }
            }
        }

        return [];
    }

    /**
     * Walk toward a waypoint with ordinary keys, detecting stalls and optionally trying local
     * detours. Unresolved obstacles invoke the existing recovery-file workflow.
     *
     * @param p - Browser page to control
     * @param point - Mutable destination vector, recovery may replace its coordinates
     * @param tolerance - Arrival tolerance in metres, default 0.3
     * @param shouldDetour - Whether to attempt local detours before manual recovery
     * @throws {Error} The waypoint budget, recovery wait, or browser interaction fails.
     */
    async function walk(
        p: Page,
        point: Vec3,
        tolerance = 0.3,
        shouldDetour = true,
    ) {
        let stalled = 0;
        let bestRemaining = Infinity,
            withoutProgress = 0;

        for (let n = 0; n < 160; n++) {
            const before = await me(p);
            const remaining = Math.hypot(
                point[0] - before.position[0],
                point[2] - before.position[2],
            );

            if (remaining < tolerance) return;
            if (remaining < bestRemaining - 0.07) {
                bestRemaining = remaining;
                withoutProgress = 0;
            } else withoutProgress++;
            await face(p, point);
            await hold(
                p,
                'KeyW',
                Math.min(700, Math.max(55, ((remaining - tolerance / 2) / 3) * 1000)),
            );
            await sleep(150 + latency);
            const after = await me(p);

            stalled
                = distance(before.position, after.position) < 0.025 || withoutProgress > 7
                    ? stalled + 1
                    : 0;
            if (stalled === 3) {
                // Keep walking long enough to exercise the normal stationary-crew escape.

                await hold(p, 'KeyW', 2000);
                await sleep(150 + latency);
            }
            if (stalled >= 5) {
                const state = await snapshot(p);

                if (
                    shouldDetour
                    && (!heldProperty(after.id, state.props)
                        || heldProperty(after.id, state.props)?.kind === 'decoy')
                ) {
                    const path = detour(after, point, state);

                    if (path.length > 0) {
                        log.push({
                            elapsedMs: Date.now() - startedAt,
                            player: after.name,
                            readOnlyRoute: path,
                        });
                        for (const waypoint of path)
                            await walk(p, waypoint, Math.min(tolerance, 0.2), false);

                        return;
                    }
                }
                await recoverWalk(p, point);
                stalled = 0;
                withoutProgress = 0;
                bestRemaining = Infinity;
            }
        }
        throw new Error(`Waypoint time budget exhausted: ${point}`);
    }

    /**
     * Write stall evidence and wait up to 15 minutes for an ordinary-control recovery file.
     * Validates commands, archives the consumed file, and may update the destination in place.
     *
     * @param p - Browser page to control
     * @param target - Destination vector that recovery can modify
     * @throws {Error} Recovery commands are invalid, browser/file operations fail, or no
     * recovery is supplied before the timeout.
     */
    async function recoverWalk(p: Page, target: Vec3) {
        const player = await me(p),
            path = pathModule.resolve(evidence, `outing-recovery-${player.name}.json`);

        await writeFile(
            pathModule.resolve(evidence, `outing-stall-${player.name}.json`),
            JSON.stringify({ player, target, state: await snapshot(p) }, undefined, 2),
        );
        console.log(
            `Driver paused ${player.name}'s route at a real obstacle. Ordinary key/face recovery file: ${path}`,
        );
        for (let n = 0; n < 1800; n++) {
            let commands: {
                key?: string;
                ms?: number;
                face?: Vec3;
                click?: string;
                target?: Vec3;
                acceptObserverApproach?: boolean;
            }[];

            try {
                commands = JSON.parse(await readFile(path, 'utf8'));
            } catch {
                await sleep(500);
                continue;
            }
            assert.ok(Array.isArray(commands));
            await rename(
                path,
                pathModule.resolve(evidence, `outing-recovery-${player.name}-${Date.now()}.json`),
            );
            for (const command of commands) {
                if (command.target || command.acceptObserverApproach) {
                    assert.ok(
                        !command.acceptObserverApproach || player.slot >= 2,
                        'only an observer approach can be accepted at its actual standing position',
                    );
                    const observer = command.acceptObserverApproach ? await me(p) : undefined;
                    const destination = observer ? observer.position : command.target!;

                    assert.ok(
                        destination.length === 3 && destination.every((element) => Number.isFinite(element)),
                    );
                    const clear = clearDestination(
                        await me(p),
                        destination,
                        await snapshot(p),
                    );

                    target.splice(0, 3, ...clear);
                } else if (command.click) {
                    assert.ok(
                        [
                            '#settings-button',
                            '#recover-button',
                            '[data-close="settings"]',
                            '#pause-button',
                            '#resume-button',
                        ].includes(command.click),
                    );
                    await p.locator(command.click).click();
                    await sleep(350 + latency);
                } else if (command.face) {
                    assert.ok(
                        command.face.length === 3 && command.face.every((element) => Number.isFinite(element)),
                    );
                    await face(p, command.face);
                } else {
                    assert.match(
                        command.key ?? '',
                        /^(Key[WASDEQGC]|Arrow(Left|Right|Up|Down))$/,
                    );
                    if (command.ms === undefined) {
                        await action(p, command.key!);
                    } else {
                        assert.ok(command.ms >= 0 && command.ms <= 15_000);
                        await hold(p, command.key!, command.ms);
                    }
                }
            }
            log.push({
                ordinaryRecovery: commands,
                player: player.name,
                elapsedMs: Date.now() - startedAt,
            });

            return;
        }
        throw new Error('No ordinary-control recovery supplied in 15 minutes');
    }

    /**
     * Press an ordinary action key and log the preceding prompt, player position, and resulting
     * notice.
     *
     * @param p - Browser page to control
     * @param key - Playwright key name
     */
    async function action(p: Page, key: string) {
        const player = await me(p);
        const hint = await p.locator('#context-action').textContent();

        await p.keyboard.press(key);
        await sleep(250 + latency);
        log.push({
            elapsedMs: Date.now() - startedAt,
            player: player.name,
            position: player.position,
            key,
            hint,
            notice: await p.locator('#notice').textContent(),
        });
    }

    /**
     * Choose supported, unobstructed standing ground at the target or within five metres,
     * logging any adjustment.
     *
     * @param player - Player whose carried prop is excluded
     * @param target - Requested destination
     * @param state - Current route and equipment state
     * @returns Original grounded target or nearest acceptable ring candidate.
     * @throws {Error} No clear supported destination exists within five metres.
     */
    function clearDestination(
        player: Player,
        target: Vec3,
        state: Snapshot,
    ): Vec3 {
        const surfaces = [...reserve().walkables, ...routeSurfaces(state.route)];
        const walls = [
            ...reserve().walls,
            ...routeBoxes(state.route),
            ...state.props
                .filter((p) => !p.placed && !p.holders.includes(player.id))
                .flatMap((p) => propertyBoxes(p, PROP_DEFINITIONS[p.kind])),
        ];

        /**
         * Test standing clearance on the highest supporting surface at a horizontal location.
         *
         * @param x - World X coordinate
         * @param z - World Z coordinate
         * @returns Grounded point, or undefined if unsupported or blocked.
         */
        const clear = (x: number, z: number): Vec3 | undefined => {
            const heights = surfaces
                .map((s) => surfaceHeight(s, x, z))
                .filter((h): h is number => h !== undefined);

            if (heights.length === 0) return undefined;
            const y = Math.max(...heights);

            if (
                walls.some(
                    (b) => b.max[1] > y + 0.15
                        && b.min[1] < y + 1.8
                        && x > b.min[0] - 0.36
                        && x < b.max[0] + 0.36
                        && z > b.min[2] - 0.36
                        && z < b.max[2] + 0.36,
                )
            )
                return undefined;

            return [x, y, z];
        };
        const original = clear(target[0], target[2]);

        if (original) return original;
        for (let radius = 0.25; radius <= 5; radius += 0.25) {
            const candidates: Vec3[] = [];

            for (let index = 0; index < 32; index++) {
                const candidate = clear(
                    target[0] + Math.cos((index * Math.PI) / 16) * radius,
                    target[2] + Math.sin((index * Math.PI) / 16) * radius,
                );

                if (candidate) candidates.push(candidate);
            }
            candidates.sort(
                (a, b) => flat(a, player.position) - flat(b, player.position),
            );
            if (candidates.length > 0) {
                log.push({
                    diagnosticClearDestination: {
                        requested: target,
                        selected: candidates[0],
                        player: player.name,
                    },
                });

                return candidates[0];
            }
        }
        throw new Error(
            `No clear supported standing destination within 5m of ${target}`,
        );
    }

    /**
     * Guide ordinary walking through authored navigation and a final clear destination. Retains
     * the legacy decoy approach workaround used by the acceptance scenario.
     *
     * @param p - Browser page to control
     * @param target - Requested world destination
     * @throws {Error} Destination selection or any ordinary walking step fails.
     */
    async function travel(p: Page, target: Vec3) {
        let state = await snapshot(p),
            player = await me(p);

        target = clearDestination(player, target, state);
        if (
            heldProperty(player.id, state.props)?.kind === 'decoy'
            && player.position[0] < -14
            && target[0] > -6
        ) {
            for (const point of [
                ...(player.position[2] > -4 ? [[-22, 0, 2] as Vec3] : []),
                [-22, 0, -6],
                [-6, 0, -6],
                [-6, 0, 2],
            ] as Vec3[])
                await walk(p, point, 0.4);
            state = await snapshot(p);
            player = await me(p);
        }
        const node = reserve().navNodes.toSorted(
            (a, b) => flat(a.position, target) - flat(b.position, target),
        )[0];
        const path = animalRoute(player.position, node.id, {
            world: reserve(),
            route: state.route,
        });

        log.push({ diagnosticRoute: path, player: player.name, target });
        for (const point of path) await walk(p, point, 0.4);
        await walk(p, target);
    }

    /**
     * Turn horizontally and adjust pitch toward a point using bounded arrow-key attempts. Pitch
     * adjustment is best effort after ten iterations.
     *
     * @param p - Browser page to control
     * @param target - World-space photo target
     * @throws {Error} Horizontal facing or browser interaction fails.
     */
    async function aim(p: Page, target: Vec3) {
        await face(p, target);
        for (let n = 0; n < 10; n++) {
            const player = await me(p),
                origin = eye(player);
            const angle = Math.atan2(target[1] - origin[1], flat(origin, target));
            const delta = angle - player.pitch;

            if (Math.abs(delta) < 0.025) return;
            const duration = Math.max(20, Math.min(650, Math.abs(delta) * 1000));

            await hold(p, delta > 0 ? 'ArrowUp' : 'ArrowDown', duration);
            await sleep(150 + latency);
        }
    }

    /**
     * Aim, click the shutter, wait for a new ready thumbnail, and record the photo in the
     * evidence log.
     *
     * @param p - Browser page to control
     * @param target - World-space camera target
     * @returns Newest ready album record.
     * @throws {Error} Aiming, capture readiness within 15 seconds, or browser interaction
     * fails.
     */
    async function photograph(p: Page, target: Vec3) {
        await aim(p, target);
        const beforeState = await snapshot(p);
        const before = beforeState.album.length;

        await p.locator('#shutter-button').click();
        await p.waitForFunction(
            (n) => globalThis.window.wildly.snapshot!.album.length > n
                && globalThis.window.wildly.snapshot!.album.at(-1)!.thumbnail === 'ready',
            before,
            { timeout: 15_000 },
        );
        const afterState = await snapshot(p);
        const photo = afterState.album.at(-1)!;

        log.push({
            elapsedMs: Date.now() - startedAt,
            photo,
            diagnosticAim: target,
        });
        await sleep(1050 + latency);

        return photo;
    }

    /**
     * Repeatedly frame eligible behavior and take ordinary photographs until the requested
     * legacy assignment is credited.
     *
     * @param p - Browser page to control
     * @param species - Legacy species to follow
     * @param assignment - Assignment ID that must appear in completed
     * @param seconds - Retry budget in seconds, default 35
     * @throws {Error} No credited photograph is obtained before the budget expires, or an
     * interaction fails.
     */
    async function portrait(
        p: Page,
        species: 'raccoon' | 'deer' | 'heron',
        assignment: string,
        seconds = 35,
    ) {
        const started = Date.now();

        while (Date.now() - started < seconds * 1000) {
            const state = await snapshot(p);

            if (state.completed.includes(assignment as never)) return;
            const animal = state.animals.find((a) => a.species === species)!;

            await aim(p, [
                animal.pose.position[0],
                animal.pose.position[1] + (species === 'raccoon' ? 0.45 : 0.9),
                animal.pose.position[2],
            ]);
            if (
                [
                    'inspect',
                    'wash',
                    'graze',
                    'investigate',
                    'display',
                    'preen',
                ].includes(animal.behavior)
            )
                await photograph(p, [
                    animal.pose.position[0],
                    animal.pose.position[1] + (species === 'raccoon' ? 0.45 : 0.9),
                    animal.pose.position[2],
                ]);
            else await sleep(300);
        }
        const finalState = await snapshot(p);

        throw new Error(
            `No legitimate ${assignment} photo in ${seconds}s; ${JSON.stringify(finalState.animals)}`,
        );
    }

    /**
     * Approach the live tin and use ordinary interaction, retrying at most eight times.
     *
     * @param p - Browser page to control
     * @throws {Error} The player cannot claim the tin or a browser action fails.
     */
    async function pickupTin(p: Page) {
        for (let index = 0; index < 8; index++) {
            const state = await snapshot(p),
                player = await me(p);

            if (state.tin.holder === player.id) return;
            const point = state.tin.pose.position;

            await walk(p, [point[0], point[1], point[2] + 0.65], 0.2);
            await face(p, point);
            await action(p, 'KeyE');
        }
        throw new Error('Ordinary E could not claim the tin');
    }

    /**
     * Approach the decoy's authored handle, use the ordinary interaction prompt, and assert
     * ownership.
     *
     * @param p - Browser page to control
     * @throws {Error} Approach or interaction fails, or the snapshot does not confirm
     * ownership.
     */
    async function pickupDecoy(p: Page) {
        const state = await snapshot(p);
        const property = state.props.find((p) => p.kind === 'decoy')!;
        const handle = propertyPoint(PROP_DEFINITIONS.decoy.handles[0], property.pose);

        /**
         * Read the contextual action prompt to determine whether the decoy handle can be taken.
         *
         * @returns Whether the current prompt offers decoy pickup.
         */
        const reachable = async () => /Take wildlife decoy handle/.test(
            (await p.locator('#context-action').textContent()) ?? '',
        );

        if (!(await reachable())) {
            try {
                await walk(p, propertyPoint([0, 0, 0.85], property.pose), 0.4);
            } catch (error) {
                if (!(await reachable())) throw error;
                log.push({
                    recoveredDriverWaypoint: String(error),
                    actualPrompt: await p.locator('#context-action').textContent(),
                });
            }
        }
        await face(p, handle);
        await action(p, 'KeyE');
        const afterState = await snapshot(p);
        const holders = afterState.props.find((p) => p.kind === 'decoy')!.holders;
        const player = await me(p);

        assert.ok(holders.includes(player.id));
    }

    return {
        sleep,
        reserve,
        snapshot,
        me,
        hold,
        face,
        walk,
        action,
        flat,
        travel,
        aim,
        photograph,
        portrait,
        pickupTin,
        pickupDecoy,
    };
}
