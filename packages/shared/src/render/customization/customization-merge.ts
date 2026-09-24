/**
 * Pure merge and list-edit helpers behind the imperative customisation API.
 *
 * @module render/customization/customization-merge
 */
import type { ViewerCustomization } from './customization-types';

/**
 * Merge `patch` over `base`, one level deep: each section object (`ribbon`,
 * `options`, `backstage`, `contextMenu`, `keyboard`) merges field by field,
 * and within a section a list or record in `patch` REPLACES the one in
 * `base`. Top-level lists (`hiddenPanels`, `disabledFeatures`, ...) replace
 * too. A field explicitly set to `undefined` in `patch` clears it.
 */
export function mergeCustomization(
	base: ViewerCustomization,
	patch: ViewerCustomization,
): ViewerCustomization {
	const next: ViewerCustomization = { ...base };
	for (const key of Object.keys(patch) as Array<keyof ViewerCustomization>) {
		const value = patch[key];
		const current = base[key];
		if (
			value !== undefined &&
			!Array.isArray(value) &&
			typeof value === 'object' &&
			current !== undefined &&
			!Array.isArray(current) &&
			typeof current === 'object'
		) {
			(next as Record<string, unknown>)[key] = { ...current, ...value };
		} else {
			(next as Record<string, unknown>)[key] = value;
		}
	}
	return next;
}

/** `list` with `value` added (once) or removed. */
export function toggleInList<T>(list: readonly T[] | undefined, value: T, present: boolean): T[] {
	const current = list ?? [];
	const has = current.includes(value);
	if (present === has) {
		return [...current];
	}
	return present ? [...current, value] : current.filter((entry) => entry !== value);
}

/** `record` with `key` set to `value`, or removed when `value` is undefined. */
export function withRecordEntry<K extends string, V>(
	record: Partial<Record<K, V>> | undefined,
	key: K,
	value: V | undefined,
): Partial<Record<K, V>> {
	const next: Partial<Record<K, V>> = { ...record };
	if (value === undefined) {
		delete next[key];
	} else {
		next[key] = value;
	}
	return next;
}
