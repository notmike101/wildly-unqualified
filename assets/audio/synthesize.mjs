// Original deterministic sound designs for Wildly Unqualified, 2026-09-06.
// No recordings, borrowed melodies, model output, or external libraries.
// Run from the worktree: node assets/audio/synthesize.mjs
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const out = fileURLToPath(new URL("../../public/audio/", import.meta.url));
mkdirSync(out, { recursive: true });
const rate = 22050,
  tau = Math.PI * 2;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
let seed = 0x197501;
function noise() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return (seed >>> 0) / 0x80000000 - 1;
}
function wav(samples) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++)
    b.writeInt16LE(
      Math.round(Math.max(-0.9, Math.min(0.9, samples[i])) * 32767),
      44 + i * 2,
    );
  return b;
}
const assets = [];
const sourceSha256 = sha(readFileSync(fileURLToPath(import.meta.url)));
function make(id, seconds, sample, loop = false) {
  seed = 0x197501 + assets.length;
  const data = new Float32Array(Math.round(seconds * rate));
  for (let i = 0; i < data.length; i++) {
    const t = i / rate;
    // Edge envelope avoids discontinuities, including generated loop joins.
    const edge = Math.min(1, t / 0.025, (seconds - t) / 0.025);
    data[i] = sample(t) * Math.max(0, edge);
  }
  const bytes = wav(data);
  writeFileSync(out + id + ".wav", bytes);
  assets.push({
    id,
    url: `/audio/${id}.wav`,
    creator: "Wildly Unqualified project — original code synthesis",
    license: "original-project-material",
    source: "assets/audio/synthesize.mjs",
    sourceSha256,
    sha256: sha(bytes),
    bytes: bytes.length,
    duration: data.length / rate,
    loopStart: 0,
    loopEnd: loop ? data.length / rate : 0,
    edits:
      "Deterministic mono 22050 Hz PCM16; 25 ms endpoint envelope; no external samples",
    listening: "not auditioned; Task 7 required",
  });
}
function hit(t, hz = 180, decay = 25) {
  return Math.exp(-t * decay) * (0.6 * Math.sin(t * tau * hz) + 0.25 * noise());
}
function pulse(t, at, duration, hz, amount = 0.3) {
  const u = t - at;
  return u >= 0 && u < duration
    ? Math.sin((Math.PI * u) / duration) ** 2 *
        Math.sin(tau * (hz * u + 30 * u * u)) *
        amount
    : 0;
}
make(
  "shutter",
  0.22,
  (t) =>
    hit(t, 650, 85) * 0.7 + (t > 0.065 ? hit(t - 0.065, 370, 95) * 0.45 : 0),
);
make(
  "whistle",
  0.8,
  (t) =>
    Math.sin((Math.PI * t) / 0.8) ** 2 *
    (Math.sin(tau * (1150 * t + 120 * t * t)) * 0.3 + noise() * 0.025),
);
make("notice", 0.7, (t) => pulse(t, 0, 0.22, 523) + pulse(t, 0.25, 0.35, 659));
make("impact", 0.3, (t) => hit(t, 120, 28) * 0.65);
make("wood", 0.32, (t) => hit(t, 240, 35) * 0.6 + hit(t, 470, 70) * 0.12);
for (let v = 0; v < 3; v++) {
  make(
    `step-wood-${v}`,
    0.3,
    (t) =>
      hit(t, 120 + v * 17, 30) * 0.45 +
      (t > 0.065 ? hit(t - 0.065, 260 + v * 20, 60) * 0.2 : 0),
  );
  make(
    `step-wet-${v}`,
    0.4,
    (t) =>
      noise() * 0.32 * Math.exp(-t * (13 + v)) +
      Math.sin(tau * (320 * t - 180 * t * t)) * 0.15 * Math.exp(-t * 16),
  );
}
make(
  "rustle",
  0.7,
  (t) =>
    noise() *
    0.26 *
    Math.sin((Math.PI * t) / 0.7) ** 2 *
    (0.5 + 0.5 * Math.sin(t * 53) ** 2),
);
make(
  "splash",
  0.65,
  (t) =>
    noise() * 0.35 * Math.exp(-t * 6) +
    Math.sin(tau * (800 * t - 350 * t * t)) * 0.08 * Math.exp(-t * 7),
);
make("tap", 0.65, (t) =>
  [0, 0.08, 0.15, 0.21, 0.26, 0.31].reduce(
    (s, at) => s + (t >= at ? hit(t - at, 730, 100) * 0.45 : 0),
    0,
  ),
);
make(
  "gnaw",
  0.8,
  (t) =>
    noise() *
    0.22 *
    Math.sin((Math.PI * t) / 0.8) ** 2 *
    (Math.sin(t * 65) > 0 ? 1 : 0.08),
);
const styles = {
  raccoon: [460, 820],
  deer: [170, 250],
  heron: [580, 390],
  fox: [900, 650],
  rabbit: [220, 330],
  squirrel: [1800, 2300],
  beaver: [320, 460],
  otter: [1300, 1650],
  badger: [150, 110],
  owl: [420, 360],
  woodpecker: [720, 720],
  mallard: [630, 470],
};
for (const [species, [a, b]] of Object.entries(styles))
  make(`wildlife-${species}`, 1.2, (t) => {
    if (species === "woodpecker")
      return [0, 0.07, 0.13, 0.18, 0.23, 0.28, 0.33].reduce(
        (s, at) => s + (t >= at ? hit(t - at, 720, 100) * 0.4 : 0),
        0,
      );
    if (species === "beaver")
      return (
        noise() *
        0.2 *
        Math.sin((Math.PI * t) / 1.2) ** 2 *
        (Math.sin(t * 61) > 0 ? 1 : 0.03)
      );
    if (species === "rabbit" || species === "squirrel")
      return (
        noise() * 0.12 * Math.sin((Math.PI * t) / 1.2) ** 2 +
        pulse(t, 0.15, 0.14, a, 0.16) +
        pulse(t, 0.45, 0.12, b, 0.12)
      );
    const rough =
      species === "heron" || species === "badger" || species === "mallard";
    return (
      pulse(t, 0.03, 0.4, a, 0.3) +
      pulse(t, 0.55, 0.5, b, 0.24) +
      (rough ? noise() * 0.09 * Math.sin((Math.PI * t) / 1.2) ** 2 : 0)
    );
  });
