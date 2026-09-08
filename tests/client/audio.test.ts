import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createAudio } from '../../src/client/audio/audio.ts';

// Node has no audio device or WebAudio. This boundary records the actual graph,
// scheduling and I/O requested by production; it does not establish audibility.

class Parameter {
    value = 1;
    ramps: { value: number; time: number }[] = [];
    setValueAtTime(value: number) {
        assert.ok(Number.isFinite(value));
        this.value = value;
    }

    setTargetAtTime(value: number) {
        this.setValueAtTime(value);
    }

    linearRampToValueAtTime(value: number, time: number) {
        this.ramps.push({ value, time });
        this.setValueAtTime(value);
    }

    cancelAndHoldAtTime() {}
    cancelScheduledValues() {}
}
class Node extends EventTarget {
    links: Node[] = [];
    disconnected = false;
    connect(node: Node) {
        this.links.push(node);

        return node;
    }

    disconnect() {
        this.disconnected = true;
    }
}
class Gain extends Node {
    gain = new Parameter();
}
class Compressor extends Node {
    threshold = new Parameter();
    knee = new Parameter();
    ratio = new Parameter();
    attack = new Parameter();
    release = new Parameter();
}
class Shaper extends Node {
    // eslint-disable-next-line unicorn/no-null -- Web Audio exposes this unset property as null.
    curve: Float32Array | null = null;
}
class Panner extends Node {
    positionX = new Parameter();
    positionY = new Parameter();
    positionZ = new Parameter();
    panningModel = '';
    distanceModel = '';
    refDistance = 1;
    maxDistance = 10_000;
    rolloffFactor = 1;
}
class Source extends Node {
    // eslint-disable-next-line unicorn/no-null -- Web Audio exposes this unset property as null.
    buffer: { label: string; duration: number } | null = null;
    playbackRate = new Parameter();
    loop = false;
    loopStart = 0;
    loopEnd = 0;
    started = false;
    stopped = false;
    start() {
        this.started = true;
    }

    stop() {
        this.stopped = true;
        this.dispatchEvent(new Event('ended'));
    }
}
class Context {
    static instances: Context[] = [];
    static failResume = false;
    static failDecode = false;
    state = 'suspended';
    currentTime = 0;
    destination = new Node();
    gains: Gain[] = [];
    sources: Source[] = [];
    panners: Panner[] = [];
    compressors: Compressor[] = [];
    shapers: Shaper[] = [];
    listener = Object.fromEntries(
        [
            'positionX',
            'positionY',
            'positionZ',
            'forwardX',
            'forwardY',
            'forwardZ',
            'upX',
            'upY',
            'upZ',
        ].map((k) => [k, new Parameter()]),
    );

    constructor() {
        Context.instances.push(this);
    }

    createGain() {
        const n = new Gain();

        this.gains.push(n);

        return n;
    }

    createBufferSource() {
        const n = new Source();

        this.sources.push(n);

        return n;
    }

    createPanner() {
        const n = new Panner();

        this.panners.push(n);

        return n;
    }

    createDynamicsCompressor() {
        const n = new Compressor();

        this.compressors.push(n);

        return n;
    }

    createWaveShaper() {
        const n = new Shaper();

        this.shapers.push(n);

        return n;
    }

    async decodeAudioData(bytes: ArrayBuffer) {
        if (Context.failDecode) throw new Error('decode');

        return {
            label: new TextDecoder().decode(bytes),
            duration: 1,
            length: 22_050,
            numberOfChannels: 1,
        };
    }

    async resume() {
        if (Context.failResume) throw new Error('autoplay');
        this.state = 'running';
    }

    async suspend() {
        this.state = 'suspended';
    }

    async close() {
        this.state = 'closed';
    }
}
const originalContext = Object.getOwnPropertyDescriptor(
        globalThis,
        'AudioContext',
    ),
    originalFetch = globalThis.fetch;
let requests: string[] = [],

    isFailFetch = false;

/**
 * Install deterministic audio and fetch fixtures.
 *
 * @returns Audio test controls and captured playback state.
 */
