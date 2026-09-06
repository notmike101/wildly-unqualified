/** Same-origin JSON requests; failures preserve the HTTP status for admission/retry handling. */
export async function api(path: string, body?: unknown) {
  const response = await fetch(
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(
      Error(result.error ?? `Request failed (${response.status})`),
      { status: response.status },
    );
  return result;
}
