import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		include: ['src/**/*.test.{ts,tsx}'],
		/**
		 * Well above vitest's 5s default, because this package's integration
		 * tests load real multi-megabyte decks (`solution-explorer.pptx` and
		 * `issue-132-hr-deck.pptx` are the slow ones) through the full parse
		 * pipeline, and several round-trip them through save as well.
		 *
		 * At the default they passed on a warm developer machine and timed out
		 * on CI, which is the worst of both: green locally, red on push, and
		 * indistinguishable from a real regression in the log. A test that
		 * genuinely hangs now takes 30s to say so, which is the right trade for
		 * a package that reads binary fixtures.
		 *
		 * Individual tests may still raise this: `ooxml-crypto.test.ts` decrypts
		 * a 2.3 MB package at full key-derivation strength and declares its own
		 * budget.
		 */
		testTimeout: 30_000,
		hookTimeout: 30_000,
	},
});
