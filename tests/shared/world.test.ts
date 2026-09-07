import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateReserve,
  validateReserve,
  RESERVE_SPECIES,
  reserveCanopyCoverage,
  BLUEPRINT_LIMIT,
} from "../../src/shared/world/world.ts";
test("generated reserves contain reachable diverse commissioned wildlife", (t) => {
  const usedSpecies = new Set<string>(),
    models: Record<string, number> = {},
    metrics: {
      seed: number;
      attempt: number;
      bytes: number;
      trees: number;
      coverage: number;
      dense: number;
      light: number;
      open: number;
    }[] = [];
  for (const seed of [
    0,
    1,
    0xffffffff,
    ...Array.from({ length: 256 }, (_, i) => i * 65537),
  ]) {
    const world = generateReserve(seed, "seed-check");
    assert.deepEqual(validateReserve(structuredClone(world)), world);
    assert.deepEqual(generateReserve(seed, "seed-check"), world);
    assert.equal(
      new Set(world.residents.map((a) => a.species)).size,
      RESERVE_SPECIES.length,
    );
    assert.ok(world.residents.length >= 36 && world.residents.length <= 48);
    const required = world.commissions.filter((c) => c.required);
    assert.equal(required.length, 6);
    assert.equal(world.commissions.length, 8);
    assert.ok(new Set(required.map((c) => c.pocket)).size >= 5);
    const used = new Set(
      required
        .flatMap((c) => c.subjects)
        .map((id) => world.residents.find((a) => a.id === id)!.species),
    );
    assert.ok(used.size >= 5);
    for (const species of used) usedSpecies.add(species);
    const trees = world.placements.filter((p) => p.model.startsWith("Mature"));
    for (const tree of trees)
      models[tree.model] = (models[tree.model] ?? 0) + 1;
    const waterArea = world.waters.reduce(
        (n, b) => n + (b.max[0] - b.min[0]) * (b.max[2] - b.min[2]),
        0,
      ),
      land = 384 * 320 - waterArea;
    const fractions = Object.fromEntries(
      world.density.map((d) => [
        d.kind,
        ((d.max[0] - d.min[0]) * (d.max[2] - d.min[2]) -
          world.waters.reduce(
            (n, b) =>
              n +
              Math.max(
                0,
                Math.min(d.max[0], b.max[0]) - Math.max(d.min[0], b.min[0]),
              ) *
                Math.max(
                  0,
                  Math.min(d.max[2], b.max[2]) - Math.max(d.min[2], b.min[2]),
                ),
            0,
          )) /
          land,
      ]),
    );
    const bytes = Buffer.byteLength(JSON.stringify(world));
    assert.ok(bytes <= BLUEPRINT_LIMIT);
    assert.ok(
      fractions.dense >= 0.65 &&
        fractions.dense <= 0.75 &&
        fractions.light >= 0.15 &&
        fractions.light <= 0.25 &&
        fractions.open >= 0.05 &&
        fractions.open <= 0.15,
    );
    const coverage = reserveCanopyCoverage(world);
    assert.ok(coverage >= 0.7 && coverage <= 0.9);
    const nodes = new Map(world.navNodes.map((n) => [n.id, n])),
      seen = new Set<string>(),
      pending = ["camp"];
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      pending.push(...nodes.get(id)!.links);
    }
    assert.equal(seen.size, nodes.size);
    metrics.push({
      seed,
      attempt: world.attempt,
      bytes,
      trees: trees.length,
      coverage,
      dense: fractions.dense,
      light: fractions.light,
      open: fractions.open,
    });
  }
  assert.deepEqual([...usedSpecies].sort(), [...RESERVE_SPECIES].sort());
  const range = (key: keyof (typeof metrics)[number]) => [
    Math.min(...metrics.map((m) => m[key])),
    Math.max(...metrics.map((m) => m[key])),
  ];
  t.diagnostic(
    JSON.stringify({
      entries: metrics.length,
      uniqueSeeds: new Set(metrics.map((m) => m.seed)).size,
      requiredSpecies: [...usedSpecies].sort(),
      models,
      attempt: range("attempt"),
      bytes: range("bytes"),
      trees: range("trees"),
      coverage: range("coverage"),
      dense: range("dense"),
      light: range("light"),
      open: range("open"),
    }),
  );
});

