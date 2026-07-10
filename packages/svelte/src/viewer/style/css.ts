import type { CssStyleMap } from 'pptx-viewer-shared';

/**
 * Convert the shared render helpers' camelCase style maps (`CssStyleMap`)
 * into inline `style` attribute strings, which is how Svelte binds dynamic
 * styles. React/Vue spread the maps directly; this is the Svelte adapter.
 */

/** camelCase (or vendor-prefixed `WebkitFoo`) property name to CSS kebab-case. */
export function cssPropertyName(key: string): string {
	if (key.startsWith('--')) {
		return key;
	}
	// `WebkitBoxReflect` -> `-webkit-box-reflect`; `zIndex` -> `z-index`.
	return key.replace(/[A-Z]/gu, (match) => `-${match.toLowerCase()}`);
}

/** Serialise a style map into a `style` attribute string. */
export function styleToString(style: CssStyleMap | undefined): string {
	if (!style) {
		return '';
	}
	const declarations: string[] = [];
	for (const [key, value] of Object.entries(style)) {
		if (value === undefined || value === null || value === '') {
			continue;
		}
		declarations.push(`${cssPropertyName(key)}: ${String(value)}`);
	}
	return declarations.join('; ');
}

/** Merge any number of style maps (later maps win) into one attribute string. */
export function mergeStyles(...styles: Array<CssStyleMap | undefined>): CssStyleMap {
	const merged: CssStyleMap = {};
	for (const style of styles) {
		if (style) {
			Object.assign(merged, style);
		}
	}
	return merged;
}
