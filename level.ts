/** Generated fixture geometry and compatible public exports for the level catalog. */
import type { Box, FixtureState, Vec3, Walkable } from "./shared.ts";
import type { Fixture } from "./world.ts";
import { worldBox } from "./forest-models.ts";
export {
  type WorldPlacement,
  type NavNode,
  FOREST_MODELS,
  worldBox,
  placement,
} from "./forest-models.ts";
export {
  CONTENT_VERSION,
  WORLD_BOUNDS,
  CAMP,
  WOODLAND,
  WASHOUT,
  CLEARING,
  WETLAND,
  WATER_BOUNDS,
  HABITAT_SITES,
  WOODLAND_WASH_SITES,
  PATCH,
  PERCHES,
  STASH,
  TIN_START,
  TIN_HALF,
  PROP_CENTER_HEIGHT,
  PROP_DEFINITIONS,
  PLANK_PLACEMENTS,
  PROP_RECOVERY_POINTS,
  ASSIGNMENTS,
  RULES,
  CLUES,
} from "./level-data.ts";
export {
  WALKABLES,
  TRAILS,
  WORLD_PLACEMENTS,
  NAV_NODES,
  routeBoxes,
  gateLatch,
  routeSurfaces,
  WALLS,
  PHYSICS_BOXES,
} from "./legacy-level.ts";
export {
  SUBJECT_POINTS,
  SUBJECT_HEIGHT,
  animalArticulation,
  subjectPoints,
} from "./subject-geometry.ts";

function fixtureState(fixture: Fixture, states: FixtureState) {
  const state = states[fixture.id];
  if (
    !state ||
    typeof state.open !== "boolean" ||
    (fixture.kind === "gate"
      ? state.seat !== null
      : state.open
        ? typeof state.seat !== "string" ||
          !Object.hasOwn(fixture.seats, state.seat)
        : state.seat !== null)
  )
    throw Error(`Invalid fixture state: ${fixture.id}`);
  return state;
}

export function fixtureBoxes(fixtures: Fixture[], states: FixtureState): Box[] {
  return fixtures.flatMap((fixture) => {
    if (!fixtureState(fixture, states).open) return fixture.closedBoxes;
    if (fixture.kind !== "gate") return [];
    // The exported gate rotates around its local left hinge at X -2.2.
    const local: Vec3 = [-2.2, 0, -2.2],
      center: Vec3 = [
        fixture.position[0] +
          local[0] * Math.cos(fixture.yaw) +
          local[2] * Math.sin(fixture.yaw),
        fixture.position[1],
        fixture.position[2] -
          local[0] * Math.sin(fixture.yaw) +
          local[2] * Math.cos(fixture.yaw),
      ];
    return [
      worldBox(
        `${fixture.id}-leaf`,
        center,
        fixture.yaw + Math.PI / 2,
        [-2.15, 0.25, -0.06],
        [2.15, 1.45, 0.06],
      ),
    ];
  });
}

export function fixtureSurfaces(
  fixtures: Fixture[],
  states: FixtureState,
): Walkable[] {
  return fixtures.flatMap((fixture) =>
    fixtureState(fixture, states).open ? fixture.openSurfaces : [],
  );
}

export function fixtureLatch(
  fixture: Fixture,
  states: FixtureState,
): Vec3 | null {
  if (!fixture.latch || !fixtureState(fixture, states).open)
    return fixture.latch;
  const dx = fixture.latch[0] - fixture.position[0],
    dz = fixture.latch[2] - fixture.position[2],
    localX = dx * Math.cos(fixture.yaw) - dz * Math.sin(fixture.yaw),
    localZ = dx * Math.sin(fixture.yaw) + dz * Math.cos(fixture.yaw),
    x = -2.2 + localZ,
    z = -(localX + 2.2);
  return [
    fixture.position[0] + x * Math.cos(fixture.yaw) + z * Math.sin(fixture.yaw),
    fixture.latch[1],
    fixture.position[2] - x * Math.sin(fixture.yaw) + z * Math.cos(fixture.yaw),
  ];
}
