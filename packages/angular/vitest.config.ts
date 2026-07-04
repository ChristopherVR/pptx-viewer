import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the framework-agnostic helpers (element-style, utils), plus
 * `.component.ts` files imported for their co-located pure-logic exports (see
 * `vitest-setup.ts` for why that needs the Angular compiler loaded).
 *
 * Full TestBed rendering (mounting a component into a real DOM) is a bigger
 * follow-up: it needs `@analogjs/vite-plugin-angular` to give `@Component`
 * classes real `ɵcmp` factories, which is a broader change than loading the
 * JIT compiler for these import-time-only tests.
 */
export default defineConfig({
	test: {
		environment: 'happy-dom',
		include: ['src/**/*.test.ts'],
		globals: true,
		setupFiles: ['./vitest-setup.ts'],
	},
});
