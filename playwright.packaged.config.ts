import { defineConfig, devices } from '@playwright/test';

/**
 * Production-build smoke run: the packaged-bundle counterpart of
 * `playwright.config.ts`.
 *
 * The product suite runs against demo DEV servers, which serve unbundled ES
 * modules straight from package source. That can never catch a defect
 * introduced by BUNDLING (tree-shaking a module-scope constant out, hoisting a
 * cross-chunk initialiser past its use, minifying a template literal into
 * nothing) - and a slide show whose `@keyframes` constant went missing renders
 * perfectly while animating nothing at all, which is precisely how a dead
 * deployed demo can ship green.
 *
 * So this config serves each demo's BUILT `dist/` with `vite preview`, the same
 * artifact `.github/workflows/docs.yml` publishes to GitHub Pages, and runs
 * `e2e/packaged-present.spec.ts` against all five bindings.
 *
 * Prerequisite: the library dists and the demo dists must already be built
 * (`bun run build` then `bun run --filter 'pptx-*-demo' build`); see the
 * `e2e-packaged` job in `.github/workflows/ci.yml`.
 */
const REACT_PORT = 4183;
const VUE_PORT = 4185;
const ANGULAR_PORT = 4184;
const VANILLA_PORT = 4186;
const SVELTE_PORT = 4187;
const isCI = Boolean(process.env.CI);

const preview = (cwd: string, port: number) => ({
	command: `npx vite preview --port ${port} --strictPort`,
	cwd,
	url: `http://localhost:${port}`,
	reuseExistingServer: !isCI,
	timeout: 120_000,
	stdout: 'ignore' as const,
	stderr: 'pipe' as const,
});

export default defineConfig({
	testDir: './e2e',
	testMatch: ['packaged-present.spec.ts'],
	// Generates the synthetic fixtures (the transitions deck is one of them) and
	// asserts the dists this run depends on are not stale.
	globalSetup: './e2e/global-setup.ts',
	timeout: 120_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	forbidOnly: isCI,
	retries: isCI ? 1 : 0,
	reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		trace: 'retain-on-failure',
		actionTimeout: 15_000,
	},
	projects: [
		{
			name: 'react',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${REACT_PORT}` },
		},
		{ name: 'vue', use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${VUE_PORT}` } },
		{
			name: 'angular',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${ANGULAR_PORT}` },
		},
		{
			name: 'vanilla',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${VANILLA_PORT}` },
		},
		{
			name: 'svelte',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${SVELTE_PORT}` },
		},
	],
	webServer: [
		preview('demos/demo-react', REACT_PORT),
		preview('demos/demo-vue', VUE_PORT),
		preview('demos/demo-angular', ANGULAR_PORT),
		preview('demos/demo-vanilla', VANILLA_PORT),
		preview('demos/demo-svelte', SVELTE_PORT),
	],
});
