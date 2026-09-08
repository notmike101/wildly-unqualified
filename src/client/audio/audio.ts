import manifest from '../../../public/audio/manifest.json' with { type: 'json' };

export type AudioSettings = {
    master: number;
    effects: number;
    ambience: number;
    music: number;
};
export type AudioCue = {
    id: string;
    kind: string;
    position: [number, number, number];
    species?: string;
    material?: string;
};
type Point = [number, number, number];
type Environment = {
    habitat: 'woodland' | 'clearing' | 'wetland';
    waterDistance: number;
};
type Voice = {
    source?: AudioBufferSourceNode;
    nodes: AudioNode[];
    ended?: () => void;
    release?: { at: number; timer: ReturnType<typeof setTimeout> };
};
const assets = new Map(manifest.assets.map((a) => [a.id, a]));

/**
 * Normalize a volume setting to the inclusive 0–1 range, treating nonfinite input as
 * silence.
 *
 * @param n - Requested gain
 * @returns A finite gain between 0 and 1.
 */
const clamp = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/**
 * Check that an audio position contains exactly three finite components.
 *
 * @param p - Candidate position or direction
 * @returns Whether the point is safe to pass to Web Audio.
 */
const point = (p: Point) => p.length === 3 && p.every((element) => Number.isFinite(element));

/**
 * Measure three-dimensional distance for audio culling.
 *
 * @param a - Listener position
 * @param b - Sound position
 * @returns Distance in world metres.
 */
const distance = (a: Point, b: Point) => Math.hypot(...a.map((v, index) => v - b[index]));

/**
 * Create an isolated audio owner with bounded buffers and voices. AudioContext creation
 * waits for unlock; callers must dispose the owner when finished. Cue IDs are deduplicated
 * even when playback is unavailable.
 *
 * @returns Controls for settings, listener, environment, cues, pause, unlock, and disposal.
 */