let wind = 0;
make(
  "forest",
  16,
  (t) => {
    wind = wind * 0.985 + noise() * 0.015;
    // Soft low-pass canopy noise and sparse invented bird accents, no species claim.
    return (
      wind * 0.8 * (0.65 + 0.2 * Math.sin((t * tau) / 16)) +
      pulse(t, 3, 0.18, 2700, 0.055) +
      pulse(t, 3.3, 0.24, 3300, 0.04) +
      pulse(t, 11.1, 0.25, 2300, 0.04)
    );
  },
  true,
);
let water = 0;
make(
  "water",
  12,
  (t) => {
    water = water * 0.65 + noise() * 0.35;
    return water * 0.15 + Math.sin(tau * (600 * t + Math.sin(t * 5))) * 0.008;
  },
  true,
);
const notes = [
  [1, 146.832],
  [4, 220],
  [7, 261.626],
  [11, 329.628],
  [16, 293.665],
  [28, 174.614],
  [31, 220],
  [35, 261.626],
  [40, 293.665],
];
make(
  "music",
  48,
  (t) =>
    notes.reduce((s, [at, hz]) => {
      const u = t - at;
      return (
        s +
        (u >= 0 && u < 4
          ? Math.sin((Math.min(1, u / 0.12) * Math.PI) / 2) *
            Math.exp(-u * 1.15) *
            (Math.sin(tau * hz * u) + 0.2 * Math.sin(tau * hz * 2 * u)) *
            0.12
          : 0)
      );
    }, 0),
  true,
);
for (const id of [
  "footstep00",
  "footstep01",
  "footstep02",
  "metalPot1",
  "metalPot2",
  "metalPot3",
]) {
  const bytes = readFileSync(out + id + ".ogg");
  assets.push({
    id,
    url: `/audio/${id}.ogg`,
    creator: "Kenney Vleugels",
    title: "RPG Audio",
    license: "CC0-1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    source: "https://kenney.nl/assets/rpg-audio",
    downloadUrl:
      "https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip",
    archivePath: `Audio/${id}.ogg`,
    archiveSha256:
      "6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b",
    sourceSha256: sha(bytes),
    sha256: sha(bytes),
    bytes: bytes.length,
    loopStart: 0,
    loopEnd: 0,
    edits: "None; original selected archive member",
    listening: "not auditioned; Task 7 required",
  });
}
writeFileSync(
  out + "manifest.json",
  JSON.stringify(
    {
      version: 1,
      acquired: "2026-09-06",
      listening:
        "Pending Task 7 visible client and actual listening; technical checks are not audition",
      assets,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Generated ${assets.length} assets, ${assets.reduce((n, a) => n + a.bytes, 0)} delivery bytes.`,
);
