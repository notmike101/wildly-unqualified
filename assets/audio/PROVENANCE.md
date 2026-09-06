# Forest audio provenance

Acquired/authored 2026-09-06. **No file has been auditioned.** Task 7 must listen in the visible production client; PCM/container checks, distinct buffers and successful scheduling are not evidence of recognizability, naturalness, stereo placement, clean joins or comfortable long-session listening. Music is optional and initially off.

The delivery/credits inventory is [public/audio/manifest.json](../../public/audio/manifest.json). Every delivered file has a SHA-256, source identity, creator, license/provenance, editing and loop record. No external service is contacted by gameplay; all sounds are local release assets. No microphone recording, third-party melody or commercial-game soundtrack was used.

## Selected CC0 recordings

- Creator: **Kenney Vleugels (Kenney.nl)**. Pack: **RPG Audio**, released 2014.
- Primary creator page: https://kenney.nl/assets/rpg-audio — retrieved 2026-09-06; explicitly CC0. Saved response: [source/kenney-rpg-page.html](source/kenney-rpg-page.html).
- Exact creator-hosted download: https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip
- Downloaded archive SHA-256: `6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b`, 964,837 bytes.
- Archive entries inspected before extraction; [source/kenney-archive-inventory.txt](source/kenney-archive-inventory.txt) records every entry and uncompressed size. Only `Audio/footstep00.ogg`, `footstep01.ogg`, `footstep02.ogg`, `metalPot1.ogg`, `metalPot2.ogg`, `metalPot3.ogg` and the bundled [license](source/kenney-license.txt) were retained. No unused pack, weapon sounds, preview, URL shortcuts or ZIP are delivered/tracked.
- License: **CC0-1.0**, https://creativecommons.org/publicdomain/zero/1.0/. Creator's bundled license explicitly permits personal/commercial projects and makes attribution optional. Suggested voluntary credit: “RPG Audio by Kenney (kenney.nl), CC0.”
- Delivered selected files are byte-identical archive members: source and delivery hashes agree. No trim, re-encode, normalization, loop or other edit. These are provisional trail steps and metal-pot/tin handling selections based on source naming; actual surface fit and tin recognizability require audition. We do not claim a recording of this game's specific equipment.

## Original synthesis

[synthesize.mjs](synthesize.mjs) is the complete deterministic source for 30 mono PCM16 WAVs at 22,050 Hz. Run `node assets/audio/synthesize.mjs` from the repository to regenerate WAVs and manifest using the six unchanged Kenney members already in `public/audio`. Only Node's standard library is needed. The manifest records the script SHA-256 as source provenance. Original project material is labeled `original-project-material`, not falsely attributed to Kenney or a third-party CC0 dedication.

- Mechanical double-transient shutter; airy swept whistle; soft confirmation; generic and wood impacts.
- Three timber-step and three wet-step designs; rustle, splash, rapid wood tapping and gnawing effects.
- Twelve **stylized species/action signatures**, including an owl-like paired tone, woodpecker taps, beaver gnawing and squirrel/rabbit rustles. These are original designed sounds, not natural field recordings or verified zoological calls. Generic `alert`/`wildlife`/`action` requires the actual species; unknown species is silent. Specific authoritative action kinds (`tap`, `gnaw`, `splash`, `rustle`) may be used instead. Useful distinction and species fit remain listening gates.
- Sixteen-second low-pass wind/canopy bed with sparse invented background chirps (no identified species or objective meaning). Twelve-second quiet water-noise bed. Both have 25 ms endpoint envelopes and explicit whole-buffer loop points. Numeric endpoints are checked; perceived seam quality is unverified.
- Forty-eight-second sparse original pitched cue, nine soft notes with decays and rests. Note frequencies/timing are directly authored in the script; no borrowed melody or samples. Whole-buffer loop includes rests. It is not a commissioned score or evidence of musical quality; retain only if audition approves it.

`node assets/audio/check.mjs` checks delivery hashes and PCM/Ogg container timing/channel information and prints resampled float32 memory estimates. It does **not** decode Vorbis or establish listening. `node --test audio.test.ts` checks PCM peaks and endpoints plus production selection/lifecycle through a native-API boundary double (Node has no audio device). Native Ogg decode, autoplay, stereo, full-volume balance and long-session listening are Task 7 acceptance work.

## Integration

Use exactly one `createAudio()` per client. Call `unlock()` from Join/Continue/settings gesture, update listener from camera, and call `pause(true)` on disconnect/game pause. Document visibility is also handled internally. `pause(false)` restores current beds without replay; `dispose()` is terminal. Supply world-scoped current cue IDs; the module's 2,048-entry recent-ID cache supplements upstream historical-snapshot filtering, and persists across pause/reconnect.

Effects: shutter/notice are local; footsteps reach 12 m, other positional effects 32 m. Native linear panners provide the sole effect attenuation, with zero at/beyond the radius. Remove the previous client distance multiplier and oscillator calls. Water bed distance is separately supplied through `environment()` (18 m cutoff), with no directional claim because that API supplies no source point; individual splash cues are positional. The cap is 12 active/loading effects, two ambience beds, and one optional music loop. Decoded cache is bounded at 32 MiB; individual fetched files are capped at 5 MiB. Calls degrade silently on missing APIs/autoplay/fetch/decode; existing visual captions remain the caller's responsibility.

Production server must serve **`.wav` as `audio/wav`, `.ogg` as `audio/ogg`, `.json` as `application/json`**. No MP3 was retained. This worker did not edit server/main/view/shared, wire controls, change authoritative animal noise or perform a production browser run. The controller owns those integration changes and the Task 7 listening gate.
