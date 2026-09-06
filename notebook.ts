/** Notebook observations, shared album controls, and reserve map presentation. */
import type { Snapshot, Vec3 } from "./shared.ts";
import type { ReserveBlueprint } from "./world.ts";
/**
 * Look up a required page element using the caller's expected element type. The page markup
 * must supply this ID.
 *
 * @template T - Expected DOM element subtype; the markup must satisfy this assertion.
 * @param id - Required element ID
 * @returns The existing DOM element; no runtime null or type check is performed.
 */
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let albumSignature = "";

/**
 * Rebuild notebook observations and album controls from the snapshot, wiring favorite
 * requests through the supplied callback.
 *
 * @param latest - Latest snapshot, if installed
 * @param localId - Local player ID
 * @param commissionTitle - Commission ID-to-title resolver
 * @param onFavorite - Callback requesting a photo favorite toggle
 */
export function renderNotebook(
  latest: Snapshot | undefined,
  localId: string,
  commissionTitle: (id: string) => string,
  onFavorite: (photoId: string) => void,
) {
  if (!latest) return;
  $("observations").replaceChildren(
    ...(latest.observations.length
      ? latest.observations
      : [
          "An open tin attracts curious noses. Try rattling it in the woodland, then give the visitor space.",
          "The pond feeding patch is marked by a pale ring. Bring the tin.",
        ]
    ).map((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    }),
  );
  const signature = JSON.stringify([
    latest.album,
    latest.players.map((p) => [p.id, p.name]),
    localId,
  ]);
  if (signature === albumSignature) return;
  albumSignature = signature;
  $("album").replaceChildren();
  if (!latest.album.length) {
    const p = document.createElement("p");
    p.className = "fine";
    p.textContent =
      "The best evidence has not happened yet. Everyone can take pictures.";
    $("album").append(p);
  }
  for (const photo of [...latest.album].reverse()) {
    const f = document.createElement("figure");
    f.dataset.photoId = photo.id;
    if (photo.thumbnail === "ready") {
      const image = document.createElement("img");
      image.src = `/api/photos/${encodeURIComponent(photo.id)}`;
      image.alt = photo.credits.length
        ? photo.credits.map((c) => commissionTitle(c)).join(", ")
        : "A shared field photograph";
      image.loading = "lazy";
      f.append(image);
    } else {
      const pending = document.createElement("div");
      pending.className = "pending";
      pending.textContent = "Image pending · credit saved";
      f.append(pending);
    }
    const caption = document.createElement("figcaption");
    caption.textContent = `${latest.players.find((p) => p.id === photo.photographer)?.name ?? "Researcher"} · ${photo.credits.map((c) => commissionTitle(c)).join(" / ") || "Field moment"}${photo.assists.length ? " · helped by " + photo.assists.map((id) => latest!.players.find((p) => p.id === id)?.name ?? "a friend").join(", ") : ""}`;
    f.append(caption);
    if (photo.incident) {
      const incident = document.createElement("small");
      incident.className = "fine";
      incident.textContent =
        photo.incident === "hat"
          ? "Caught the hat thief"
          : "Spilled snacks, excellent evidence";
      f.append(incident);
    }
    if (photo.thumbnail === "ready") {
      const b = document.createElement("button");
      const selected = photo.favorites.includes(localId);
      b.textContent = selected ? "★ Favorite" : "☆ Favorite";
      b.setAttribute("aria-pressed", String(selected));
      /**
       * Request a favorite toggle for this album entry through the owning client.
       *
       * @returns No value after invoking the supplied callback.
       */
      b.onclick = () => onFavorite(photo.id);
      f.append(b);
      if (photo.favorites.length) {
        const crew = document.createElement("small");
        crew.className = "favorite-crew";
        crew.textContent =
          "Selected by " +
          photo.favorites
            .map(
              (id) =>
                latest!.players.find((p) => p.id === id)?.name ?? "Researcher",
            )
            .join(", ");
        f.append(crew);
      }
    }
    $("album").append(f);
  }
}
/**
 * Draw trails, water, habitats, equipment, and crew on the notebook canvas. Does nothing
 * until both snapshot and blueprint exist.
 *
 * @param latest - Latest snapshot, if installed
 * @param world - Matching blueprint, if installed
 * @param colors - Crew colors indexed by slot
 */
export function drawMap(
  latest: Snapshot | undefined,
  world: ReserveBlueprint | undefined,
  colors: readonly number[],
) {
  if (!latest || !world) return;
  const c = $<HTMLCanvasElement>("map").getContext("2d")!;
  c.fillStyle = "#e3ddbf";
  c.fillRect(0, 0, 360, 260);
  const scale = Math.min(
    336 / (world.bounds.max[0] - world.bounds.min[0]),
    236 / (world.bounds.max[2] - world.bounds.min[2]),
  );
  /**
   * Project horizontal world coordinates into the centered notebook map using its current
   * scale.
   *
   * @param p - World position whose X/Z components are used
   * @returns Canvas X/Y coordinates in pixels.
   */
  const point = (p: number[]) => [180 + p[0] * scale, 130 + p[2] * scale];
  c.strokeStyle = "#b0a16e";
  c.lineWidth = 3;
  for (const trail of world.trails) {
    c.beginPath();
    for (const [i, p] of trail.points.entries()) {
      const [x, y] = point(p);
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.stroke();
  }
  c.fillStyle = "#7f9f8f";
  for (const water of world.waters) {
    const a = point(water.min),
      b = point(water.max);
    c.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  }
  c.font = "9px system-ui";
  const labels: [string, Vec3][] = [
    ["CAMP", world.camp],
    ...world.stations.map((s) => ["SUPPLIES", s.position] as [string, Vec3]),
    ...world.pockets.map(
      (p) =>
        [p.id.toUpperCase() + " " + p.habitat, p.position] as [string, Vec3],
    ),
  ];
  const used: { x: number; y: number; width: number }[] = [];
  for (const [name, p] of labels) {
    const [x, y] = point(p),
      width = c.measureText(name).width;
    const positions = [-8, 16, -22, 30].flatMap((dy) =>
      [x - 18, x + 8, x - width - 8].map((dx) => ({
        x: Math.max(2, Math.min(358 - width, dx)),
        y: Math.max(12, Math.min(256, y + dy)),
        width,
      })),
    );
    const at =
      positions.find((a) =>
        used.every(
          (b) =>
            a.x + a.width + 4 < b.x ||
            b.x + b.width + 4 < a.x ||
            Math.abs(a.y - b.y) > 11,
        ),
      ) ?? positions[0];
    used.push(at);
    c.fillStyle = "#4b6144";
    c.fillText(name, at.x, at.y);
  }
  for (const node of world.navNodes.filter((n) => n.id.includes("-camera-"))) {
    const [x, y] = point(node.position);
    c.fillStyle = "#ad955b";
    c.fillRect(x - 1, y - 1, 2, 2);
  }
  latest.players
    .filter((p) => p.connected)
    .forEach((p) => {
      const [x, y] = point(p.position);
      c.fillStyle = `#${colors[p.slot].toString(16).padStart(6, "0")}`;
      c.beginPath();
      c.arc(x, y, 6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#142c24";
      c.font = "9px system-ui";
      c.fillText(String(p.slot + 1), x - 2.5, y + 3);
    });
  const [tx, ty] = point(latest.tin.pose.position);
  c.fillStyle = "#b2832d";
  c.fillRect(tx - 3, ty - 3, 6, 6);
}
