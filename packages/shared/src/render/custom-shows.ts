/**
 * custom-shows.ts: Immutable helpers and types for custom PowerPoint show lists.
 *
 * A "custom show" is a named subset of slides presented in a user-defined order.
 * Framework-agnostic: no React, Vue, or Angular imports. Shared across bindings.
 */

export interface CustomShow {
	id: string;
	name: string;
	slideIds: readonly string[];
}

export function generateCustomShowId(): string {
	const c = globalThis.crypto;
	if (c && typeof c.randomUUID === 'function') {
		return `show-${c.randomUUID()}`;
	}
	return `show-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createCustomShow(name: string, slideIds: readonly string[]): CustomShow {
	return { id: generateCustomShowId(), name: name.trim(), slideIds: [...slideIds] };
}