test("malformed and infeasible blueprints are rejected at the data boundary", () => {
  const original = generateReserve(1, "boundary");
  const bad: [string, (w: typeof original) => void][] = [
    [
      "non-numeric quaternion",
      (w) => {
        (w.props[0].pose.rotation as unknown[])[0] = "0";
      },
    ],
    [
      "wrong behavior type",
      (w) => {
        (w.commissions[2] as unknown as Record<string, unknown>).behavior =
          true;
      },
    ],
    [
      "unknown property",
      (w) => {
        (w as unknown as Record<string, unknown>).surprise = true;
      },
    ],
    [
      "non-finite",
      (w) => {
        w.camp[0] = NaN;
      },
    ],
    [
      "wrong reference",
      (w) => {
        w.residents[0].anchors[0] = "missing";
      },
    ],
    [
      "missing subject",
      (w) => {
        w.commissions[0].subjects = ["missing"];
      },
    ],
    [
      "missing screen",
      (w) => {
        w.props = w.props.filter((p) => p.kind !== "screen");
      },
    ],
    [
      "outside reserve",
      (w) => {
        w.placements[0].position[0] = 400;
      },
    ],
    [
      "false density",
      (w) => {
        w.density[0].kind = "open";
      },
    ],
    [
      "blocked entrance",
      (w) => {
        w.navNodes[0].position = [
          ...w.placements.find((p) => p.model.startsWith("Mature"))!.position,
        ];
      },
    ],
    [
      "oversized",
      (w) => {
        w.commissions[0].instructions = "x".repeat(1024 * 1024);
      },
    ],
    [
      "broken transition",
      (w) => {
        w.pockets[0].anchors[0].links = [];
      },
    ],
    [
      "absent canopy",
      (w) => {
        w.placements = w.placements.filter(
          (p) => !p.model.startsWith("Mature"),
        );
      },
    ],
    [
      "no loop",
      (w) => {
        w.navNodes[0].links = [];
      },
    ],
    [
      "malformed seat",
      (w) => {
        w.fixtures.find((f) => f.kind === "crossing")!.seats.left.position = [
          500, 0, 0,
        ];
      },
    ],
  ];
  for (const [name, mutate] of bad) {
    const w = structuredClone(original);
    mutate(w);
    assert.throws(() => validateReserve(w), name);
  }
});

test("full uint32 seed changes layout and objective bindings", () => {
  const worlds = [0, 0x80000000, 0xffffffff, 0x7fffffff].map((seed) =>
    generateReserve(seed, "diversity"),
  );
  assert.equal(new Set(worlds.map((w) => JSON.stringify(w.pockets))).size, 4);
  assert.ok(
    new Set(worlds.map((w) => Math.round(w.pockets[1].position[0] / 64))).size >
      1,
    "occupied cells change, not just in-cell jitter",
  );
  assert.equal(
    new Set(worlds.map((w) => JSON.stringify(w.commissions))).size,
    4,
  );
  assert.deepEqual(
    { ...generateReserve(1, "one"), id: "two" },
    generateReserve(1, "two"),
  );
});

test("required subjects have clear production camera rays and distinct resident positions", async () => {
  const { reserveApproaches } = await import("../../src/shared/world/world.ts");
  const { rayBlocked } = await import("../../src/shared/shared.ts");
  const w = generateReserve(1, "camera");
  const boxes = [...w.walls, ...w.placements.flatMap((p) => p.occluders)];
  for (const c of w.commissions.filter((c) => c.required)) {
    const anchor = w.pockets
      .flatMap((p) => p.anchors)
      .find((a) => a.id === c.anchor)!;
    assert.ok(
      reserveApproaches(w, c.pocket).every(
        (n) =>
          !rayBlocked(
            [n.position[0], 1.6, n.position[2]],
            [anchor.point[0], anchor.point[1] + 0.4, anchor.point[2]],
            boxes,
          ),
      ),
      c.id,
    );
  }
  assert.equal(
    new Set(w.residents.map((r) => r.spawn.join(","))).size,
    w.residents.length,
  );
});

test("resident ground transitions use the production swept-volume geometry", async () => {
  const { corridorBlocked } = await import("../../src/shared/world/world.ts");
  const w = generateReserve(1, "animal-paths");
  for (const r of w.residents) {
    const anchors = w.pockets
      .find((p) => p.id === r.home)!
      .anchors.filter((a) => r.anchors.includes(a.id));
    for (const a of anchors)
      for (const b of anchors) {
        if (
          a === b ||
          !a.links.includes(b.id) ||
          a.kind === "perch" ||
          b.kind === "perch" ||
          a.kind === "water" ||
          b.kind === "water"
        )
          continue;
        assert.ok(
          !corridorBlocked(a.point, b.point, w.walls, 0.35, 1.8),
          `${r.id} ${a.id}/${b.id}`,
        );
      }
  }
});

