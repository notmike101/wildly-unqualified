/** Bounded HTTP parsing, session-token extraction, path validation, and response helpers. */
import { type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
export class HTTPError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export const sameSecret = (a: string, b: string) =>
  timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
export const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
export function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}
export function body(request: IncomingMessage, max: number): Promise<Buffer> {
  if (Number(request.headers["content-length"] ?? 0) > max)
    return Promise.reject(new HTTPError(413, "Request body too large"));
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > max) {
        request.pause();
        reject(new HTTPError(413, "Request body too large"));
      } else chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", () =>
      reject(new HTTPError(400, "Interrupted request")),
    );
    request.on("aborted", () =>
      reject(new HTTPError(400, "Interrupted request")),
    );
  });
}
export async function fields(request: IncomingMessage, names: string[]) {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json")
    throw new HTTPError(415, "Expected application/json");
  let value: unknown;
  try {
    value = JSON.parse((await body(request, 2048)).toString("utf8"));
  } catch (error) {
    if (error instanceof HTTPError) throw error;
    throw new HTTPError(400, "Invalid JSON");
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== names.length ||
    Object.keys(value).some((key) => !names.includes(key))
  )
    throw new HTTPError(400, "Unexpected fields");
  return value as Record<string, unknown>;
}
export function token(request: IncomingMessage) {
  return (
    /(?:^|;\s*)wu_session=([a-f0-9]{64})(?:;|$)/.exec(
      request.headers.cookie ?? "",
    )?.[1] ?? ""
  );
}
export function safePath(request: IncomingMessage) {
  let path: string;
  try {
    path = decodeURIComponent((request.url ?? "/").split("?")[0]);
  } catch {
    throw new HTTPError(400, "Invalid path");
  }
  if (
    !path.startsWith("/") ||
    /[\\\x00-\x1f]/.test(path) ||
    path.split("/").some((p) => p === "." || p === "..") ||
    /%[0-9a-f]{2}/i.test(path)
  )
    throw new HTTPError(400, "Invalid path");
  return path;
}