function setup() {
    Context.instances = [];
    Context.failResume = false;
    Context.failDecode = false;
    // eslint-disable-next-line unicorn/no-top-level-assignment-in-function -- The test owns this resettable fetch fixture and restores it after each case.
    requests = [];
    // eslint-disable-next-line unicorn/no-top-level-assignment-in-function -- Reset the fetch failure fixture owned by this test.
    isFailFetch = false;
    Object.defineProperty(globalThis, 'AudioContext', {
        configurable: true,
        value: Context,
    });
    // eslint-disable-next-line unicorn/no-global-object-property-assignment -- The test owns this resettable fetch fixture and restores it after each case.
    globalThis.fetch = async (url) => {
        requests.push(String(url));
        if (isFailFetch) throw new Error('offline');

        return new Response(String(url));
    };

    return createAudio();
}
afterEach(() => {
    if (originalContext)
        Object.defineProperty(globalThis, 'AudioContext', originalContext);
    else Reflect.deleteProperty(globalThis, 'AudioContext');
    // eslint-disable-next-line unicorn/no-global-object-property-assignment -- The test owns this resettable fetch fixture and restores it after each case.
    globalThis.fetch = originalFetch;
});
const settle = async () => {
    for (let n = 0; n < 8; n++) await new Promise((r) => setImmediate(r));
};
const cue = (id: string, kind = 'rattle', extra = {}) => ({
    id,
    kind,
    position: [0, 0, 0] as [number, number, number],
    ...extra,
});
const effects = () => Context.instances[0].sources.filter(
    (s) => !s.loop && s.started && !s.stopped,
);

test('user gesture creates only one context; dispose is terminal', async () => {
    const a = setup();

    a.cue(cue('before'));
    assert.equal(Context.instances.length, 0);
    await Promise.all([a.unlock(), a.unlock()]);
    assert.equal(Context.instances.length, 1);
    a.dispose();
    a.dispose();
    await a.unlock();
    await settle();
    assert.equal(Context.instances.length, 1);
    assert.equal(Context.instances[0].state, 'closed');
});
test('settings clamp finite levels, master mute is absolute, music defaults off', async () => {
    const a = setup();

    await a.unlock();
    await settle();
    const c = Context.instances[0];

    assert.equal(c.gains[3].gain.value, 0);
    a.settings({ master: 0, effects: 4, ambience: NaN, music: -1 });
    assert.deepEqual(
        c.gains.slice(0, 4).map((g) => g.gain.value),
        [0, 1, 0, 0],
    );
    a.dispose();
});

test('mix protection bounds native transfer while master remains after its tails', async () => {
    const a = setup();

    await a.unlock();
    const c = Context.instances[0];

    assert.equal(c.compressors.length, 1);
    assert.equal(c.shapers.length, 1);
    const compressor = c.compressors[0],
        shaper = c.shapers[0];

    assert.ok(c.gains.slice(1, 4).every((g) => g.links[0] === compressor));
    assert.equal(compressor.links[0], shaper);
    assert.equal(shaper.links[0], c.gains[0]);
    assert.equal(c.gains[0].links[0], c.destination);
    const curve = shaper.curve!;

    assert.ok(Math.max(...curve) <= 0.951 && Math.min(...curve) >= -0.951);
    assert.equal(curve[(curve.length - 1) / 2], 0);
    assert.equal(curve[((curve.length - 1) * 5) / 8], 0.25);
    a.dispose();
    assert.ok(compressor.disconnected && shaper.disconnected);
});

test('water fades to zero before stop, and repeated departure cannot extend release', async () => {
    const a = setup();

    a.environment({ habitat: 'wetland', waterDistance: 0 });
    await a.unlock();
    await settle();
    const c = Context.instances[0];
    const water = c.sources.find((s) => s.buffer?.label.endsWith('water.wav'))!;

    a.environment({ habitat: 'wetland', waterDistance: 18 });
    assert.equal(water.stopped, false);
    assert.equal(water.disconnected, false);
    const gain = water.links[0] as Gain;

    assert.deepEqual(gain.gain.ramps, [{ value: 0, time: 0.12 }]);
    a.environment({ habitat: 'wetland', waterDistance: 100 });
    assert.equal(gain.gain.ramps.length, 1);
    c.currentTime = 0.12;
    await new Promise((r) => setTimeout(r, 180));
    assert.equal(water.stopped, true);
    assert.equal(water.disconnected, true);
    a.dispose();
});

