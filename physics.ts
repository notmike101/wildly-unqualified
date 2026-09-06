import Box3D, { type Body, type V } from "box3d-wasm/standard";
import type { Box, FieldProp, Pose, RouteState, Tin, Vec3 } from "./shared.ts";
import {
  PLANK_PLACEMENTS,
  PROP_DEFINITIONS,
  TIN_HALF,
  routeBoxes,
} from "./level.ts";

type MovingBody = Body & {
  createHull(options: {
    points: V[];
    density: number;
    friction: number;
    enableContactEvents: boolean;
    enableHitEvents: boolean;
  }): { delete(): void; setUserData(value: number): void };
  getLinearVelocity(): V;
  getAngularVelocity(): V;
  setLinearVelocity(v: V): void;
  setAngularVelocity(v: V): void;
  setTransform(position: V, rotation: V & { w: number }): void;
  destroy(): void;
};
export type PhysicsState = {
  pose: Pose;
  velocity: Vec3;
  angularVelocity: Vec3;
  impacts: { point: Vec3; sources: string[] }[];
  props: FieldProp[];
};
export type ReservePhysics = {
  step(dt: number): PhysicsState;
  setTin(tin: Tin): void;
  setProps(props: FieldProp[], route: RouteState): void;
  dispose(): void;
};
export type TinPhysics = ReservePhysics;
const vector = ([x, y, z]: Vec3): V => ({ x, y, z });
const tuple = (v: V): Vec3 => [v.x, v.y, v.z];
const distanceSquared = (a: number[], b: number[]) =>
  a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0);
let modulePromise: ReturnType<typeof Box3D> | undefined;

