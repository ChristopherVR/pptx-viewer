import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * Svelte config shared by the Vite build, Vitest, and svelte-check.
 *
 * - `vitePreprocess` handles `<script lang="ts">` blocks.
 * - `runes: true` opts the whole package into Svelte 5 runes mode (no legacy
 *   reactivity), matching how the components are written.
 */
export default {
	preprocess: vitePreprocess(),
	compilerOptions: {
		runes: true,
	},
};
