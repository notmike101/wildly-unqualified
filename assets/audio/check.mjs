// Technical inspection only: this does not decode Vorbis or listen to any file.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = new URL("../../public/audio/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("manifest.json", base), "utf8"),
);
let secondsChannels = 0,
  bytes = 0;
const results = [];
for (const asset of manifest.assets) {
  const b = readFileSync(new URL(asset.url.split("/").at(-1), base));
  assert.equal(createHash("sha256").update(b).digest("hex"), asset.sha256);
  let frames, rate, channels;
  if (asset.url.endsWith(".wav")) {
    channels = b.readUInt16LE(22);
    rate = b.readUInt32LE(24);
    frames = b.readUInt32LE(40) / (channels * 2);
  } else {
    const header = b.indexOf(Buffer.from([1, 118, 111, 114, 98, 105, 115]));
    assert.ok(header >= 0);
    channels = b[header + 11];
    rate = b.readUInt32LE(header + 12);
    let offset = 0,
      last = 0n;
    while (offset < b.length) {
      assert.equal(b.toString("ascii", offset, offset + 4), "OggS");
      const granule = b.readBigUInt64LE(offset + 6);
      if (granule !== 0xffffffffffffffffn) last = granule;
      const segments = b[offset + 26];
      let size = 0;
      for (let i = 0; i < segments; i++) size += b[offset + 27 + i];
      offset += 27 + segments + size;
    }
    assert.equal(offset, b.length);
    frames = Number(last);
  }
  assert.ok(frames > 0 && rate > 0 && channels > 0 && channels <= 2);
  const duration = frames / rate;
  secondsChannels += duration * channels;
  bytes += b.length;
  results.push({ id: asset.id, bytes: b.length, duration, rate, channels });
}
console.log(
  JSON.stringify(
    {
      status:
        "hash and container/PCM inspection PASS; Vorbis decode and all listening pending",
      files: results.length,
      deliveryBytes: bytes,
      estimatedDecodedFloat32BytesAt48000: Math.ceil(
        secondsChannels * 48000 * 4,
      ),
      estimatedDecodedFloat32BytesAt44100: Math.ceil(
        secondsChannels * 44100 * 4,
      ),
      runtimeCacheLimitBytes: 32 * 1024 * 1024,
      results,
    },
    null,
    2,
  ),
);
