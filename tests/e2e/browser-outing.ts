/**
Historical visible outing scenario. Resource setup, failure evidence, and cleanup remain in browser.ts.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type WebSocketRoute } from 'playwright';
import {
    PROP_DEFINITIONS,
    PLANK_PLACEMENTS,
    RULES,
    CAMP,
} from '../../src/shared/world/level.ts';
import { animalRoute } from '../../src/server/simulation/wildlife/encounters.ts';
import { distance, propertyPoint, type Vec3 } from '../../src/shared/shared.ts';
import type { BrowserOutingContext } from './browser.ts';

/**
 * Execute the retained visible-browser outing scenario with supplied pages and navigation
 * helpers. Writes screenshots, logs, coverage, and restart evidence; this is historical
 * acceptance code, not a new gameplay routine.
 *
 * @param options - Existing driver resources, evidence collections, and action callbacks
 * @param options.count - Number of participating browser clients
 * @param options.evidence - Directory for screenshots, logs, and recovery files
 * @param options.resumedFrom - Prior evidence checkpoint, if resuming
 * @param options.serverOptions - Configuration for the owned test server
 * @param options.browsers - Owned browser instances
 * @param options.pages - Admitted crew pages
 * @param options.errors - Shared browser-error collection
 * @param options.network - Shared network evidence collection
 * @param options.log - Shared evidence log to append to
 * @param options.coverage - Shared scenario coverage record
 * @param options.latency - Simulated network latency in milliseconds
 * @param options.startedAt - Outing start time in Unix milliseconds
 * @param options.sleep - Wait between ordinary browser actions without advancing simulation
 * directly.
 * @param options.reserve - Return the world most recently observed by snapshot.
 * @param options.snapshot - Read the browser's diagnostic snapshot and refresh the cached
 * blueprint when its world changes.
 * @param options.me - Read the admitted page's local player from its diagnostic snapshot.
 * Requires an admitted player present in the snapshot.
 * @param options.hold - Hold a keyboard key for a duration and always release it afterward.
 * @param options.face - Turn toward a world point using arrow keys and snapshot feedback,
 * with a bounded number of attempts.
 * @param options.walk - Walk toward a waypoint with ordinary keys, detecting stalls and
 * optionally trying local detours. Unresolved obstacles invoke the existing recovery-file
 * workflow.
 * @param options.action - Press an ordinary action key and log the preceding prompt, player
 * position, and resulting notice.
 * @param options.flat - Measure horizontal distance for driver arrival checks.
 * @param options.travel - Guide ordinary walking through authored navigation and a final
 * clear destination. Retains the legacy decoy approach workaround used by the acceptance
 * scenario.
 * @param options.aim - Turn horizontally and adjust pitch toward a point using bounded
 * arrow-key attempts. Pitch adjustment is best effort after ten iterations.
 * @param options.photograph - Aim, click the shutter, wait for a new ready thumbnail, and
 * record the photo in the evidence log.
 * @param options.portrait - Repeatedly frame eligible behavior and take ordinary
 * photographs until the requested legacy assignment is credited.
 * @param options.pickupTin - Approach the live tin and use ordinary interaction, retrying
 * at most eight times.
 * @param options.pickupDecoy - Approach the decoy's authored handle, use the ordinary
 * interaction prompt, and assert ownership.
 * @param options.restart - Save and restart the owned server, wait for crew reconnection,
 * resume if appropriate, and assert album/credit persistence. Records evidence under the
 * supplied label.
 * @param options.checkpoint - Persist the latest snapshot, coverage, and log, then save a
 * screenshot and print checkpoint progress.
 * @param options.habitatViews - Capture first-person habitat and upward-sky screenshots,
 * then restore aim toward the habitat.
 * @param options.isRestarting - Getter for live server-restart status
 * @throws {Error} Scenario assertions, navigation, browser interaction, or evidence
 * persistence fail.
 */
