/**
 * Turns the API service's `{ status, body }` rejections into Errors with a readable message,
 * since messaging only carries an Error's message across contexts.
 */
export function toError(err: any): Error {
    if (err instanceof Error) {
        return err;
    }
    const body = err?.body;
    const violations: string | undefined = Array.isArray(body?.violations)
        ? body.violations.map((v: any) => (v.propertyPath ? `${v.propertyPath}: ${v.message}` : v.message)).join('\n')
        : undefined;
    const detail = violations ?? body?.detail ?? body?.description ?? body?.title ?? (typeof body === 'string' ? body : undefined);
    return new Error(detail ? `${detail} (${err?.status})` : `Request failed (${err?.status ?? 'network error'})`);
}

/** Runs an API call for a message handler, rethrowing failures as readable Errors. */
export async function call<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } catch (err) {
        throw toError(err);
    }
}