test("reserve identity hashes frozen complete data and boundary walls retain equipment", async () => {
  const { reserveHash, corridorBlocked } =
    await import("../../src/shared/world/world.ts");
  const w = generateReserve(1, "immutable");
  assert.ok(Object.isFrozen(w) && Object.isFrozen(w.placements[0].position));
  const shallow = Object.freeze(structuredClone(w));
  validateReserve(shallow);
  assert.ok(Object.isFrozen(shallow.placements[0].position));
  assert.match(await reserveHash(w), /^[a-f0-9]{64}$/);
  assert.equal(await reserveHash(w), await reserveHash(structuredClone(w)));
  assert.notEqual(
    await reserveHash(w),
    await reserveHash(generateReserve(1, "other")),
  );
  assert.ok(corridorBlocked([188, 0, 0], [194, 0, 0], w.walls));
});

test("swept corridors reject a midpoint trunk and low roof, retaining crown clearance", async () => {
  const { corridorBlocked } = await import("../../src/shared/world/world.ts");
  const { placement } = await import("../../src/shared/world/level.ts");
  const tree = placement("blocking-tree", "MatureOakA", [0, 0, 0]);
  assert.ok(!corridorBlocked([-8, 0, 0], [-8, 0, 0], tree.solids));
  assert.ok(!corridorBlocked([8, 0, 0], [8, 0, 0], tree.solids));
  assert.ok(corridorBlocked([-8, 0, 0], [8, 0, 0], tree.solids));
  assert.ok(
    corridorBlocked(
      [-8, 0, 4],
      [8, 0, 4],
      [{ id: "roof", min: [-1, 5.9, 2], max: [1, 7, 6] }],
    ),
  );
  assert.ok(!corridorBlocked([-8, 0, 4], [8, 0, 4], tree.occluders));
  assert.ok(corridorBlocked([-8, 0, 3], [8, 0, 3], tree.solids));
});

test("water has a submerged physical bed and one realizable plank seat", () => {
  const w = generateReserve(1, "water");
  for (const water of w.waters)
    assert.ok(
      w.physicsBoxes.some(
        (b) => b.id === `${water.id}-bed` && b.max[1] < water.max[1],
      ),
    );
  for (const f of w.fixtures.filter((f) => f.kind === "crossing"))
    assert.equal(Object.keys(f.seats).length, 1);
});

test("small residents have close camera positions and physically supported perches", async () => {
  const { reserveApproaches } = await import("../../src/shared/world/world.ts");
  const w = generateReserve(1, "close");
  for (const r of w.residents.filter((r) =>
    ["rabbit", "squirrel", "otter", "woodpecker", "mallard", "owl"].includes(
      r.species,
    ),
  )) {
    assert.ok(
      reserveApproaches(w, r.home).some(
        (n) =>
          Math.hypot(n.position[0] - r.spawn[0], n.position[2] - r.spawn[2]) <=
          6,
      ),
      r.id,
    );
    if (r.species === "woodpecker")
      assert.ok(
        w.placements.some(
          (p) =>
            p.model === "SnagTall" &&
            Math.hypot(
              p.position[0] - r.spawn[0],
              p.position[2] - r.spawn[2],
            ) <= 1,
        ),
        "woodpecker supported at trunk",
      );
    if (r.species === "owl")
      assert.ok(
        w.placements.some(
          (p) =>
            p.model === "RootArch" &&
            Math.hypot(p.position[0] - r.spawn[0], p.position[2] - r.spawn[2]) <
              2,
        ),
        "owl has actual branch",
      );
  }
});

test("camp occupies open ground within the connected reserve", () => {
  const w = generateReserve(1, "camp-open");
  assert.ok(
    w.density.some(
      (d) =>
        d.kind === "open" &&
        w.camp[0] > d.min[0] &&
        w.camp[0] < d.max[0] &&
        w.camp[2] > d.min[2] &&
        w.camp[2] < d.max[2],
    ),
  );
});

