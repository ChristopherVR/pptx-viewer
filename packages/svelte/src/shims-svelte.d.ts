/**
 * Ambient `*.svelte` module shim for the PLAIN TypeScript compiler only
 * (vite-plugin-dts / tsc), which cannot resolve `.svelte` files. It is
 * excluded from the main tsconfig so `svelte-check` keeps using the real,
 * precisely-typed component modules.
 *
 * Public component exports go through an explicitly-typed wrapper (see
 * `viewer/component.ts`), so the loose type here never leaks into the
 * published declaration files.
 */
declare module '*.svelte' {
	import type { Component } from 'svelte';

	const component: Component<Record<string, unknown>>;
	export default component;
}
