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
 * identical 26-file, 95-test product suite: 475 project executions. Documentation
 * capture jobs are intentionally excluded and use `playwright.capture.config.ts`
 * instead.
 */
const REACT_PORT = 4173;
const VUE_PORT = 4175;
const ANGULAR_PORT = 4174;
const VANILLA_PORT = 4176;
const SVELTE_PORT = 4177;
const isCI = Boolean(process.env.CI);

export default defineConfig({
	testDir: './e2e',
	testIgnore: ['**/fixtures/**', '**/global-setup.*', '**/capture-*.spec.ts'],
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
	],
	webServer: [
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
