/**
 * Request a same-origin JSON endpoint using GET without a body or POST with a JSON body.
 * Error responses retain their HTTP status on the thrown error.
 *
 * @param path - Endpoint path
 * @param body - Optional JSON-serializable request body
 * @returns Parsed response JSON.
 * @throws {Error} A non-success response is received; its HTTP status is attached as
 * status. Network and JSON parsing failures also propagate.
 */
export async function api(path: string, body?: unknown) {
    const response = await fetch(
        path,
        body === undefined
            ? {}
            : {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                },
    );
    const result = await response.json();

    if (!response.ok)
        throw Object.assign(
            new Error(result.error ?? `Request failed (${response.status})`),
            { status: response.status },
        );

    return result;
}