export async function createPhysics(
  boxes: Box[],
  tin: Tin,
  props: FieldProp[] = [],
  route: RouteState = { crossing: null, gateOpen: false },
): Promise<ReservePhysics> {
  const b3 = await (modulePromise ??= Box3D());
  const sourceNames = ["tin", ...props.map((p) => p.id)],
    sourceTag = (id: string) => sourceNames.indexOf(id) + 1;
  if (b3.threaded !== false)
    throw Error("Expected Box3D standard single-threaded build");
  const world = new b3.World({ gravity: { x: 0, y: -10, z: 0 } }),
    statics: Body[] = [],
    propBodies = new Map<
      string,
      {
        body: MovingBody | null;
        state: FieldProp;
        mode: "held" | "placed" | "loose";
      }
    >();
  let body: MovingBody | null = null,
    routeBodies: Body[] = [],
    routeKey = "",
    disposed = false,
    accumulator = 0,
    state = structuredClone(tin);
  const ensure = () => {
    if (disposed) throw Error("Reserve physics is disposed");
  };
  const remove = () => {
    if (body) {
      body.destroy();
      body.delete();
      body = null;
    }
  };
  const removeProp = (id: string) => {
    const entry = propBodies.get(id);
    if (entry?.body) {
      entry.body.destroy();
      entry.body.delete();
    }
    propBodies.delete(id);
  };
  const createPropBody = (
    value: FieldProp,
    type: "static" | "kinematic" | "dynamic",
  ) => {
    const [x, y, z, w] = value.pose.rotation,
      moving = world.createBody({
        type,
        position: vector(value.pose.position),
        rotation: { x, y, z, w },
      } as never) as MovingBody;
    for (const solid of PROP_DEFINITIONS[value.kind].solids) {
      const half = solid.size.map((n) => n / 2) as Vec3,
        points = [-1, 1].flatMap((sx) =>
          [-1, 1].flatMap((sy) =>
            [-1, 1].map((sz) =>
              vector([
                solid.center[0] + sx * half[0],
                solid.center[1] + sy * half[1],
                solid.center[2] + sz * half[2],
              ]),
            ),
          ),
        );
      const shape = moving.createHull({
        points,
        density: 1,
        friction: 0.75,
        enableContactEvents: true,
        enableHitEvents: true,
      });
      shape.setUserData(sourceTag(value.id));
      shape.delete();
    }
    if (type === "dynamic") {
      moving.setLinearVelocity(vector(value.velocity));
      moving.setAngularVelocity(vector(value.angularVelocity));
    }
    return moving;
  };
  const createStaticBox = (box: Box) => {
    const center = box.min.map((n, i) => (n + box.max[i]) / 2) as Vec3,
      half = box.min.map((n, i) => (box.max[i] - n) / 2) as Vec3,
      item = world.createBody({
        type: "static",
        position: vector(center),
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      });
    const shape = item.createBox({
      halfExtents: vector(half),
      density: 1,
      friction: 0.65,
      enableContactEvents: true,
    }) as { setUserData(value: number): void; delete(): void };
    shape.setUserData(0);
    shape.delete();
    return item;
  };
  const setRoute = (value: RouteState) => {
    const key = `${value.crossing ?? "none"}:${value.gateOpen}`;
    if (routeKey === key) return;
    for (const item of routeBodies) {
      (item as MovingBody).destroy();
      item.delete();
    }
    routeBodies = routeBoxes(value).map(createStaticBox);
    routeKey = key;
    if (value.crossing)
      routeBodies.push(
        createPropBody(
          {
            id: "seated-crossing",
            kind: "plank",
            pose: structuredClone(PLANK_PLACEMENTS[value.crossing]),
            velocity: [0, 0, 0],
            angularVelocity: [0, 0, 0],
            holders: [null, null],
            placed: true,
            open: false,
            spillUntilTick: 0,
          },
          "static",
        ),
      );
  };
  const setProps = (values: FieldProp[], nextRoute: RouteState) => {
    ensure();
    const ids = new Set(values.map((value) => value.id));
    for (const id of propBodies.keys()) if (!ids.has(id)) removeProp(id);
    for (const value of values) {
      const mode = value.holders.some(Boolean)
          ? "held"
          : value.placed
            ? "placed"
            : "loose",
        current = propBodies.get(value.id);
      const unchanged =
        current &&
        distanceSquared(current.state.pose.position, value.pose.position) <
          1e-8 &&
        distanceSquared(current.state.pose.rotation, value.pose.rotation) <
          1e-8;
      if (current?.mode === mode && (mode !== "loose" || unchanged)) {
        if (mode === "held" && !unchanged) {
          const [x, y, z, w] = value.pose.rotation;
          current.body!.setTransform(vector(value.pose.position), {
            x,
            y,
            z,
            w,
          });
        }
        current.state = structuredClone(value);
        continue;
      }
      removeProp(value.id);
      propBodies.set(value.id, {
        body:
          mode === "placed" && value.kind === "plank"
            ? null
            : createPropBody(
                value,
                mode === "placed"
                  ? "static"
                  : mode === "held"
                    ? "kinematic"
                    : "dynamic",
              ),
        state: structuredClone(value),
        mode,
      });
    }
    setRoute(nextRoute);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    world.destroy();
    body?.delete();
    body = null;
    for (const entry of propBodies.values()) entry.body?.delete();
    propBodies.clear();
    for (const item of routeBodies) item.delete();
    routeBodies = [];
    for (const item of statics) item.delete();
    world.delete();
  };
  const setTin = (value: Tin) => {
    ensure();
    remove();
    state = structuredClone(value);
    accumulator = 0;
    if (state.holder) return;
    const [x, y, z, w] = state.pose.rotation;
    body = world.createBody({
      type: "dynamic",
      position: vector(state.pose.position),
      rotation: { x, y, z, w },
    }) as MovingBody;
    const shape = body.createBox({
      halfExtents: vector(TIN_HALF),
      density: 1,
      friction: 0.65,
      enableContactEvents: true,
      enableHitEvents: true,
    } as any) as { setUserData(value: number): void; delete(): void };
    shape.setUserData(sourceTag("tin"));
    shape.delete();
    body.setLinearVelocity(vector(state.velocity));
    body.setAngularVelocity(vector(state.angularVelocity));
  };
  try {
    for (const box of boxes) {
      const item = createStaticBox(box);
      statics.push(item);
    }
    setTin(tin);
    setProps(props, route);
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    setTin,
    setProps,
    dispose,
    step(dt) {
      ensure();
      if (!Number.isFinite(dt) || dt < 0)
        throw Error("Invalid physics timestep");
      const impacts: PhysicsState["impacts"] = [];
      accumulator += Math.min(dt, 0.25);
      while (accumulator >= 1 / 60 - 1e-9) {
        const sources = new Map<string, { point: Vec3; speed: number }>([
          ...(body
            ? ([
                [
                  "tin",
                  {
                    point: tuple(body.getPosition()),
                    speed: Math.hypot(...tuple(body.getLinearVelocity())),
                  },
                ],
              ] as const)
            : []),
          ...[...propBodies].flatMap(([id, e]) =>
            e.body
              ? ([
                  [
                    id,
                    {
                      point: tuple(e.body.getPosition()),
                      speed: Math.hypot(...tuple(e.body.getLinearVelocity())),
                    },
                  ],
                ] as const)
              : [],
          ),
        ]);
        world.step(1 / 60, 4);
        accumulator -= 1 / 60;
        const events = world.getContactEvents() as {
          begin: { shapeUserDataA: number; shapeUserDataB: number }[];
          hit: {
            point: V;
            approachSpeed: number;
            shapeUserDataA: number;
            shapeUserDataB: number;
          }[];
        };
        const ids = (e: { shapeUserDataA: number; shapeUserDataB: number }) => [
          ...new Set(
            [e.shapeUserDataA, e.shapeUserDataB].flatMap((tag) =>
              sourceNames[tag - 1] ? [sourceNames[tag - 1]] : [],
            ),
          ),
        ];
        for (const hit of events.hit)
          if (hit.approachSpeed > 1)
            impacts.push({ point: tuple(hit.point), sources: ids(hit) });
        if (!events.hit.length)
          for (const contact of events.begin) {
            const involved = ids(contact),
              moving = involved
                .map((id) => sources.get(id))
                .find((s) => s && s.speed > 1);
            if (moving)
              impacts.push({ point: moving.point, sources: involved });
          }
      }
      if (body) {
        const q = body.getRotation();
        state.pose = {
          position: tuple(body.getPosition()),
          rotation: [q.x, q.y, q.z, q.w],
        };
        state.velocity = tuple(body.getLinearVelocity());
        state.angularVelocity = tuple(body.getAngularVelocity());
      } else accumulator = 0;
      for (const entry of propBodies.values())
        if (entry.body && entry.mode === "loose") {
          const q = entry.body.getRotation();
          entry.state.pose = {
            position: tuple(entry.body.getPosition()),
            rotation: [q.x, q.y, q.z, q.w],
          };
          entry.state.velocity = tuple(entry.body.getLinearVelocity());
          entry.state.angularVelocity = tuple(entry.body.getAngularVelocity());
        }
      return {
        pose: structuredClone(state.pose),
        velocity: [...state.velocity],
        angularVelocity: [...state.angularVelocity],
        impacts,
        props: [...propBodies.values()].map((entry) =>
          structuredClone(entry.state),
        ),
      };
    },
  };
}
