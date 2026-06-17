import { defineConfig, devices } from '@playwright/test';

/**
 * One e2e spec set, run against every framework demo.
 *
 * The specs in `e2e/*.spec.ts` target a framework-neutral DOM/test contract
 * (`#file-input`, `[data-pptx-element="true"]`, `[aria-roledescription="slide"]`,
 * `[data-inline-editor]`, `[data-testid="format-painter-toggle"]` + `data-active`,
 * `#slide-notes-content` / `textarea[name="slide-notes"]`, `aria-label="Adjust shape"`,
 * `[data-pptx-viewport]`, and accessible button names), which the React, Vue, and
 * Angular viewers all emit. Each project boots its own demo dev server and points
 * its `baseURL` at it, so `playwright test --project=react` / `--project=vue` /
 * `--project=angular` exercise the identical spec bodies.
 */
const REACT_PORT = 4173;
const VUE_PORT = 4175;
const ANGULAR_PORT = 4174;
const isCI = Boolean(process.env.CI);

export default defineConfig({
	testDir: './e2e',
	testIgnore: ['**/fixtures/**', '**/global-setup.*'],
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
	],
	webServer: [
		{
			command: `npx vite --port ${REACT_PORT} --strictPort`,
			cwd: 'demos/demo-react',
			url: `http://localhost:${REACT_PORT}`,
			reuseExistingServer: !isCI,
			timeout: 120_000,
			stdout: 'ignore',
			stderr: 'pipe',
		},
		{
			command: `npx vite --port ${VUE_PORT} --strictPort`,
			cwd: 'demos/demo-vue',
			url: `http://localhost:${VUE_PORT}`,
			reuseExistingServer: !isCI,
			timeout: 120_000,
			stdout: 'ignore',
			stderr: 'pipe',
		},
		{
			command: `npx vite --port ${ANGULAR_PORT} --strictPort`,
			cwd: 'demos/demo-angular',
			url: `http://localhost:${ANGULAR_PORT}`,
			reuseExistingServer: !isCI,
			timeout: 120_000,
			stdout: 'ignore',
			stderr: 'pipe',
		},
	],
});
