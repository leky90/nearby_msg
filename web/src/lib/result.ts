/**
 * Result type for type-safe error handling
 * Provides a functional approach to error handling without exceptions
 */

export type Result<T, E = Error> =
	| { ok: true; value: T }
	| { ok: false; error: E };

/**
 * Creates a successful Result
 */
export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

/**
 * Creates a failed Result
 */
export function err<E>(error: E): Result<never, E> {
	return { ok: false, error };
}

/**
 * Checks if Result is successful
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
	return result.ok;
}

/**
 * Checks if Result is failed
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
	return !result.ok;
}

/**
 * Maps over a successful Result
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
	if (result.ok) {
		return ok(fn(result.value));
	}
	return result;
}

/**
 * Maps over a failed Result
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
	if (!result.ok) {
		return err(fn(result.error));
	}
	return result;
}

/**
 * Unwraps a Result, throwing if it's an error
 * Use with caution - prefer pattern matching or map
 */
export function unwrap<T, E>(result: Result<T, E>): T {
	if (result.ok) {
		return result.value;
	}
	throw result.error;
}

/**
 * Unwraps a Result, returning a default value if it's an error
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
	if (result.ok) {
		return result.value;
	}
	return defaultValue;
}
