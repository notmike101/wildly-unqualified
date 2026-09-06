/** Reserve data contract, species rules, and player-facing commission descriptions. */
import type { Box, Pose, Vec3, Walkable } from "./shared.ts";
import { type NavNode, type WorldPlacement } from "./level.ts";
export const RESERVE_SPECIES = [
  "raccoon",
  "deer",
  "heron",
  "fox",
  "rabbit",
  "squirrel",
  "beaver",
  "otter",
  "badger",
  "owl",
  "woodpecker",
  "mallard",
] as const;
export function residentName(
  world: Pick<ReserveBlueprint, "residents">,
  id: string,
): string {
  const resident = world.residents.find((r) => r.id === id);
  if (!resident) return "Wildlife";
  const index = world.residents
    .filter((r) => r.species === resident.species)
    .findIndex((r) => r.id === id);
  const names = [
    "Cedar",
    "Birch",
    "Alder",
    "Willow",
    "Hazel",
    "Maple",
    "Aspen",
    "Rowan",
  ];
  return `${names[index % names.length]} ${resident.species}`;
}
export function commissionInstructions(
  world: ReserveBlueprint,
  c: Commission,
): string {
  const names = c.subjects.map((id) => residentName(world, id)).join(" and ");
  const species = world.residents.find((r) => r.id === c.subjects[0])!.species;
  if (c.kind === "behavior") {
    const actions: Record<ReserveSpecies, string> = {
      raccoon: "rinsing food at the brook; hold the open tin beside the water",
      deer: "grazing quietly",
      heron: "preening after you give it space",
      fox: "pouncing along the tracks",
      rabbit: "nibbling at its feeding patch",
      squirrel: "working at its ground cache after climbing",
      beaver: "gnawing branches at its feeding patch",
      otter: "grooming on the bank after a swim",
      badger: "digging at its den",
      owl: "roosting on the low arch",
      woodpecker: "tapping the dead trunk",
      mallard: "dabbling in its pond",
    };
    return `Photograph ${names} ${actions[species]}. Keep its head and body clear in the frame.`;
  }
  if (c.kind === "setup")
    return `Set an open decoy by the feeding patch, open the tin nearby and photograph ${names} from behind the placed screen. Give it quiet space.`;
  if (c.kind === "composition")
    return `Include ${names} and the nearby ${world.placements.find((p) => p.id === c.landmark)?.model === "HollowLog" ? "hollow log" : "mossy boulder"} clearly in one frame. Try the side approach.`;
  if (c.kind === "passage")
    return `Follow the footprints near ${names}'s patch. Photograph it returning along that trail after its short circuit.`;
  if (c.kind === "pair")
    return species === "raccoon"
      ? `Frame ${names} together: let the heron display after bait, then hold the open tin 3–8 metres away for the raccoon.`
      : `Frame ${names} together at their shared feeding patch during their calm feeding or branch-work routines.`;
  if (c.kind === "incident")
    return `Optional: photograph ${names} with a borrowed crew hat or investigating a nearby spill. Recover the hat or supplies afterwards.`;
  return `Optional: take a clear field portrait of ${names} in its home area.`;
}
export type ReserveSpecies = (typeof RESERVE_SPECIES)[number];
export type Anchor = {
  id: string;
  point: Vec3;
  kind:
    | "ground"
    | "water"
    | "perch"
    | "wash"
    | "feed"
    | "rest"
    | "retreat"
    | "passage"
    | "cache"
    | "den";
  links: string[];
};
export type Resident = {
  id: string;
  species: ReserveSpecies;
  home: string;
  spawn: Vec3;
  anchors: string[];
  group: string | null;
};
export type Commission = {
  id: string;
  required: boolean;
  kind:
    | "behavior"
    | "setup"
    | "composition"
    | "passage"
    | "pair"
    | "cameo"
    | "incident";
  subjects: string[];
  pocket: string;
  anchor: string | null;
  landmark: string | null;
  behavior: string | null;
  title: string;
  instructions: string;
};
export type Fixture = {
  id: string;
  kind: "gate" | "crossing";
  position: Vec3;
  yaw: number;
  closedBoxes: Box[];
  openSurfaces: Walkable[];
  seats: Record<string, Pose>;
  plankId: string | null;
  latch: Vec3 | null;
};
export type ReserveBlueprint = {
  id: string;
  content: "forest-expedition-1";
  seed: number;
  attempt: number;
  bounds: Box;
  camp: Vec3;
  tinStart: Vec3;
  pockets: {
    id: string;
    habitat: "woodland" | "clearing" | "wetland";
    position: Vec3;
    anchors: Anchor[];
  }[];
  stations: { id: string; position: Vec3; recover: Vec3 }[];
  density: {
    id: string;
    min: Vec3;
    max: Vec3;
    kind: "dense" | "light" | "open";
  }[];
  placements: WorldPlacement[];
  walkables: Walkable[];
  waters: Box[];
  trails: { id: string; points: Vec3[]; width: number }[];
  navNodes: NavNode[];
  walls: Box[];
  physicsBoxes: Box[];
  fixtures: Fixture[];
  residents: Resident[];
  commissions: Commission[];
  props: {
    id: string;
    kind: "case" | "plank" | "screen" | "decoy";
    pose: Pose;
  }[];
};
export const BLUEPRINT_LIMIT = 1024 * 1024;
// Versioned, species-specific repeatable routines, also consumed by encounters.
export const RESERVE_ROUTINES: Record<
  ReserveSpecies,
  { behavior: string; anchor: Anchor["kind"]; kinds: Anchor["kind"][] }
> = {
  raccoon: {
    behavior: "wash",
    anchor: "wash",
    kinds: ["ground", "feed", "wash", "retreat"],
  },
  deer: {
    behavior: "graze",
    anchor: "feed",
    kinds: ["ground", "feed", "passage", "retreat"],
  },
  heron: {
    behavior: "preen",
    anchor: "rest",
    kinds: ["ground", "water", "feed", "rest", "retreat"],
  },
  fox: {
    behavior: "pounce",
    anchor: "passage",
    kinds: ["ground", "passage", "rest", "retreat"],
  },
  rabbit: {
    behavior: "nibble",
    anchor: "feed",
    kinds: ["ground", "feed", "rest", "retreat"],
  },
  squirrel: {
    behavior: "cache",
    anchor: "cache",
    kinds: ["ground", "perch", "cache", "retreat"],
  },
  beaver: {
    behavior: "gnaw",
    anchor: "feed",
    kinds: ["ground", "water", "feed", "den", "retreat"],
  },
  otter: {
    behavior: "groom",
    anchor: "rest",
    kinds: ["ground", "water", "rest", "retreat"],
  },
  badger: {
    behavior: "dig",
    anchor: "den",
    kinds: ["ground", "den", "passage", "retreat"],
  },
  owl: {
    behavior: "roost",
    anchor: "perch",
    kinds: ["perch", "rest", "retreat"],
  },
  woodpecker: {
    behavior: "tap",
    anchor: "perch",
    kinds: ["perch", "rest", "retreat"],
  },
  mallard: {
    behavior: "dabble",
    anchor: "water",
    kinds: ["ground", "water", "feed", "rest", "retreat"],
  },
};
export const PAIRS: ReserveSpecies[][] = [
  ["raccoon", "heron"],
  ["deer", "rabbit"],
  ["beaver", "mallard"],
];
