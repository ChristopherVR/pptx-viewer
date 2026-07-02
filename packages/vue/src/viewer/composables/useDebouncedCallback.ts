/**
 * useDebouncedCallback: a small, strongly typed trailing-edge debounce for use
 * inside `<script setup>`. Repeated calls within `delay` ms collapse into a
 * single invocation carrying the most recent arguments.
 *
 * The returned function exposes `cancel` (drop any pending call) and `flush`
 * (run any pending call immediately). Any pending timer is cleared when the
 * owning component's reactive scope is disposed, so callers do not have to.
 */
import { onScopeDispose } from 'vue';

/** A debounced function plus its `cancel` / `flush` controls. */
export interface DebouncedCallback<A extends readonly unknown[]> {
	(...args: A): void;
	/** Discard any pending trailing call. */
	cancel: () => void;
	/** Run any pending trailing call right away. */
	flush: () => void;
}

/**
 * Wrap `callback` so it only fires once calls stop for `delay` ms.
 *
 * @param callback the function to debounce.
 * @param delay    quiet-period in milliseconds (defaults to 180ms).
 */
export function useDebouncedCallback<A extends readonly unknown[]>(
	callback: (...args: A) => void,
	delay = 180,
): DebouncedCallback<A> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let pending: A | undefined;

	const cancel = (): void => {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
		pending = undefined;
	};

	const run = (): void => {
		timer = undefined;
		if (pending !== undefined) {
			const args = pending;
			pending = undefined;
			callback(...args);
		}
	};

	const flush = (): void => {
		if (timer !== undefined) {
			clearTimeout(timer);
			run();
		}
	};

	const debounced = ((...args: A): void => {
		pending = args;
		if (timer !== undefined) {
			clearTimeout(timer);
		}
		timer = setTimeout(run, delay);
	}) as DebouncedCallback<A>;

	debounced.cancel = cancel;
	debounced.flush = flush;

	onScopeDispose(cancel);

	return debounced;
}