test("review: generated arch perches contact the exported mesh", async () => {
  const { readFile } = await import("node:fs/promises");
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const { Raycaster, Vector3 } = await import("three");
  const bytes = await readFile(
    new URL("../../public/models/forest-kit-v3.glb", import.meta.url),
  );
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const arch = gltf.scene.getObjectByName("RootArch")!;
  arch.removeFromParent();
  const turns = new Set<number>();
  let maxResidents = 0;
  for (
    let seed = 0;
    seed < 16 && (turns.size < 4 || maxResidents < 4);
    seed++
  ) {
    const w = generateReserve(seed, "review-perches");
    maxResidents = Math.max(
      maxResidents,
      w.residents.filter((r) => r.species === "owl").length,
    );
    for (const pocket of w.pockets) {
      const p = w.placements.find((p) => p.id === pocket.id + "-perch-arch");
      if (!p) continue;
      turns.add(p.yaw);
      arch.position.fromArray(p.position);
      arch.rotation.set(0, p.yaw, 0);
      arch.updateMatrixWorld(true);
      for (const a of pocket.anchors.filter(
        (a) => a.kind === "perch" && !a.id.includes("woodpecker"),
      )) {
        const hit = new Raycaster(
          new Vector3(a.point[0], a.point[1] + 1, a.point[2]),
          new Vector3(0, -1, 0),
        ).intersectObject(arch, true)[0];
        assert.ok(hit, `${a.id} has no exported surface`);
        assert.ok(
          Math.abs(hit.point.y - a.point[1]) < 0.0001,
          `${a.id} gap ${a.point[1] - hit.point.y}`,
        );
      }
    }
  }
  assert.equal(turns.size, 4);
  assert.equal(maxResidents, 4);
  const altered = structuredClone(generateReserve(1, "bad-perch"));
  altered.pockets
    .flatMap((p) => p.anchors)
    .find(
      (a) => a.kind === "perch" && !a.id.includes("woodpecker"),
    )!.point[1] += 0.01;
  assert.throws(() => validateReserve(altered), /perch tree/);
});

test("review: actual camp tin and prop origins require ground support", () => {
  const original = generateReserve(1, "review-support");
  for (const mutate of [
    (w: typeof original) => {
      w.stations[0].position = [
        w.stations[0].position[0],
        30,
        w.stations[0].position[2],
      ];
    },
    (w: typeof original) => {
      w.stations[0].recover[1] = 0.1;
    },
    (w: typeof original) => {
      w.pockets[0].position = [
        w.pockets[0].position[0],
        30,
        w.pockets[0].position[2],
      ];
    },
    (w: typeof original) => {
      w.camp = [w.camp[0], 30, w.camp[2]];
    },
    (w: typeof original) => {
      w.tinStart[1] = 30;
    },
    ...original.props.map((_, i) => (w: typeof original) => {
      w.props[i].pose.position[1] = 30;
    }),
  ]) {
    const w = JSON.parse(JSON.stringify(original));
    mutate(w);
    assert.throws(() => validateReserve(w));
  }
});

test("review: nested geometry is exact typed and matches its fixture", () => {
  const original = generateReserve(1, "review-fixtures");
  const mutations: ((w: typeof original) => void)[] = [
    (w) => {
      (w.props[0].pose as unknown as Record<string, unknown>).unexpected = true;
    },
    (w) => {
      w.fixtures[0].openSurfaces[0].axis = 99 as 0;
    },
    (w) => {
      const s = w.fixtures[0].openSurfaces[0] as unknown as Record<
        string,
        unknown
      >;
      s.heightStart = "0.2";
      s.heightEnd = "0.2";
    },
    (w) => {
      w.fixtures[0].openSurfaces[0].min[0] += 0.5;
    },
    (w) => {
      w.fixtures[0].seats.left.position[0] += 0.5;
    },
    (w) => {
      (
        w.fixtures[0].openSurfaces[0] as unknown as Record<string, unknown>
      ).unexpected = true;
    },
    (w) => {
      (
        w.fixtures.find((f) => f.kind === "gate")!
          .closedBoxes[0] as unknown as Record<string, unknown>
      ).unexpected = true;
    },
    (w) => {
      w.fixtures.find((f) => f.kind === "gate")!.closedBoxes = [];
    },
  ];
  for (const [i, mutate] of mutations.entries()) {
    const w = structuredClone(original);
    mutate(w);
    assert.throws(() => validateReserve(w), `nested geometry mutation ${i}`);
  }
});

test("review: each commissioned target belongs to each subject's reachable subset", () => {
  const original = generateReserve(1, "review-target");
  const c = original.commissions.find(
    (c) => c.required && c.kind === "behavior" && c.anchor!.endsWith("-cache"),
  )!;
  assert.ok(c);
  const w = structuredClone(original);
  const r = w.residents.find((r) => r.id === c.subjects[0])!;
  r.anchors = r.anchors.filter((id) => id !== c.anchor);
  assert.throws(() => validateReserve(w));
});