test('pause discards compressor look-ahead without replacing context or ceiling', async () => {
    const a = setup();

    await a.unlock();
    const c = Context.instances[0],
        first = c.compressors[0];

    a.pause(true);
    assert.equal(first.disconnected, true);
    assert.equal(c.compressors.length, 2);
    assert.equal(c.shapers.length, 1);
    assert.ok(
        c.gains.slice(1, 4).every((g) => g.links.at(-1) === c.compressors[1]),
    );
    a.pause(false);
    await settle();
    assert.equal(c.compressors.length, 2);
    assert.equal(Context.instances.length, 1);
    a.dispose();
});

test('water reentry cancels release on the same voice; pause cancels pending cleanup', async () => {
    const a = setup();

    a.environment({ habitat: 'wetland', waterDistance: 0 });
    await a.unlock();
    await settle();
    const c = Context.instances[0];
    const water = c.sources.find((s) => s.buffer?.label.endsWith('water.wav'))!;

    a.environment({ habitat: 'wetland', waterDistance: 18 });
    a.environment({ habitat: 'wetland', waterDistance: 1 });
    await new Promise((r) => setTimeout(r, 180));
    assert.equal(water.stopped, false);
    assert.equal(
        c.sources.filter((s) => s.buffer?.label.endsWith('water.wav')).length,
        1,
    );
    a.environment({ habitat: 'wetland', waterDistance: 18 });
    a.pause(true);
    assert.ok(c.sources.every((s) => s.stopped));
    a.pause(false);
    a.environment({ habitat: 'wetland', waterDistance: 0 });
    await settle();
    await new Promise((r) => setTimeout(r, 180));
    assert.equal(c.sources.filter((s) => s.loop && !s.stopped).length, 2);
    a.dispose();
});
test('duplicate IDs load and play once; tin differs from shutter and wood', async () => {
    const a = setup();

    await a.unlock();
    a.cue(cue('tin'));
    a.cue(cue('tin'));
    a.cue(cue('wood', 'impact', { material: 'wood' }));
    a.cue(cue('camera', 'shutter'));
    await settle();
    const labels = effects().map((s) => s.buffer?.label);

    assert.equal(labels.length, 3);
    assert.equal(new Set(labels).size, 3);
    assert.equal(requests.filter((p) => p.endsWith('metalPot1.ogg')).length, 1);
    a.dispose();
});
test('surface steps have different palettes and never immediately repeat', async () => {
    const a = setup();

    await a.unlock();
    for (const material of ['trail', 'wood', 'wet'])
        for (let index = 0; index < 3; index++)
            a.cue(cue(`${material}${index}`, 'footstep', { material }));
    await settle();
    const labels = effects().map((s) => s.buffer!.label);

    assert.equal(labels.length, 9);
    assert.equal(new Set(labels).size, 9);
    a.dispose();
});
test('positional effects use one finite native attenuation and listener camera pose', async () => {
    const a = setup();

    await a.unlock();
    a.listener([5, 2, 3], [1, 0, 0]);
    a.cue(cue('near', 'whistle', { position: [10, 2, 3] }));
    a.cue(cue('far', 'whistle', { position: [100, 2, 3] }));
    await settle();
    const c = Context.instances[0];

    assert.equal(effects().length, 1);
    const p = c.panners[0];

    assert.equal(p.distanceModel, 'linear');
    assert.equal(p.rolloffFactor, 1);
    assert.ok(p.maxDistance <= 40);
    assert.equal(p.positionX.value, 10);
    assert.equal(c.listener.positionX.value, 5);
    assert.equal(c.listener.forwardX.value, 1);
    assert.ok(effects()[0].links[0] instanceof Panner);
    a.dispose();
});
test('effects cap includes loading reservations; ended voices free capacity', async () => {
    const a = setup();

    await a.unlock();
    for (let index = 0; index < 30; index++)
        a.cue(cue(`event${index}`, 'whistle'));
    await settle();
    assert.equal(effects().length, 12);
    effects()[0].stop();
    a.cue(cue('replacement', 'whistle'));
    await settle();
    assert.equal(effects().length, 12);
    a.dispose();
});
test('pause drops missed IDs, stops sources, resumes one set of at most two beds', async () => {
    const a = setup();

    a.environment({ habitat: 'wetland', waterDistance: 2 });
    await a.unlock();
    await settle();
    a.cue(cue('played'));
    await settle();
    a.pause(true);
    a.cue(cue('missed'));
    a.pause(false);
    a.pause(false);
    await settle();
    a.cue(cue('played'));
    a.cue(cue('missed'));
    await settle();
    assert.equal(effects().length, 0);
    const beds = Context.instances[0].sources.filter((s) => s.loop && !s.stopped);

    assert.equal(beds.length, 2);
    a.dispose();
    assert.ok(beds.every((s) => s.stopped));
});
test('late loads cannot play after pause or dispose', async () => {
    const a = setup();

    await a.unlock();
    a.cue(cue('pending'));
    a.pause(true);
    await settle();
    assert.equal(effects().length, 0);
    a.pause(false);
    a.cue(cue('disposing'));
    a.dispose();
    await settle();
    assert.equal(effects().length, 0);
});
test('unsupported audio, rejected autoplay and failed assets never reject gameplay calls', async () => {
    const a = setup();

    Reflect.deleteProperty(globalThis, 'AudioContext');
    await assert.doesNotReject(a.unlock());
    a.dispose();
    const b = setup();

    Context.failResume = true;
    // eslint-disable-next-line unicorn/no-top-level-assignment-in-function -- The test owns this resettable fetch fixture and restores it after each case.
    isFailFetch = true;
    await assert.doesNotReject(b.unlock());
    Context.failResume = false;
    await b.unlock();
    b.cue(cue('offline'));
    await settle();
    assert.equal(effects().length, 0);
    b.dispose();
});
test('invalid positions and unsupported cues allocate no voices', async () => {
    const a = setup();

    await a.unlock();
    a.cue(cue('bad', 'rattle', { position: [NaN, 0, 0] }));
    a.cue(cue('unknown', 'not-a-sound'));
    await settle();
    assert.equal(effects().length, 0);
    a.dispose();
});
test('real species/action cues are distinct from generic decorative birds', async () => {
    const a = setup();

    await a.unlock();
    for (const species of ['owl', 'woodpecker', 'beaver', 'otter'])
        a.cue(cue(species, 'wildlife', { species }));
    await settle();
    const labels = effects().map((s) => s.buffer!.label);

    assert.equal(new Set(labels).size, 4);
    assert.ok(labels.every((x) => !x.includes('forest')));
    a.dispose();
});
test('leaving water or disabling music while loading cannot start an obsolete loop', async () => {
    const a = setup();

    a.environment({ habitat: 'wetland', waterDistance: 1 });
    a.settings({ master: 1, effects: 1, ambience: 1, music: 0.2 });
    await a.unlock();
    a.environment({ habitat: 'woodland', waterDistance: 100 });
    a.settings({ master: 1, effects: 1, ambience: 1, music: 0 });
    await settle();
    const loops = Context.instances[0].sources.filter(
        (s) => s.loop && !s.stopped,
    );

    assert.equal(loops.length, 1);
    assert.ok(loops[0].buffer!.label.endsWith('forest.wav'));
    a.dispose();
});
test('latest water distance applies when an asynchronous bed finishes loading', async () => {
    const a = setup();

    a.environment({ habitat: 'wetland', waterDistance: 2 });
    await a.unlock();
    a.environment({ habitat: 'wetland', waterDistance: 17 });
    await settle();
    const water = Context.instances[0].sources.find((s) => s.buffer?.label.endsWith('water.wav'),
    )!;

    assert.ok(Math.abs((water.links[0] as Gain).gain.value - 1 / 18) < 1e-9);
    a.dispose();
});
test('hidden document drops effects and restores only one loop set', async () => {
    const document = Object.assign(new EventTarget(), { hidden: false });
    const original = Object.getOwnPropertyDescriptor(globalThis, 'document');

    Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: document,
    });
    try {
        const a = setup();

        await a.unlock();
        await settle();
        document.hidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
        a.cue(cue('hidden'));
        a.pause(false);
        await settle();
        assert.equal(Context.instances[0].state, 'suspended');
        document.hidden = false;
        document.dispatchEvent(new Event('visibilitychange'));
        await settle();
        a.cue(cue('hidden'));
        assert.equal(effects().length, 0);
        assert.equal(
            Context.instances[0].sources.filter((s) => s.loop && !s.stopped).length,
            1,
        );
        a.dispose();
        document.dispatchEvent(new Event('visibilitychange'));
        await settle();
        assert.equal(Context.instances[0].state, 'closed');
    } finally {
        if (original) Object.defineProperty(globalThis, 'document', original);
        else Reflect.deleteProperty(globalThis, 'document');
    }
});
test('decode and HTTP failures stay silent without endless retries', async () => {
    for (const failure of ['decode', 'http']) {
        const a = setup();

        if (failure === 'decode') Context.failDecode = true;
        else
        // eslint-disable-next-line unicorn/no-global-object-property-assignment -- The test owns this resettable fetch fixture and restores it after each case.
            globalThis.fetch = async () => new Response('missing', { status: 404 });
        await a.unlock();
        a.cue(cue('bad-asset'));
        await settle();
        await a.unlock();
        await settle();
        assert.equal(effects().length, 0);
        assert.equal(Context.instances[0].sources.length, 0);
        a.dispose();
    }
});
test('delivered palette matches source licenses and hashes; original PCM has no clipped samples', () => {
    const manifest = JSON.parse(
        readFileSync(
            new URL('../../public/audio/manifest.json', import.meta.url),
            'utf8',
        ),
    );

    assert.equal(
        new Set(manifest.assets.map((a: { id: string }) => a.id)).size,
        manifest.assets.length,
    );
    let decoded = 0;

    for (const asset of manifest.assets) {
        assert.ok(['CC0-1.0', 'original-project-material'].includes(asset.license));
        assert.match(asset.listening, /not auditioned/);
        const bytes = readFileSync(
            new URL(`../../public${asset.url}`, import.meta.url),
        );

        assert.equal(bytes.length, asset.bytes);
        assert.equal(
            createHash('sha256').update(bytes).digest('hex'),
            asset.sha256,
        );
        if (asset.url.endsWith('.wav')) {
            assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
            assert.equal(bytes.readUInt32LE(24), 22_050);
            assert.equal(bytes.readUInt32LE(40), bytes.length - 44);
            const frames = (bytes.length - 44) / 2;

            assert.equal(frames / 22_050, asset.duration);
            decoded += frames * 4;
            let peak = 0;

            for (let index = 44; index < bytes.length; index += 2)
                peak = Math.max(peak, Math.abs(bytes.readInt16LE(index)));
            assert.ok(peak > 0 && peak < 32_767);
            if (asset.loopEnd) {
                assert.equal(bytes.readInt16LE(44), 0);
                assert.ok(Math.abs(bytes.readInt16LE(bytes.length - 2)) < 100);
            }
            const sourceBytes = readFileSync(new URL(`../../${asset.source}`, import.meta.url));

            assert.equal(
                createHash('sha256')
                    .update(
                        sourceBytes,
                    )
                    .digest('hex'),
                asset.sourceSha256,
            );
        } else {
            assert.equal(bytes.toString('ascii', 0, 4), 'OggS');
            assert.equal(asset.sourceSha256, asset.sha256);
            assert.match(asset.downloadUrl, /^https:\/\/kenney.nl\//);
        }
    }
    assert.ok(decoded < 32 * 1024 * 1024);
});
