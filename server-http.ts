/** Bounded HTTP parsing, session-token extraction, path validation, and response helpers. */
import { type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
/**
 * Represent an intentional HTTP failure with a response status and a client-facing message.
 * Avoid putting private diagnostic details in the message.
 */
export class HTTPError extends Error {
  status: number;
  /**
   * Create an HTTP error whose message can be returned to the requesting client.
   *
   * @param status - HTTP response status
   * @param message - Client-safe explanation
   */
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
/**
 * Compare fixed-length SHA-256 digests with a timing-safe primitive so source secret
 * lengths need not match.
 *
 * @param a - First secret
 * @param b - Second secret
 * @returns Whether the secret digests are equal.
 */
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
/**
 * Set the JSON content type and status, serialize the body, and end the response.
 *
 * @param response - Writable HTTP response
 * @param status - HTTP response status
 * @param value - JSON-serializable response body
 * @throws {TypeError} The value cannot be JSON-serialized, for example because it contains
 * cycles or BigInt.
 */
export function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}
/**
 * Read a bounded request body, checking both declared and streamed length. Pauses the
 * stream after exceeding the limit.
 *
 * @param request - Incoming request stream
 * @param max - Maximum body size in bytes
 * @returns Concatenated request bytes.
 * @throws {HTTPError} Rejects with 413 for an oversized body or 400 for an
 * interrupted/aborted request.
 */
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
/**
 * Read at most 2 KiB of JSON and require an object with exactly the named fields. Field
 * values are validated by the caller.
 *
 * @param request - Incoming JSON request
 * @param names - Exact permitted and required field names
 * @returns Parsed field object retaining unvalidated values.
 * @throws {HTTPError} Content type is unsupported, JSON or fields are invalid, or body
 * reading fails.
 */
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
/**
 * Extract a correctly shaped wu_session cookie without authenticating it.
 *
 * @param request - Incoming request whose Cookie header is inspected
 * @returns The 64-character hexadecimal session token, or an empty string.
 */
export function token(request: IncomingMessage) {
  return (
    /(?:^|;\s*)wu_session=([a-f0-9]{64})(?:;|$)/.exec(
      request.headers.cookie ?? "",
    )?.[1] ?? ""
  );
}
/**
 * Decode the request pathname once and reject traversal, control characters, backslashes,
 * and residual percent escapes. Query text is discarded.
 *
 * @param request - Incoming request URL
 * @returns Validated absolute URL pathname; filesystem containment must still be checked by
 * the caller.
 * @throws {HTTPError} The path is malformed or contains a forbidden path form; status is
 * 400.
 */
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
