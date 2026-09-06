import manifest from "./public/audio/manifest.json" with { type: "json" };

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
  habitat: "woodland" | "clearing" | "wetland";
  waterDistance: number;
};
type Voice = { source?: AudioBufferSourceNode; nodes: AudioNode[] };
const assets = new Map(manifest.assets.map((a) => [a.id, a]));
const clamp = (n: number) =>
  Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
const point = (p: Point) => p.length === 3 && p.every(Number.isFinite);
const distance = (a: Point, b: Point) =>
  Math.hypot(...a.map((v, i) => v - b[i]));

/** One client-owned instance. Captions remain owned by the caller, even on failure.
 * Cue IDs must be world-scoped and already filtered against historical snapshots.
 * This bounded recent-ID cache supplements that authoritative delivery boundary.
 */
export function createAudio() {
  let context: AudioContext | undefined,
    buses: GainNode[] = [];
  let levels: AudioSettings = {
    master: 0.7,
    effects: 0.8,
    ambience: 0.35,
    music: 0,
  };
  let location: Point = [0, 0, 0],
    forward: Point = [0, 0, -1];
  let env: Environment = { habitat: "woodland", waterDistance: Infinity };
  let paused = false,
    disposed = false,
    epoch = 0,
    decodedBytes = 0;
  const documentOwner = typeof document === "undefined" ? undefined : document;
  const active = () =>
    !disposed &&
    !paused &&
    !documentOwner?.hidden &&
    context?.state === "running";
  const abort = new AbortController();
  const buffers = new Map<string, Promise<AudioBuffer | null>>();
  const effects = new Set<Voice>(),
    beds = new Map<string, Voice>();
  const seen = new Set<string>(),
    variants = new Map<string, number>();
  let music: Voice | undefined;

  function stop(v: Voice) {
    if (v.source) {
      v.source.onended = null;
      try {
        v.source.stop();
      } catch {
        /* Already ended. */
      }
    }
    for (const node of v.nodes) node.disconnect();
    effects.delete(v);
  }
  function stopAll() {
    epoch++;
    for (const v of effects) stop(v);
    for (const v of beds.values()) stop(v);
    beds.clear();
    if (music) stop(music);
    music = undefined;
  }
  function load(id: string): Promise<AudioBuffer | null> {
    const existing = buffers.get(id);
    if (existing) return existing;
    const asset = assets.get(id),
      ctx = context;
    if (!asset || !ctx || disposed) return Promise.resolve(null);
    const pending = (async () => {
      try {
        const response = await fetch(asset.url, { signal: abort.signal });
        if (!response.ok) return null;
        const bytes = await response.arrayBuffer();
        if (disposed || bytes.byteLength > 5 * 1024 * 1024) return null;
        const decoded = await ctx.decodeAudioData(bytes);
        const size = decoded.length * decoded.numberOfChannels * 4;
        if (
          disposed ||
          !Number.isFinite(size) ||
          decodedBytes + size > 32 * 1024 * 1024
        )
          return null;
        decodedBytes += size;
        return decoded;
      } catch {
        return null;
      }
    })();
    buffers.set(id, pending);
    return pending;
  }
  function ramp(param: AudioParam, value: number, seconds = 0.12) {
    if (!context) return;
    param.cancelScheduledValues(context.currentTime);
    param.setTargetAtTime(value, context.currentTime, seconds);
  }
  function updateListener() {
    if (!context) return;
    const l = context.listener,
      now = context.currentTime;
    [l.positionX, l.positionY, l.positionZ].forEach((p, i) =>
      p.setValueAtTime(location[i], now),
    );
    [l.forwardX, l.forwardY, l.forwardZ].forEach((p, i) =>
      p.setValueAtTime(forward[i], now),
    );
    l.upX.setValueAtTime(0, now);
    l.upY.setValueAtTime(1, now);
    l.upZ.setValueAtTime(0, now);
  }
  function loop(id: string, bus: GainNode, gain: number, voice: Voice) {
    const generation = epoch;
    void load(id).then((buffer) => {
      if (
        !buffer ||
        !active() ||
        generation !== epoch ||
        (music !== voice && beds.get(id) !== voice)
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
  function syncBeds() {
    if (!active()) return;
    const water = Number.isFinite(env.waterDistance)
      ? Math.max(0, 1 - Math.max(0, env.waterDistance) / 18)
      : 0;
    const desired = new Map<string, number>();
    if (levels.ambience > 0) {
      desired.set("forest", env.habitat === "clearing" ? 0.65 : 1);
      if (water > 0) desired.set("water", water);
    }
    for (const [id, v] of beds)
      if (!desired.has(id)) {
        stop(v);
        beds.delete(id);
      }
    for (const [id, gain] of desired) {
      const v = beds.get(id);
      if (v) {
        const volume = v.nodes[1] as GainNode | undefined;
        if (volume) ramp(volume.gain, gain, 0.8);
      } else {
        const next: Voice = { nodes: [] };
        beds.set(id, next);
        loop(id, buses[2], gain, next);
      }
    }
    if (levels.music > 0 && !music) {
      music = { nodes: [] };
      loop("music", buses[3], 1, music);
    } else if (levels.music === 0 && music) {
      stop(music);
      music = undefined;
    }
  }
  function applyLevels() {
    if (!context) return;
    [levels.master, levels.effects, levels.ambience, levels.music].forEach(
      (v, i) => {
        // Exact master zero makes mute absolute instead of an asymptotic fade.
        if (i === 0 && v === 0) {
          buses[i].gain.cancelScheduledValues(context!.currentTime);
          buses[i].gain.setValueAtTime(0, context!.currentTime);
        } else ramp(buses[i].gain, v);
      },
    );
    syncBeds();
  }
  async function resume() {
    if (!context || disposed || paused || documentOwner?.hidden) return;
    const generation = epoch;
    try {
      await context.resume();
      if (active() && epoch === generation) {
        updateListener();
        syncBeds();
      }
    } catch {
      /* Captions still work; next gesture can retry. */
    }
  }
  function visibility() {
    if (paused || documentOwner?.hidden) {
      stopAll();
      if (context && !disposed) void context.suspend().catch(() => {});
    } else void resume();
  }
  documentOwner?.addEventListener("visibilitychange", visibility);
  function variant(key: string, palette: string[]) {
    const index = ((variants.get(key) ?? -1) + 1) % palette.length;
    variants.set(key, index);
    return palette[index];
  }
  function select(c: AudioCue): string | undefined {
    switch (c.kind) {
      case "shutter":
      case "whistle":
      case "notice":
      case "rustle":
      case "splash":
      case "tap":
      case "gnaw":
        return c.kind;
      case "rattle":
        return variant("tin", ["metalPot1", "metalPot2", "metalPot3"]);
      case "impact":
        return c.material === "wood"
          ? "wood"
          : c.material === "metal" || c.material === "tin"
            ? variant("tin", ["metalPot1", "metalPot2", "metalPot3"])
            : "impact";
      case "footstep": {
        const surface =
          c.material === "wood"
            ? "wood"
            : c.material === "wet" || c.material === "water"
              ? "wet"
              : "trail";
        return variant(
          surface,
          surface === "trail"
            ? ["footstep00", "footstep01", "footstep02"]
            : [0, 1, 2].map((i) => `step-${surface}-${i}`),
        );
      }
      case "alert":
      case "wildlife":
      case "action": {
        const id = `wildlife-${c.species}`;
        return assets.has(id) ? id : undefined;
      }
    }
  }
  return {
    async unlock() {
      if (disposed) return;
      try {
        if (!context) {
          if (typeof AudioContext === "undefined") return;
          context = new AudioContext();
          buses = [0, 1, 2, 3].map(() => context!.createGain());
          buses[0].connect(context.destination);
          buses.slice(1).forEach((bus) => bus.connect(buses[0]));
          [
            levels.master,
            levels.effects,
            levels.ambience,
            levels.music,
          ].forEach((v, i) =>
            buses[i].gain.setValueAtTime(v, context!.currentTime),
          );
          // Warm the bounded palette once so ordinary cues need no network wait.
          for (const id of assets.keys()) void load(id);
        }
        await resume();
      } catch {
        /* Unsupported device must not stop admission or play. */
      }
    },
    settings(value: AudioSettings) {
      if (disposed) return;
      levels = {
        master: clamp(value.master),
        effects: clamp(value.effects),
        ambience: clamp(value.ambience),
        music: clamp(value.music),
      };
      applyLevels();
    },
    listener(position: Point, direction: Point) {
      if (
        disposed ||
        !point(position) ||
        !point(direction) ||
        Math.hypot(...direction) < 0.001
      )
        return;
      location = [...position];
      const length = Math.hypot(...direction);
      forward = direction.map((n) => n / length) as Point;
      updateListener();
    },
    environment(value: Environment) {
      if (disposed) return;
      env = { habitat: value.habitat, waterDistance: value.waterDistance };
      syncBeds();
    },
    cue(value: AudioCue) {
      if (disposed || !value.id || seen.has(value.id)) return;
      seen.add(value.id);
      if (seen.size > 2048) seen.delete(seen.values().next().value!);
      if (
        !active() ||
        !point(value.position) ||
        !levels.master ||
        !levels.effects ||
        effects.size >= 12
      )
        return;
      const local = value.kind === "shutter" || value.kind === "notice",
        range = value.kind === "footstep" ? 12 : 32;
      if (!local && distance(location, value.position) >= range) return;
      const id = select(value);
      if (!id) return;
      const v: Voice = { nodes: [] },
        generation = epoch,
        started = performance.now(),
        position = [...value.position] as Point;
      effects.add(v);
      void load(id).then((buffer) => {
        if (
          !buffer ||
          !active() ||
          generation !== epoch ||
          !effects.has(v) ||
          performance.now() - started > 500 ||
          (!local && distance(location, position) >= range)
        ) {
          stop(v);
          return;
        }
        try {
          const source = context!.createBufferSource();
          v.source = source;
          v.nodes.push(source);
          source.buffer = buffer;
          if (local) source.connect(buses[1]);
          else {
            const panner = context!.createPanner();
            v.nodes.push(panner);
            panner.panningModel = "HRTF";
            panner.distanceModel = "linear";
            panner.refDistance = 1;
            panner.maxDistance = range;
            panner.rolloffFactor = 1;
            [panner.positionX, panner.positionY, panner.positionZ].forEach(
              (p, i) => p.setValueAtTime(position[i], context!.currentTime),
            );
            source.connect(panner).connect(buses[1]);
          }
          source.onended = () => {
            for (const node of v.nodes) node.disconnect();
            effects.delete(v);
          };
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
    pause(value: boolean) {
      if (disposed || paused === value) return;
      paused = value;
      visibility();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopAll();
      abort.abort();
      buffers.clear();
      seen.clear();
      variants.clear();
      documentOwner?.removeEventListener("visibilitychange", visibility);
      for (const bus of buses) bus.disconnect();
      if (context) void context.close().catch(() => {});
    },
  };
}