export function createAudio() {
    let context: AudioContext | undefined,
        buses: GainNode[] = [];
    let compressor: DynamicsCompressorNode | undefined,
        ceiling: WaveShaperNode | undefined;
    let levels: AudioSettings = {
        master: 0.7,
        effects: 0.8,
        ambience: 0.35,
        music: 0,
    };
    let location: Point = [0, 0, 0],
        forward: Point = [0, 0, -1];
    let environment: Environment = { habitat: 'woodland', waterDistance: Infinity };
    let isPaused = false,
        isDisposed = false,
        epoch = 0,
        decodedBytes = 0;
    const documentOwner = typeof document === 'undefined' ? undefined : document;

    /**
     * Check disposal, pause, page visibility, and the audio context's running state.
     *
     * @returns Whether playback may start now.
     */
    const isActive = () => !isDisposed
        && !isPaused
        && !documentOwner?.hidden
        && context?.state === 'running';
    const abort = new AbortController();
    const buffers = new Map<string, Promise<AudioBuffer | undefined>>();
    const effects = new Set<Voice>(),
        beds = new Map<string, Voice>();
    const seen = new Set<string>(),
        variants = new Map<string, number>();
    let music: Voice | undefined;

    /**
     * Cancel a voice's release timer, stop its source, disconnect its nodes, and remove it from
     * the effects set. Already-ended sources are tolerated.
     *
     * @param v - Voice owned by this audio instance
     */
    function stop(v: Voice) {
        clearTimeout(v.release?.timer);
        v.release = undefined;
        if (v.source) {
            if (v.ended) v.source.removeEventListener('ended', v.ended);
            try {
                v.source.stop();
            } catch {
                /*
                Already ended.
                */
            }
        }
        for (const node of v.nodes) node.disconnect();
        effects.delete(v);
    }

    /**
     * Invalidate pending playback, stop every voice and bed, and reset compressor history.
     */
    function stopAll() {
        epoch++;
        for (const v of effects) stop(v);
        for (const v of beds.values()) stop(v);
        beds.clear();
        if (music) stop(music);
        music = undefined;

        // A suspended compressor otherwise retains a few milliseconds of old audio.

        if (ceiling && !isDisposed) resetCompressor();
    }

    /**
     * Replace the compressor and reconnect audio buses so old compression state cannot leak
     * across a stop. Requires an initialized context and ceiling node.
     */
    function resetCompressor() {
        compressor?.disconnect();
        compressor = context!.createDynamicsCompressor();
        compressor.threshold.value = -6;
        compressor.knee.value = 6;
        compressor.ratio.value = 20;
        compressor.attack.value = 0;
        compressor.release.value = 0.15;
        for (const bus of buses.slice(1)) {
            bus.disconnect();
            bus.connect(compressor!);
        }
        compressor.connect(ceiling!);
    }

    /**
     * Fetch and decode a manifest asset once per owner. Enforces encoded and aggregate decoded
     * byte limits; failed loads are cached as undefined. Disposal aborts outstanding fetches.
     *
     * @param id - Manifest audio asset ID
     * @returns Decoded buffer, or undefined for unavailable, failed, or over-budget audio.
     */
    function load(id: string): Promise<AudioBuffer | undefined> {
        const existing = buffers.get(id);

        if (existing) return existing;
        const asset = assets.get(id),
            context_ = context;

        if (!asset || !context_ || isDisposed) return Promise.resolve(undefined);
        const pending = (async () => {
            try {
                const response = await fetch(asset.url, { signal: abort.signal });

                if (!response.ok) return;
                const bytes = await response.arrayBuffer();

                if (isDisposed || bytes.byteLength > 5 * 1024 * 1024) return;
                const decoded = await context_.decodeAudioData(bytes);
                const size = decoded.length * decoded.numberOfChannels * 4;

                if (
                    isDisposed
                    || !Number.isFinite(size)
                    || decodedBytes + size > 32 * 1024 * 1024
                )
                    return;
                decodedBytes += size;

                return decoded;
            } catch {
                return;
            }
        })();

        buffers.set(id, pending);

        return pending;
    }

    /**
     * Replace scheduled gain automation with a smooth approach from the held current value.
     * Requires an initialized context.
     *
     * @param parameter - Audio parameter to automate
     * @param value - Target gain
     * @param seconds - Smoothing time constant in seconds, default 0.12
     */
    function ramp(parameter: AudioParam, value: number, seconds = 0.12) {
        if (!context) return;
        parameter.cancelAndHoldAtTime(context.currentTime);
        parameter.setTargetAtTime(value, context.currentTime, seconds);
    }

    /**
     * Fade a water bed to silence once, then release it when the audio clock reaches the fade
     * endpoint.
     *
     * @param id - Bed asset ID
     * @param v - Water voice to fade
     */
    function releaseWater(id: string, v: Voice) {
        if (v.release) return;
        const at = context!.currentTime + 0.12;
        const gain = (v.nodes[1] as GainNode).gain;
        const value = gain.value;

        gain.cancelAndHoldAtTime(context!.currentTime);
        gain.setValueAtTime(value, context!.currentTime);
        gain.linearRampToValueAtTime(0, at);

        /**
         * Recheck the audio clock before stopping the fading water voice; reschedule if a
         * wall-clock timer fires too early.
         */
        const finish = () => {
            if (beds.get(id) !== v || !v.release) return;

            // Audio time can lag a timer (or be interrupted); never cut the ramp early.

            if (context!.currentTime < at) {
                v.release.timer = setTimeout(finish, 20);

                return;
            }
            stop(v);
            beds.delete(id);
        };

        v.release = { at, timer: setTimeout(finish, 140) };
    }

    /**
     * Copy the stored listener position, normalized forward direction, and world up axis into
     * Web Audio. Does nothing before initialization.
     */
    function updateListener() {
        if (!context) return;
        const l = context.listener,
            now = context.currentTime;

        for (const [index, p] of [l.positionX, l.positionY, l.positionZ].entries()) p.setValueAtTime(location[index], now)
        ;
        for (const [index, p] of [l.forwardX, l.forwardY, l.forwardZ].entries()) p.setValueAtTime(forward[index], now)
        ;
        l.upX.setValueAtTime(0, now);
        l.upY.setValueAtTime(1, now);
        l.upZ.setValueAtTime(0, now);
    }

    /**
     * Load and start a looping bed with a fade-in. Discards completion after ownership or
     * playback generation changes and resynchronizes gain after loading.
     *
     * @param id - Manifest asset ID
     * @param bus - Destination audio bus
     * @param gain - Initial target gain
     * @param voice - Voice slot reserved for this loop
     */
    function loop(id: string, bus: GainNode, gain: number, voice: Voice) {
        const generation = epoch;

        void load(id).then((buffer) => {
            if (
                !buffer
                || generation !== epoch
                || !isActive()
                || (music !== voice && beds.get(id) !== voice)
            )
                return;
            try {
                const source = context!.createBufferSource(),
                    volume = context!.createGain();

                voice.source = source;
                voice.nodes.push(source, volume);
                source.buffer = buffer;
                source.loop = true;
                const asset = assets.get(id)!;

                source.loopStart = asset.loopStart;
                source.loopEnd = asset.loopEnd;
                volume.gain.setValueAtTime(0, context!.currentTime);
                ramp(volume.gain, gain, 0.8);
                source.connect(volume).connect(bus);
                source.start();

                // The habitat/distance may have changed while this buffer was loading.

                syncBeds();
            } catch {
                stop(voice);
            }
        });
    }

    /**
     * Reconcile forest, water, and music loops with current settings and habitat. Fades water
     * with distance and cancels a pending release if water becomes audible again.
     */
    function syncBeds() {
        if (!isActive()) return;
        const water = Number.isFinite(environment.waterDistance)
            ? Math.max(0, 1 - Math.max(0, environment.waterDistance) / 18)
            : 0;
        const desired = new Map<string, number>();

        if (levels.ambience > 0) {
            desired.set('forest', environment.habitat === 'clearing' ? 0.65 : 1);
            if (water > 0) desired.set('water', water);
        }
        for (const [id, v] of beds)
            if (!desired.has(id)) {
                if (id === 'water' && v.source) releaseWater(id, v);
                else {
                    stop(v);
                    beds.delete(id);
                }
            }
        for (const [id, gain] of desired) {
            const v = beds.get(id);

            if (v) {
                clearTimeout(v.release?.timer);
                v.release = undefined;
                const volume = v.nodes[1] as GainNode | undefined;

                if (volume) ramp(volume.gain, gain, 0.8);
            } else {
                const next: Voice = { nodes: [] };

                beds.set(id, next);
                loop(id, buses[2], gain, next);
            }
        }
        if (!music && levels.music > 0) {
            music = { nodes: [] };
            loop('music', buses[3], 1, music);
        } else if (music && levels.music === 0) {
            stop(music);
            music = undefined;
        }
    }

    /**
     * Apply bus settings, using exact zero for master mute, then reconcile ambience and music.
     */
    function applyLevels() {
        if (!context) return;
        for (const [index, v] of [levels.master, levels.effects, levels.ambience, levels.music].entries()) {
        // Exact master zero makes mute absolute instead of an asymptotic fade.

            if (index === 0 && v === 0) {
                buses[index].gain.cancelScheduledValues(context!.currentTime);
                buses[index].gain.setValueAtTime(0, context!.currentTime);
            } else ramp(buses[index].gain, v);
        }

        syncBeds();
    }

    /**
     * Attempt to resume audio only when visible and unpaused. Rejected autoplay is tolerated so
     * a later gesture can retry.
     */
    async function resume() {
        if (!context || isDisposed || isPaused || documentOwner?.hidden) return;
        const generation = epoch;

        try {
            await context.resume();
            if (epoch === generation && isActive()) {
                updateListener();
                syncBeds();
            }
        } catch {
            /*
            Captions still work; next gesture can retry.
            */
        }
    }

    /**
     * Stop and suspend playback while hidden or paused; otherwise attempt to resume without
     * replaying historical cues.
     */
    function visibility() {
        if (isPaused || documentOwner?.hidden) {
            stopAll();
            if (context && !isDisposed) void context.suspend().catch(() => {});
        } else void resume();
    }
    documentOwner?.addEventListener('visibilitychange', visibility);

    /**
     * Advance a per-key round-robin cursor through an asset palette.
     *
     * @param key - Variation group key
     * @param palette - Ordered, nonempty asset palette
     * @returns The next asset ID; callers must supply a nonempty palette.
     */
    function variant(key: string, palette: string[]) {
        const index = ((variants.get(key) ?? -1) + 1) % palette.length;

        variants.set(key, index);

        return palette[index];
    }

    /**
     * Map cue kind, material, and species to an asset, advancing variation cursors where
     * applicable.
     *
     * @param c - Incoming audio cue
     * @returns Selected asset ID, or undefined for an unsupported cue/species.
     */
    function select(c: AudioCue): string | undefined {
        switch (c.kind) {
            case 'shutter':
            case 'whistle':
            case 'notice':
            case 'rustle':
            case 'splash':
            case 'tap':
            case 'gnaw': {
                return c.kind;
            }
            case 'rattle': {
                return variant('tin', ['metalPot1', 'metalPot2', 'metalPot3']);
            }
            case 'impact': {
                return c.material === 'wood'
                    ? 'wood'
                    : (c.material === 'metal' || c.material === 'tin'
                            ? variant('tin', ['metalPot1', 'metalPot2', 'metalPot3'])
                            : 'impact');
            }
            case 'footstep': {
                const surface
                    = c.material === 'wood'
                        ? 'wood'
                        : (c.material === 'wet' || c.material === 'water'
                                ? 'wet'
                                : 'trail');

                return variant(
                    surface,
                    surface === 'trail'
                        ? ['footstep00', 'footstep01', 'footstep02']
                        : [0, 1, 2].map((index) => `step-${surface}-${index}`),
                );
            }
            case 'alert':
            case 'wildlife':
            case 'action': {
                const id = `wildlife-${c.species}`;

                return assets.has(id) ? id : undefined;
            }
        }
    }

    return {

        /**
         * Lazily initialize the audio graph on a user gesture, warm the bounded asset palette, and
         * attempt playback. Unsupported devices and autoplay failures are intentionally tolerated.
         */
        async unlock() {
            if (isDisposed) return;
            try {
                if (!context) {
                    if (typeof AudioContext === 'undefined') return;
                    context = new AudioContext();
                    buses = [0, 1, 2, 3].map(() => context!.createGain());

                    // Preserve quiet cues; compress overload before a strict
                    // native safety ceiling. Master follows both nodes so mute has no tail.

                    ceiling = context.createWaveShaper();
                    ceiling.curve = Float32Array.from({ length: 2049 }, (_, index) => Math.max(-0.95, Math.min(0.95, index / 1024 - 1)),
                    );
                    resetCompressor();
                    ceiling.connect(buses[0]);
                    buses[0].connect(context.destination);
                    for (const [index, v] of [
                        levels.master,
                        levels.effects,
                        levels.ambience,
                        levels.music,
                    ].entries()) buses[index].gain.setValueAtTime(v, context!.currentTime)
                    ;

                    // Warm the bounded palette once so ordinary cues need no network wait.

                    for (const id of assets.keys()) void load(id);
                }
                await resume();
            } catch {
                /*
                Unsupported device must not stop admission or play.
                */
            }
        },

        /**
         * Clamp and replace volume settings, then apply them to the audio buses. Calls after
         * disposal do nothing.
         *
         * @param value - Master, effects, ambience, and music gains
         */
        settings(value: AudioSettings) {
            if (isDisposed) return;
            levels = {
                master: clamp(value.master),
                effects: clamp(value.effects),
                ambience: clamp(value.ambience),
                music: clamp(value.music),
            };
            applyLevels();
        },

        /**
         * Store a copied position and normalized forward direction, ignoring malformed or near-zero
         * vectors, then update Web Audio.
         *
         * @param position - Listener position in world metres
         * @param direction - Nonzero forward direction
         */
        listener(position: Point, direction: Point) {
            if (
                isDisposed
                || !point(position)
                || !point(direction)
                || Math.hypot(...direction) < 0.001
            )
                return;
            location = [...position];
            const length = Math.hypot(...direction);

            forward = direction.map((n) => n / length) as Point;
            updateListener();
        },

        /**
         * Replace habitat and water-distance inputs and reconcile ambient beds.
         *
         * @param value - Current habitat and nearest-water distance in metres
         */
        environment(value: Environment) {
            if (isDisposed) return;
            environment = { habitat: value.habitat, waterDistance: value.waterDistance };
            syncBeds();
        },

        /**
         * Deduplicate a cue and schedule bounded local or spatial playback. Drops inaudible, muted,
         * stale, or over-capacity effects; successful cues temporarily duck music.
         *
         * @param value - Cue with a stable world-scoped ID and world position
         */
        cue(value: AudioCue) {
            if (isDisposed || !value.id || seen.has(value.id)) return;
            seen.add(value.id);
            if (seen.size > 2048) seen.delete(seen.values().next().value!);
            if (
                !isActive()
                || !point(value.position)
                || !levels.master
                || !levels.effects
                || effects.size >= 12
            )
                return;
            const isLocal = value.kind === 'shutter' || value.kind === 'notice',
                range = value.kind === 'footstep' ? 12 : 32;

            if (!isLocal && distance(location, value.position) >= range) return;
            const id = select(value);

            if (!id) return;
            const v: Voice = { nodes: [] },
                generation = epoch,
                started = performance.now(),
                position = [...value.position] as Point;

            effects.add(v);
            void load(id).then((buffer) => {
                if (
                    !buffer
                    || generation !== epoch
                    || !isActive()
                    || !effects.has(v)
                    || performance.now() - started > 500
                    || (!isLocal && distance(location, position) >= range)
                ) {
                    stop(v);

                    return;
                }
                try {
                    const source = context!.createBufferSource();

                    v.source = source;
                    v.nodes.push(source);
                    source.buffer = buffer;
                    if (isLocal) source.connect(buses[1]);
                    else {
                        const panner = context!.createPanner();

                        v.nodes.push(panner);
                        panner.panningModel = 'HRTF';
                        panner.distanceModel = 'linear';
                        panner.refDistance = 1;
                        panner.maxDistance = range;
                        panner.rolloffFactor = 1;
                        for (const [index, p] of [panner.positionX, panner.positionY, panner.positionZ].entries()) p.setValueAtTime(position[index], context!.currentTime)
                        ;
                        source.connect(panner).connect(buses[1]);
                    }

                    /**
          Release this completed effect's nodes and its bounded voice slot.
                     */
                    v.ended = () => {
                        for (const node of v.nodes) node.disconnect();
                        effects.delete(v);
                    };
                    source.addEventListener('ended', v.ended, { once: true });
                    source.start();
                    if (levels.music > 0) {
                        const now = context!.currentTime,
                            gain = buses[3].gain;

                        gain.cancelScheduledValues(now);
                        gain.setTargetAtTime(levels.music * 0.25, now, 0.08);
                        gain.setTargetAtTime(levels.music, now + 1.5, 0.5);
                    }
                } catch {
                    stop(v);
                }
            });
        },

        /**
         * Change playback pause state and reconcile visibility/suspension. Repeated values and
         * calls after disposal do nothing.
         *
         * @param shouldPause - Whether gameplay audio should be paused
         */
        pause(shouldPause: boolean) {
            if (isDisposed || isPaused === shouldPause) return;
            isPaused = shouldPause;
            visibility();
        },

        /**
         * Idempotently stop voices, abort loads, clear caches/listeners, disconnect nodes, and
         * request context closure.
         */
        dispose() {
            if (isDisposed) return;
            isDisposed = true;
            stopAll();
            abort.abort();
            buffers.clear();
            seen.clear();
            variants.clear();
            documentOwner?.removeEventListener('visibilitychange', visibility);
            for (const bus of buses) bus.disconnect();
            compressor?.disconnect();
            ceiling?.disconnect();
            if (context) void context.close().catch(() => {});
        },
    };
}
