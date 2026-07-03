import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the framework-agnostic helpers (element-style, utils).
 *
 * These exercise pure TypeScript and do not require the Angular compiler.
 * Component/TestBed tests (which need `@analogjs/vite-plugin-angular`) are a
 * follow-up.
 */
export default defineConfig({
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.test.ts'],
		globals: true,
	},
});