export async function runOuting({
    count,
    evidence,
    resumedFrom,
    serverOptions,
    browsers,
    pages,
    errors,
    network,
    log,
    coverage,
    latency,
    startedAt,
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
    restart,
    checkpoint,
    habitatViews,
    isRestarting,
}: BrowserOutingContext) {
    const room = JSON.parse(
        await readFile(path.resolve(evidence, 'data/room.json'), 'utf8'),
    );

    for (let index = 0; index < count; index++) {
        const browser = await chromium.launch({
            channel: 'msedge',
            headless: false,
            ignoreDefaultArgs: ['--enable-unsafe-swiftshader'],
        });

        browsers.push(browser);
        // eslint-disable-next-line unicorn/no-null -- Playwright requires null to use the visible window viewport.
        const p = await browser.newPage({ viewport: null });

        if (resumedFrom) {
            const issued = Object.entries(
                room.sessions as Record<string, { name: string }>,
            ).find(
                ([, session]) => session.name === ['Rowan', 'Fern', 'Reed', 'Ash'][index],
            );

            assert.ok(
                issued,
                'prior issued session available for browser restoration',
            );
            await p.context().addCookies([
                {
                    name: 'wu_session',
                    value: issued[0],
                    url: serverOptions.origin,
                    httpOnly: true,
                    sameSite: 'Strict',
                    secure: serverOptions.origin.startsWith('https:'),
                },
            ]);
        }
        pages.push(p);
        p.on('pageerror', (error) => {
            errors.push(error.message);
        });
        p.on('requestfailed', (r) => {
            network.push({
                player: index + 1,
                path: new URL(r.url()).pathname,
                failed: r.failure()?.errorText,
            });
        },
        );
        p.on('response', (r) => {
            if (r.status() >= 400)
                network.push({
                    player: index + 1,
                    path: new URL(r.url()).pathname,
                    status: r.status(),
                });
        });
        p.on('console', (m) => {
            if (
                m.type() === 'error'
                && !m.text().startsWith('Failed to load resource:')
            )
                if (isRestarting() && m.text().startsWith('WebSocket connection'))
                    network.push({
                        expectedRestartError: m
                            .text()
                            .replaceAll(/wss?:\/\/[^ ]+/g, '[owned websocket]'),
                    });
                else errors.push(m.text());
        });
        if (latency)
            await p.routeWebSocket('**/ws', (client) => {
                const remote = client.connectToServer(),
                    timers = new Set<ReturnType<typeof setTimeout>>();

                for (const [source, target] of [
                    [client, remote],
                    [remote, client],
                ] as [WebSocketRoute, WebSocketRoute][]) {
                    source.onMessage((message) => {
                        const timer = setTimeout(() => {
                            timers.delete(timer);
                            target.send(message);
                        }, latency / 2);

                        timers.add(timer);
                    });
                    source.onClose(async (code, reason) => {
                        for (const timer of timers) clearTimeout(timer);
                        await target.close({ code, reason });
                    });
                }
            });
        await p.goto(serverOptions.origin);
        const screen = await p.evaluate(() => ({
            width: window.screen.availWidth,
            height: window.screen.availHeight,
        }));
        const cdp = await p.context().newCDPSession(p);
        const { windowId } = await cdp.send('Browser.getWindowForTarget');

        await cdp.send('Browser.setWindowBounds', {
            windowId,
            bounds: {
                windowState: 'normal',
                left: (index % 2) * Math.floor(screen.width / 2),
                top:
          count === 4 ? Math.floor(index / 2) * Math.floor(screen.height / 2) : 0,
                width: Math.floor(screen.width / 2),
                height:
          count === 4
              ? Math.floor(screen.height / 2)
              : Math.min(
                      screen.height,
                      Math.floor(((screen.width / 2) * 9) / 16) + 88,
                  ),
            },
        });
        await cdp.detach();
        await p.waitForFunction(
            () => document.body.dataset.ready === 'webgpu',
            {},
            { timeout: 60_000 },
        );
        if (!resumedFrom) {
            await p.locator('#name').fill(['Rowan', 'Fern', 'Reed', 'Ash'][index]);
            await p.locator('#secret').fill(index ? room.joinSecret : room.hostSecret);
            await p.locator('#join-form button').click();
        }
        await p.waitForFunction(() => !!globalThis.window.wildly.snapshot);
        await p.context().storageState({
            path: path.resolve(evidence, `private-browser-${index + 1}.json`),
        });
        assert.deepEqual(await p.evaluate(() => globalThis.window.wildly.assetErrors), []);
        console.log(`Visible full outing: researcher ${index + 1}/${count} joined.`);
    }
    const [host, friend] = pages;

    await host.locator(resumedFrom ? '#resume-button' : '#start-button').click();
    await host.waitForFunction(() => globalThis.window.wildly.snapshot?.phase === 'outing');
    const initial = await snapshot(host);

    assert.equal(new Set(initial.players.map((p) => p.slot)).size, count);
    const world = reserve();
    const woodland = world.pockets.find(
            (p) => p.habitat === 'woodland',
        )!.position,
        clearing = world.pockets.find((p) => p.habitat === 'clearing')!.position,
        wetland = world.pockets.find((p) => p.habitat === 'wetland')!.position;

    if (resumedFrom) {
        if (process.env.WU_RESUME_CURRENT_RUNTIME === '1') {
            await friend.locator('#settings-button').click();
            await friend.locator('#recover-button').click();
            await friend.locator('[data-close="settings"]').click();
            await sleep(400 + latency);
            const { props: propertiesRead1 } = await snapshot(host);

            coverage.authoritativeTippedPropRecovery = propertiesRead1.find((p) => p.kind === 'decoy')!.pose;
        }
        const state = await snapshot(host),
            decoy = state.props.find((p) => p.kind === 'decoy')!;

        await Promise.all([
            travel(host, [
                state.tin.pose.position[0] + 1,
                0,
                state.tin.pose.position[2] + 1,
            ]),
            travel(friend, [decoy.pose.position[0] + 1.4, 0, decoy.pose.position[2]]),
        ]);
        await pickupTin(host);
        await pickupDecoy(friend);
        await checkpoint('resumed-and-reclaimed-equipment');
        const woodlandAssignment = world.commissions
            .filter((c) => c.required)
            .map((c) => c.id)
            .find((a) => a.startsWith('raccoon'))!;

        const { completed: completedRead2 } = await snapshot(host);

        if (!completedRead2.includes(woodlandAssignment)) {
            await Promise.all([
                travel(host, [woodland[0] - 3, 0, woodland[2] + 3]),
                travel(friend, [woodland[0] - 6, 0, woodland[2] + 6]),
                ...pages
                    .slice(2)
                    .map((p, index) => travel(p, [woodland[0] + 2, 0, woodland[2] + 8 + index * 2]),
                    ),
            ]);
            await habitatViews('woodland', woodland);
            for (const [index, p] of pages.slice(0, 2).entries()) {
                await aim(p, [woodland[0], 1.1, woodland[2] + 6]);
                await p.screenshot({
                    path: path.resolve(evidence, `crew-shade-view-${index + 1}.png`),
                });
            }
            await woodlandPhoto();
        }
    } else {
        const fieldCase = initial.props.find((p) => p.kind === 'case')!;
        const handles = PROP_DEFINITIONS.case.handles.map((p) => propertyPoint(p, fieldCase.pose),
        );

        await walk(host, [handles[0][0] - 0.65, 0, handles[0][2]]);
        await face(host, handles[0]);
        await action(host, 'KeyE');
        await host.waitForFunction(() => {
            const p = globalThis.window.wildly.snapshot!.props.find((p) => p.kind === 'case')!;

            return p.holders.some(Boolean) && Math.abs(p.angularVelocity[1]) < 0.01;
        });
        const { props: propertiesRead3 } = await snapshot(host);
        const turnedCase = propertiesRead3.find(
            (p) => p.kind === 'case',
        )!;
        // eslint-disable-next-line unicorn/no-null -- Empty authoritative equipment handles are serialized as null.
        const freeHandle = turnedCase.holders.indexOf(null);
        const freePoint = propertyPoint(
            PROP_DEFINITIONS.case.handles[freeHandle],
            turnedCase.pose,
        );
        const reach = propertyPoint([freeHandle ? 1.4 : -1.4, 0, 0], turnedCase.pose);

        await walk(friend, reach);
        await face(friend, freePoint);
        await action(friend, 'KeyE');
        const { props: propertiesRead4 } = await snapshot(host);

        assert.equal(
            propertiesRead4
                .find((p) => p.kind === 'case')!
                .holders.filter(Boolean).length,
            2,
            'opposite handles claimed through E',
        );
        await action(host, 'KeyQ');
        const { props: propertiesRead5 } = await snapshot(host);

        assert.equal(
            propertiesRead5.find((p) => p.kind === 'case')!.open,
            true,
        );
        await sleep(RULES.whistleCooldown * 1000 + latency + 100);
        await action(host, 'KeyQ');
        const { props: propertiesRead6 } = await snapshot(host);

        assert.equal(
            propertiesRead6.find((p) => p.kind === 'case')!.open,
            false,
        );
        await hold(host, 'ArrowDown', 350);
        await host.screenshot({ path: path.resolve(evidence, 'two-handles.png') });
        await hold(host, 'ArrowUp', 350);
        const { position: positionRead7 } = await me(friend);
        const partner = positionRead7;

        await photograph(host, [partner[0], partner[1] + 0.8, partner[2]]);
        console.log('Two physical handles and visible case lid controls passed.');
        const startCrew = await Promise.all([me(host), me(friend)]);

        await Promise.all(
            [host, friend].map((p, index) => walk(
                p,
                [startCrew[index].position[0], 0, startCrew[index].position[2] - 4],
                0.45,
            ),
            ),
        );
        const { props: propertiesRead8 } = await snapshot(host);
        const carried = propertiesRead8.find(
            (p) => p.kind === 'case',
        )!;

        assert.ok(
            distance(carried.pose.position, fieldCase.pose.position) > 2.5,
            'case travels with both holders through ordinary walking',
        );
        await action(host, 'KeyG');
        const { props: propertiesRead9 } = await snapshot(friend);

        assert.equal(
            propertiesRead9
                .find((p) => p.kind === 'case')!
                .holders.filter(Boolean).length,
            1,
        );
        const { spareBait: spareBaitRead10 } = await snapshot(host);
        const spareBefore = spareBaitRead10;

        await action(friend, 'KeyQ');
        for (let n = 0; n < 5; n++) {
            const { spills } = await snapshot(host);

            if (spills.length > 0) break;
            await hold(friend, 'ArrowLeft', 700);
            await hold(friend, 'KeyW', 500);
            await sleep(300 + latency);
        }
        const { spills: spillsRead11 } = await snapshot(host);

        assert.ok(
            spillsRead11.length > 0,
            'open case spills through a real turn/contact',
        );
        const spillStarted = Date.now();

        await sleep(3100 + latency);
        await action(friend, 'KeyQ');
        const { spills: spillsRead12 } = await snapshot(host);
        const pile = spillsRead12[0];
        const carrying = await me(friend),
            away = flat(carrying.position, pile.position) || 1;

        await walk(
            friend,
            [
                carrying.position[0]
                + ((carrying.position[0] - pile.position[0]) * 3) / away,
                carrying.position[1],
                carrying.position[2]
                + ((carrying.position[2] - pile.position[2]) * 3) / away,
            ],
            0.4,
        );
        await action(friend, 'KeyE');
        const { props: propertiesRead13 } = await snapshot(host);

        assert.equal(
            propertiesRead13
                .find((p) => p.kind === 'case')!
                .holders.filter(Boolean).length,
            0,
        );
        for (
            let attempt = 0;
            attempt < 12;
            attempt++
        ) {
            const { spills: spillsRead14 } = await snapshot(host);

            if (spillsRead14.length === 0) break;
            const { spills } = await snapshot(host);
            const spill = spills[0];

            await walk(
                host,
                [spill.position[0], spill.position[1], spill.position[2] + 0.6],
                0.2,
            );
            await face(host, spill.position);
            await action(host, 'KeyE');
        }
        const { spills: spillsRead15 } = await snapshot(host);

        assert.equal(
            spillsRead15.length,
            0,
            'all spill piles recovered through E',
        );
        const { spareBait: spareBaitRead16 } = await snapshot(host);

        assert.equal(spareBaitRead16, spareBefore);
        coverage.spillRecoveryMs = Date.now() - spillStarted;
        await checkpoint('case-spill-recovered');
        console.log('Shared carry, individual release and stable set-down passed.');
        await Promise.all([walk(host, [-46, 0, 34]), walk(friend, [-45, 0, 35.5])]);
        const latch = reserve().fixtures.find((f) => f.kind === 'gate')!.latch!;

        await walk(host, [latch[0], 0, latch[2] + 1.1]);
        await face(host, latch);
        await action(host, 'KeyE');
        const { route: routeRead17 } = await snapshot(host);

        assert.equal(
            routeRead17.gateOpen,
            true,
            'ordinary latch interaction opens the real route',
        );
        await walk(host, [-44.8, 0, 33]);
        for (const point of [
            [-43, 0, 28],
            [-38, 0, 14],
            [-22, 0, 2],
        ] as Vec3[]) {
            await Promise.all([
                walk(host, point),
                walk(friend, [point[0] - 0.75, point[1], point[2] + 1.3]),
            ]);
        }
        await host.screenshot({
            path: path.resolve(evidence, 'woodland-to-washout.png'),
        });
        console.log(
            'Visible gate opening and both players walking the forest route passed.',
        );
        for (const [index, p] of pages.slice(2).entries()) {
            for (const point of [
                [-46, 0, 34],
                [-44.8, 0, 33],
                [-43, 0, 28],
                [-38, 0, 14],
                [-24, 0, 1 - index * 2],
            ] as Vec3[])
                await walk(p, point);
        }
        const { props: propertiesRead18 } = await snapshot(host);
        const plank = propertiesRead18.find((p) => p.kind === 'plank')!;
        const plankHandle = propertyPoint(
            PROP_DEFINITIONS.plank.handles[0],
            plank.pose,
        );

        await walk(host, [-22, 0, 5.55]);
        await walk(host, [plankHandle[0], 0, plankHandle[2] + 0.6], 0.16);
        await face(host, plankHandle);
        await action(host, 'KeyE');
        const { props: propertiesRead19 } = await snapshot(host);
        const { id: idRead20 } = await me(host);

        assert.ok(
            propertiesRead19
                .find((p) => p.kind === 'plank')!
                .holders.includes(idRead20),
            'staged plank handle reachable from supported bank',
        );
        const carrier = await me(host);

        await face(host, [carrier.position[0], 0, carrier.position[2] - 20]);
        await sleep(650 + latency);
        await walk(friend, [-17, 0, 2]);
        for (let n = 0; n < 20; n++) {
            const { props: propertiesRead21 } = await snapshot(host);
            const current = propertiesRead21.find(
                (p) => p.kind === 'plank',
            )!;

            if (
                distance(current.pose.position, PLANK_PLACEMENTS.right.position) < 0.5
            )
                break;
            await hold(host, 'KeyD', 500);
            await sleep(150 + latency);
        }
        await host.screenshot({ path: path.resolve(evidence, 'plank-seat-guide.png') });
        await action(host, 'KeyE');
        const { route: routeRead22 } = await snapshot(host);

        assert.equal(
            routeRead22.crossing,
            'right',
            'ordinary rotation and push seats the staged plank',
        );
        await walk(host, [-15.5, -1, 5.55]);
        await walk(host, [-15.5, -1, 5]);
        await walk(host, [-10.25, -1, 5], 0.2);
        await walk(host, [-7, 0, 3]);
        await walk(friend, [-15.5, -1, 5]);
        await walk(friend, [-10.25, -1, 5], 0.2);
        await walk(friend, [-8, 0, 5]);
        for (const [index, p] of pages.slice(2).entries()) {
            await walk(p, [-15.5, -1, 5]);
            await walk(p, [-10.25, -1, 5], 0.2);
            await walk(p, [-8, 0, -index * 2]);
        }
        await host.screenshot({ path: path.resolve(evidence, 'crossing-complete.png') });
        console.log(
            'Staged plank claimed, rotated, seated and crossed through ordinary controls.',
        );
        coverage.teamwork = [
            'Opposite-handle case carry and individual release',
            'One crew member seats plank while others wait and cross',
        ];
        await checkpoint('equipment-complete');
        coverage.seed = world.seed;
        coverage.assignments = world.commissions
            .filter((c) => c.required)
            .map((c) => c.id);

        // A live raccoon with no food lure gives its readable reach cue before theft.

        await travel(host, [woodland[0] - 3, 0, woodland[2] + 2]);
        const hatStarted = Date.now();

        for (let attempt = 0; attempt < 30; attempt++) {
            const state = await snapshot(host);

            const r = state.animals.find((a) => a.species === 'raccoon')!;

            if (state.hats.some((h) => h.carrier.startsWith('animal:'))) break;
            await walk(host, r.pose.position, 0.65);
            const { animals: animalsRead23 } = await snapshot(host);

            if (
                animalsRead23.some((a) => a.behavior === 'hat-reach')
            ) {
                coverage.hatReachCueObserved = true;
                await host.screenshot({
                    path: path.resolve(evidence, `hat-reach-${attempt}.png`),
                });
            }
            await sleep(1500);
        }
        const { hats: hatsRead24 } = await snapshot(host);

        assert.ok(
            hatsRead24.some((h) => h.carrier.startsWith('animal:')),
            'ordinary proximity causes a telegraphed borrowed hat',
        );
        await checkpoint('hat-borrowed');
        const { hats: hatsRead25 } = await snapshot(host);
        const stolen = hatsRead25.find((h) => h.carrier.startsWith('animal:'),
        )!;

        await face(host, stolen.position);
        await hold(host, 'KeyS', 1200);
        const { hats: hatsRead26 } = await snapshot(host);
        const hatSubject = hatsRead26.find(
            (h) => h.owner === stolen.owner,
        )!;

        await photograph(host, hatSubject.position);
        for (let attempt = 0; attempt < 25; attempt++) {
            const { hats: hatsRead27 } = await snapshot(host);
            const hat = hatsRead27.find(
                (h) => h.owner === stolen.owner,
            )!;

            if (hat.carrier === 'owner') break;
            await walk(host, hat.position, 0.65);
            await face(host, hat.position);
            await action(host, 'KeyE');
        }
        const { hats: hatsRead28 } = await snapshot(host);

        assert.equal(
            hatsRead28.find((h) => h.owner === stolen.owner)!
                .carrier,
            'owner',
        );
        coverage.hatRecoveryMs = Date.now() - hatStarted;
        coverage.hatRecoveryRoute
            = 'Ordinary proximity produces theft; subsequent E recovery restores the owner. Consult action prompts and checkpoint ticks to distinguish a chase catch from timeout-drop recovery; this timer includes approach and photography.';
        await checkpoint('hat-recovered');
        await travel(friend, [woodland[0] - 3, 0, woodland[2] + 2]);
        for (let attempt = 0; attempt < 30; attempt++) {
            const state = await snapshot(friend),
                r = state.animals.find((a) => a.species === 'raccoon')!;

            if (state.hats.some((h) => h.carrier.startsWith('animal:'))) break;
            await walk(friend, r.pose.position, 0.65);
            await sleep(1500);
        }
        const { hats: hatsRead29 } = await snapshot(host);
        const secondHat = hatsRead29.find((h) => h.carrier.startsWith('animal:'),
        );

        assert.ok(
            secondHat,
            'another unprotected crew member can experience the visible hat incident',
        );
        await checkpoint('hat-chase-before-restart');
        await restart('hatChaseRestart');
        const { hats: hatsRead30 } = await snapshot(host);

        assert.equal(
            hatsRead30.find((h) => h.owner === secondHat.owner)!
                .carrier,
            'owner',
            'server restart safely returns borrowed hat',
        );
        coverage.hatRestartSafeRecovery = true;

        await Promise.all([
            travel(host, [CAMP[0], 0, CAMP[2] - 3]),
            travel(friend, [-50, 0, 48]),
        ]);
        await pickupTin(host);
        await pickupDecoy(friend);
        await Promise.all([
            travel(host, [woodland[0] - 3, 0, woodland[2] + 3]),
            travel(friend, [woodland[0] - 6, 0, woodland[2] + 6]),
            ...pages
                .slice(2)
                .map((p, index) => travel(p, [woodland[0] + 2, 0, woodland[2] + 8 + index * 2]),
                ),
        ]);
        await habitatViews('woodland', woodland);
        for (const [index, p] of pages.slice(0, 2).entries()) {
            await aim(p, [woodland[0], 1.1, woodland[2] + 6]);
            await p.screenshot({
                path: path.resolve(evidence, `crew-shade-view-${index + 1}.png`),
            });
        }
        await woodlandPhoto();
    }

    /**
     * Coordinate the helper's lure actions and photographer's raccoon attempts, then record the
     * woodland checkpoint. Uses the retained legacy assignment selection.
     *
     * @throws {Error} The coordinated photo attempt, navigation, or checkpoint fails.
     */
    async function woodlandPhoto() {
        const assignment = world.commissions
            .filter((c) => c.required)
            .map((c) => c.id)
            .find((a) => a.startsWith('raccoon'))!;
        const lurePoint
            = assignment === 'raccoon-wash'
                ? world.pockets
                    .flatMap((p) => p.anchors)
                    .find((a) => a.kind === 'wash')!.point
                : ([woodland[0] - 3, 0, woodland[2] + 1] as Vec3);

        // The photographer is in place before the helper starts the bounded behavior.

        const { position: positionRead31 } = await me(host);
        const { position: positionRead32 } = await me(host);

        await aim(friend, [
            positionRead31[0],
            1.1,
            positionRead32[2],
        ]);
        await friend.screenshot({
            path: path.resolve(evidence, 'outing-rowan-shade-identity.png'),
        });
        await walk(friend, [lurePoint[0] - 5, 0, lurePoint[2] + 5]);
        await aim(friend, [lurePoint[0], 0.45, lurePoint[2]]);
        await walk(host, [lurePoint[0] + 2, 0, lurePoint[2] + 0.7]);
        await face(host, lurePoint);
        await action(host, 'KeyQ');
        let isFinished = false;

        await Promise.all([
            (async () => {
                try {
                    await portrait(friend, 'raccoon', assignment, 50);
                } finally {
                    isFinished = true;
                }
            })(),
            (async () => {
                for (let attempt = 0; !isFinished && attempt < 4; attempt++) {
                    await sleep(6500);
                    if (isFinished) return;
                    const { completed } = await snapshot(host);

                    if (completed.includes(assignment)) return;
                    await walk(host, [
                        lurePoint[0] + (attempt % 2 ? 2 : -2),
                        0,
                        lurePoint[2] + 0.7,
                    ]);
                    await face(host, lurePoint);
                    await action(host, 'KeyQ');
                }
            })(),
        ]);
        await checkpoint('woodland-assignment');
    }

    /**
     * Move the host along an authored route in short steps while waiting for the interested
     * raccoon to follow the tin. Logs observed progress without relocating wildlife.
     *
     * @param target - World destination for the escort
     * @throws {Error} Ordinary movement fails or the raccoon falls outside the allowed interest
     * distance.
     */
    async function escort(target: Vec3) {
        const state = await snapshot(host),
            player = await me(host);
        const node = reserve().navNodes.toSorted(
            (a, b) => flat(a.position, target) - flat(b.position, target),
        )[0];
        const path = [
            ...animalRoute(player.position, node.id, {
                world: reserve(),
                route: state.route,
            }),
            target,
        ];

        for (const waypoint of path) {
            /**
            Run this bounded phase of the ordinary-controls outing.
             */
            async function followWaypoint() {
                for (
                    let attempt = 0;
                    attempt < 100;
                    attempt++
                ) {
                    const { position: positionRead33 } = await me(host);

                    if (flat(positionRead33, waypoint) <= 0.5) break;
                    const { position: here } = await me(host);
                    const
                        length = flat(here, waypoint),
                        amount = Math.min(2.4, length);
                    const next: Vec3 = [
                        here[0] + ((waypoint[0] - here[0]) * amount) / length,
                        waypoint[1],
                        here[2] + ((waypoint[2] - here[2]) * amount) / length,
                    ];

                    await walk(host, next, 0.35);
                    let waited = 0;

                    /**
                    Run this bounded phase of the ordinary-controls outing.
                     */
                    async function waitForRaccoon() {
                        while (waited < 18_000) {
                            const current = await snapshot(host),
                                r = current.animals.find((a) => a.species === 'raccoon')!;

                            if (flat(r.pose.position, current.tin.pose.position) < 4) break;
                            await sleep(500);
                            waited += 500;
                        }
                    }
                    await waitForRaccoon();
                    const current = await snapshot(host),
                        r = current.animals.find((a) => a.species === 'raccoon')!;

                    log.push({
                        escortTick: current.tick,
                        raccoon: r.pose.position,
                        tin: current.tin.pose.position,
                        waited,
                    });
                    if (flat(r.pose.position, current.tin.pose.position) > 11.5)
                        throw new Error(
                            'Open tin escort lost raccoon interest; route/animal stall requires investigation',
                        );
                }
            }
            await followWaypoint();
        }
    }
    await Promise.all([
        escort([clearing[0] - 7, 0, clearing[2] - 3]),
        travel(friend, [clearing[0] - 5, 0, clearing[2] + 5]),
        ...pages
            .slice(2)
            .map((p, index) => travel(p, [clearing[0] + 7 + index * 2, 0, clearing[2] + 7])),
    ]);
    const deerAssignment = world.commissions
        .filter((c) => c.required)
        .map((c) => c.id)
        .find((a) => a.startsWith('deer'))!;

    await habitatViews('clearing', clearing);
    await aim(host, [clearing[0], 1.1, clearing[2] + 7]);
    await host.screenshot({ path: path.resolve(evidence, 'crew-sun-view.png') });
    if (deerAssignment === 'deer-graze')
        await portrait(friend, 'deer', deerAssignment, 40);
    const { props: propertiesRead34 } = await snapshot(host);
    const decoyBefore = propertiesRead34.find(
        (p) => p.kind === 'decoy',
    )!;

    await action(friend, 'KeyE');
    const { props: propertiesRead35 } = await snapshot(host);
    let decoy = propertiesRead35.find((p) => p.kind === 'decoy')!;
    const cup = propertyPoint(PROP_DEFINITIONS.decoy.usePoints![0].point, decoy.pose);

    await walk(friend, propertyPoint([1, 0, -0.6], decoy.pose), 0.2);
    await face(friend, cup);
    await action(friend, 'KeyQ');
    const { props: propertiesRead36 } = await snapshot(host);

    assert.equal(
        propertiesRead36.find((p) => p.kind === 'decoy')!.open,
        true,
    );
    await walk(friend, [clearing[0] - 7, 0, clearing[2] + 6]);
    if (deerAssignment === 'deer-decoy')
        await portrait(friend, 'deer', deerAssignment, 45);
    const { completed: completedRead37 } = await snapshot(host);
    const priorCompleted = [...completedRead37],
        movedAt = Date.now();

    await pickupDecoy(friend);
    await walk(friend, [clearing[0] - 5, 0, clearing[2] + 8]);
    await action(friend, 'KeyE');
    const { props: propertiesRead38 } = await snapshot(host);

    decoy = propertiesRead38.find((p) => p.kind === 'decoy')!;
    assert.ok(flat(decoy.pose.position, decoyBefore.pose.position) > 1.2);
    await pickupDecoy(friend);
    await walk(friend, [clearing[0] - 4, 0, clearing[2] + 4]);
    await action(friend, 'KeyE');
    await walk(friend, [clearing[0] - 7, 0, clearing[2] + 7]);
    const { completed: completedRead39 } = await snapshot(host);

    assert.deepEqual(
        completedRead39,
        priorCompleted,
        'moving and restoring decoy never removes earned assignments',
    );
    coverage.decoyRecoveryMs = Date.now() - movedAt;
    await checkpoint('deer-and-decoy-recovery');

    if (count === 4) {
        await Promise.all([
            travel(host, [14, 0, 4]),
            ...pages.slice(1).map((p, index) => travel(p, [12 + index * 2, 0, 10])),
        ]);
        for (const p of pages.slice(1)) {
            const { position: positionRead40 } = await me(host);

            await face(p, positionRead40);
        }
        await aim(host, [14, 1, 10]);
        await host.screenshot({
            path: path.resolve(evidence, 'outing-crew-clearing-light.png'),
        });
        await travel(friend, [9, 0, 4]);
        await travel(host, [12, 0, 10]);
        await travel(friend, [12, 0, 4]);
        const { position: positionRead41 } = await me(friend);

        await face(host, positionRead41);
        await aim(friend, [12, 1, 10]);
        await friend.screenshot({
            path: path.resolve(evidence, 'outing-rowan-clearing-light.png'),
        });
        const { hats: hatsRead42 } = await snapshot(host);

        coverage.crewViewHats = hatsRead42.map((h) => ({
            owner: h.owner,
            carrier: h.carrier,
        }));
    }

    await Promise.all([
        escort([wetland[0] - 6, 0, wetland[2] + 1]),

        // From the northwest, the setup helper and reeds sit behind the subjects.

        travel(friend, [wetland[0] - 8, 0, wetland[2] - 7]),
        ...pages
            .slice(2)
            .map((p, index) => travel(p, [wetland[0] + 3 + index * 2, 0, wetland[2] + 10])),
    ]);
    const heronAssignment = world.commissions
        .filter((c) => c.required)
        .map((c) => c.id)
        .find((a) => a.startsWith('heron'))!;

    await habitatViews('wetland', wetland);
    if (heronAssignment === 'heron-preen')
        await portrait(friend, 'heron', heronAssignment, 40);
    for (
        let attempt = 0;
        attempt < 6;
        attempt++
    ) {
        const { completed } = await snapshot(host);

        if (completed.includes('pond-pair')) break;
        await walk(host, [wetland[0] - 2.2, 0, wetland[2] + 0.6]);
        await sleep(3100 + latency);
        await action(host, 'KeyQ');
        await walk(host, [wetland[0] - 5.6, 0, wetland[2] + 0.6]);
        await face(host, [wetland[0] - 5.6, 0, wetland[2] + 10]);

        // Tin remains held; move the setup on subsequent attempts to renew bounded interest.

        if (attempt % 2) await walk(host, [wetland[0] - 5.6, 0, wetland[2] + 2.2]);
        const end = Date.now() + 23_000;
        let adjustedAt = 0;

        /**
        Run this bounded phase of the ordinary-controls outing.
         */
        async function observePondPair() {
            while (
                Date.now() < end
            ) {
                const { completed } = await snapshot(host);

                if (completed.includes('pond-pair')) break;
                const state = await snapshot(host);
                const r = state.animals.find((a) => a.species === 'raccoon')!,
                    h = state.animals.find((a) => a.species === 'heron')!;

                if (
                    (h.behavior === 'display'
                        || (h.behavior === 'feed' && h.remaining < 2))
                    && r.behavior !== 'inspect'
                    && Date.now() - adjustedAt > 3500
                ) {
                    const current = await me(host);

                    await walk(host, [
                        wetland[0] - 5.6,
                        0,
                        current.position[2] - wetland[2] > 1.4
                            ? wetland[2] + 0.4
                            : wetland[2] + 2.2,
                    ]);
                    await face(host, [wetland[0] - 5.6, 0, wetland[2] + 10]);
                    adjustedAt = Date.now();
                    continue;
                }
                const center: Vec3 = [
                    (r.pose.position[0] + h.pose.position[0]) / 2,
                    0.8,
                    (r.pose.position[2] + h.pose.position[2]) / 2,
                ];

                await aim(friend, center);
                if (h.behavior === 'display') await photograph(friend, center);
                else await sleep(200);
            }
        }
        await observePondPair();
    }
    const { completed: completedRead43 } = await snapshot(host);

    assert.ok(
        completedRead43.includes('pond-pair'),
        'actual quiet bait setup and concurrent inspect/display produce pond pair',
    );
    const { completed: completedRead44 } = await snapshot(host);

    if (!completedRead44.includes(heronAssignment))
        await portrait(friend, 'heron', heronAssignment, 40);
    const { completed: completedRead45 } = await snapshot(host);

    assert.equal(completedRead45.length, 4);
    await checkpoint('all-four-assignments');
    coverage.photoTeamwork
        = 'One researcher carries/adjusts the actual open tin and baits the wetland while the second holds a distant camera angle and uses the shutter during concurrent behaviors.';

    // Authenticated image display is checked in the second real browser.

    await friend.locator('#notebook-button').click();
    await friend.waitForFunction(
        () => [...document.querySelectorAll<HTMLImageElement>('#album img')].filter(
            (index) => index.complete && index.naturalWidth === 640 && index.naturalHeight === 360,
        ).length >= 4,
    );
    coverage.sharedJPEGs = await friend.evaluate(() => [...document.querySelectorAll<HTMLImageElement>('#album img')].map(
        (index) => ({
            width: index.naturalWidth,
            height: index.naturalHeight,
            path: new URL(index.src).pathname,
        }),
    ),
    );
    coverage.sharedImageRange = await friend.evaluate(() => {
        const img = document.querySelector<HTMLImageElement>('#album img')!,
            canvas = document.createElement('canvas');

        canvas.width = 64;
        canvas.height = 36;
        const context = canvas.getContext('2d')!;

        context.drawImage(img, 0, 0, 64, 36);
        const data = context.getImageData(0, 0, 64, 36).data;
        let min = 255,
            max = 0;

        for (let index = 0; index < data.length; index += 4) {
            min = Math.min(min, data[index]);
            max = Math.max(max, data[index]);
        }

        return max - min;
    });
    assert.ok(
        Number(coverage.sharedImageRange) > 30,
        'shared photo contains rendered color variation',
    );
    await friend.screenshot({ path: path.resolve(evidence, 'shared-album.png') });
    await friend.locator('[data-close="notebook"]').click();
    await action(host, 'KeyE');
    await Promise.all(
        pages.map((p, index) => travel(p, [CAMP[0] + (index % 2) * 2, 0, CAMP[2] + Math.floor(index / 2) * 2]),
        ),
    );
    for (const p of pages) await p.locator('#ready-button').click();
    await host.locator('#finish-button').click();
    await host.waitForFunction(
        () => globalThis.window.wildly.snapshot!.phase === 'exhibition',
    );
    await checkpoint('exhibition');
    if (
        !(await friend
            .locator('#notebook')
            .evaluate((element) => element.hasAttribute('open')))
    )
        await friend.locator('#notebook-button').click();
    const favorite = friend
        .locator('#album button')
        .filter({ hasText: /favorite/i })
        .first();

    await favorite.click();
    await host.waitForFunction(() => globalThis.window.wildly.snapshot!.album.some((p) => p.favorites.length > 0),
    );
    await friend.locator('[data-close="notebook"]').click();
    await restart('exhibitionRestart');
    await checkpoint('favorites-restored');
    coverage.visibleClientMetrics = await Promise.all(
        pages.map((p) => p.evaluate(() => ({
            backend: globalThis.window.wildly.backend,
            adapter: globalThis.window.wildly.adapter,
            p95: globalThis.window.wildly.p95,
            rtt: globalThis.window.wildly.rtt,
            render: globalThis.window.wildly.render,
            visible: document.visibilityState,
        })),
        ),
    );
    if (latency)
        assert.ok(
            (await host.evaluate(() => globalThis.window.wildly.rtt)) > latency * 0.7,
            'real sockets include the configured round-trip delay',
        );
    coverage.idleRoles
        = count === 4
            ? 'Players 3/4 cross and travel, then wait as observers while two agents prepare/photograph animals. No claim of balanced human engagement.'
            : 'Two agents alternate setup and photography; photographer waits during tin herding.';
    coverage.predominantSolution
        = 'Same tin escort plus quiet bait/photo timing; site/assignment variations use the authored graph. Compare distinct seeds in the report.';
    assert.deepEqual(errors, []);
    await writeFile(
        path.resolve(evidence, 'result.json'),
        JSON.stringify(
            {
                scope: `Visible ${count}-player forest MVP full outing through ordinary controls, with labeled read-only diagnostic guidance`,
                coverage,
                count,
                latency,
                transport:
          new URL(serverOptions.origin).protocol === 'https:'
              ? 'HTTPS/WSS via coordinated proxy to owned backend'
              : 'HTTP/WS loopback',
                elapsedMs: Date.now() - startedAt,
                errors,
                network,
                log,
                final: await snapshot(host),
            },
            undefined,
            2,
        ),
    );
    console.log(`Equipment handling evidence: ${evidence}`);
}
