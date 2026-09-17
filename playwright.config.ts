import { defineConfig, devices } from '@playwright/test';

/**
 * One product e2e spec set, run against every framework demo.
 *
 * The product specs selected from `e2e/*.spec.ts` target a framework-neutral
 * DOM/test contract
 * (`#file-input`, `[data-pptx-element="true"]`, `[aria-roledescription="slide"]`,
 * `[data-inline-editor]`, `[data-testid="format-painter-toggle"]` + `data-active`,
 * `#slide-notes-content` / `textarea[name="slide-notes"]`, `aria-label="Adjust shape"`,
 * `[data-pptx-viewport]`, and accessible button names), which the React, Vue,
 * Angular, Vanilla, and Svelte viewers emit, with binding-neutral fallbacks
 * where accessible control names or ribbon semantics differ. Each project
 * boots its own demo dev server and points
 * its `baseURL` at it, so `playwright test --project=react` / `--project=vue` /
 * `--project=angular` / `--project=vanilla` / `--project=svelte` exercise the
 * identical product suite. Documentation capture jobs are intentionally
 * excluded and use `playwright.capture.config.ts` instead.
 *
 * Most specs ask whether a binding works. The `*-parity` specs ask the harder
 * question of whether the five AGREE, by driving several demos in one test and
 * diffing them against React. They get their ports and their per-project fan-out
 * from `e2e/support/`, which `scripts/check-e2e-neutrality.mjs` does not scan,
 * so those specs stay as framework-agnostic as every other one: no port
 * literals, no branching on the project name.
 */
const REACT_PORT = 4173;
const VUE_PORT = 4175;
const ANGULAR_PORT = 4174;
const VANILLA_PORT = 4176;
const SVELTE_PORT = 4177;
const isCI = Boolean(process.env.CI);

export default defineConfig({
	testDir: './e2e',
	// `packaged-present.spec.ts` is the production-BUILD smoke guard and needs
	// `vite preview` over each demo's built dist, not these dev servers; it runs
	// from `playwright.packaged.config.ts` instead.
	testIgnore: [
		'**/fixtures/**',
		'**/global-setup.*',
		'**/capture-*.spec.ts',
		'**/packaged-present.spec.ts',
	],
	globalSetup: './e2e/global-setup.ts',
	timeout: 60_000,
	expect: { timeout: 10_000 },
	fullyParallel: false,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		trace: 'retain-on-failure',
		actionTimeout: 10_000,
		// CI-only: GitHub Actions' ubuntu-latest runners have no real GPU, and
		// Chromium's software-GL (SwiftShader) compositing path is what actually
		// crashes under sustained canvas/video load there - `--disable-gpu` (not
		// `--disable-dev-shm-usage` alone, which was tried first and did not
		// help) is what fixes it. Root-caused by reproducing on a real Linux VM
		// constrained to the runner's actual 4 vCPU / 16 GB (a Windows or
		// over-provisioned Linux box never reproduces this): after ~30-50 tests
		// share one worker's Chromium instance, `export-raster-tiling.spec.ts`'s
		// video-recording test (canvas capture + MediaRecorder, GPU-accelerated
		// by default) reliably hit "Error: page.waitForEvent: Page crashed" -
		// a real Chromium renderer crash, not a timeout or a product bug. This
		// was the actual cause of the "the runner has received a shutdown
		// signal" e2e failures on vue/svelte/vanilla shards (2026-09-16/17):
		// neither shard count nor worker count fixed it because it depends on
		// cumulative load on one Chromium instance, not on any single test or on
		// peak concurrency. Left on for local dev too where isCI is false is
		// unnecessary (a real GPU is available and faster), so this only
		// applies in CI.
		launchOptions: isCI ? { args: ['--disable-dev-shm-usage', '--disable-gpu'] } : undefined,
	},
	projects: [
		{
			name: 'react',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${REACT_PORT}` },
		},
		{
			name: 'vue',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${VUE_PORT}` },
		},
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
		...Object.entries({
			react: REACT_PORT,
			vue: VUE_PORT,
			angular: ANGULAR_PORT,
			vanilla: VANILLA_PORT,
			svelte: SVELTE_PORT,
		}).map(([binding, port]) => ({
			name: `${binding}-headless`,
			metadata: { headless: true },
			testMatch: '**/host-owned-collaboration.spec.ts',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${port}` },
		})),
	],
	webServer: [
		{
			// Host-owned collaboration tests use the real relay, not BroadcastChannel.
			command: 'bun demos/demo-react/collab-server.mjs',
			port: 1234,
			reuseExistingServer: !isCI,
			timeout: 30_000,
			stdout: 'ignore',
			stderr: 'pipe',
		},
		{
			command: `npx vite --force --port ${REACT_PORT} --strictPort`,
			cwd: 'demos/demo-react',
			url: `http://localhost:${REACT_PORT}`,
			reuseExistingServer: !isCI,
			timeout: 120_000,
			stdout: 'ignore',
			stderr: 'pipe',
		},
		{
			command: `npx vite --force --port ${VUE_PORT} --strictPort`,
			cwd: 'demos/demo-vue',
			url: `http://localhost:${VUE_PORT}`,
			reuseExistingServer: !isCI,
			timeout: 120_000,
			stdout: 'ignore',
			stderr: 'pipe',
		},
		{
			command: `npx vite --force --port ${ANGULAR_PORT} --strictPort`,
			cwd: 'demos/demo-angular',
			url: `http://localhost:${ANGULAR_PORT}`,
			reuseExistingServer: !isCI,
			timeout: 120_000,
			stdout: 'ignore',
			stderr: 'pipe',
		},
		{
			command: `npx vite --force --port ${VANILLA_PORT} --strictPort`,
			cwd: 'demos/demo-vanilla',
			url: `http://localhost:${VANILLA_PORT}`,
			reuseExistingServer: !isCI,
			timeout: 120_000,
			stdout: 'ignore',
			stderr: 'pipe',
		},
		{
			command: `npx vite --force --port ${SVELTE_PORT} --strictPort`,
			cwd: 'demos/demo-svelte',
			url: `http://localhost:${SVELTE_PORT}`,
			reuseExistingServer: !isCI,
			timeout: 120_000,
			stdout: 'ignore',
			stderr: 'pipe',
		},
	],
});
