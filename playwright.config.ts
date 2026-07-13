import { defineConfig, devices } from '@playwright/test';

/**
 * One e2e spec set, run against every framework demo.
 *
 * The specs in `e2e/*.spec.ts` target a framework-neutral DOM/test contract
 * (`#file-input`, `[data-pptx-element="true"]`, `[aria-roledescription="slide"]`,
 * `[data-inline-editor]`, `[data-testid="format-painter-toggle"]` + `data-active`,
 * `#slide-notes-content` / `textarea[name="slide-notes"]`, `aria-label="Adjust shape"`,
 * `[data-pptx-viewport]`, and accessible button names), which the React, Vue, and
 * Angular viewers emit, with binding-neutral fallbacks where accessible control
 * names or ribbon semantics differ. Each project boots its own demo dev server and points
 * its `baseURL` at it, so `playwright test --project=react` / `--project=vue` /
 * `--project=angular` exercise the identical spec bodies.
 *
 * `vanilla` and `svelte` now include editing ribbons, inspectors, dialogs,
 * mobile chrome, inline editing, save/export, and presentation behavior. Some
 * shared specs still encode binding-specific DOM details or cover capabilities
 * that are being completed independently, so those projects use the explicitly
 * verified list below. A spec is added only after the same semantic assertions
 * pass against both demos.
 */
const REACT_PORT = 4173;
const VUE_PORT = 4175;
const ANGULAR_PORT = 4174;
const VANILLA_PORT = 4176;
const SVELTE_PORT = 4177;
const isCI = Boolean(process.env.CI);

/**
 * Spec files verified to pass against both the vanilla and Svelte demos (see
 * this file's doc comment). Shared with `.github/workflows/
 * ci.yml`'s vanilla/svelte e2e matrix legs, which run this same file list.
 */
const VANILLA_SVELTE_FILES = [
	'vanilla-svelte-basics.spec.ts',
	'text-rendering.spec.ts',
	'absolute-path-rels.spec.ts',
	'text-descender-clip.spec.ts',
	'mobile-inline-edit.spec.ts',
	'mobile-table.spec.ts',
	'mobile-manipulation.spec.ts',
	'ole-and-ink.spec.ts',
	'format-painter.spec.ts',
	'mobile-notes.spec.ts',
];

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
			// The vanilla/svelte-only spec targets a narrower DOM contract (no
			// ribbon/inspectors) and is not written to run against React.
			testIgnore: ['vanilla-svelte-basics.spec.ts'],
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${REACT_PORT}` },
		},
		{
			name: 'vue',
			testIgnore: ['vanilla-svelte-basics.spec.ts'],
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${VUE_PORT}` },
		},
		{
			name: 'angular',
			testIgnore: ['vanilla-svelte-basics.spec.ts'],
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${ANGULAR_PORT}` },
		},
		{
			name: 'vanilla',
			testMatch: VANILLA_SVELTE_FILES,
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${VANILLA_PORT}` },
		},
		{
			name: 'svelte',
			testMatch: VANILLA_SVELTE_FILES,
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${SVELTE_PORT}` },
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
		{
			command: `npx vite --port ${VANILLA_PORT} --strictPort`,
			cwd: 'demos/demo-vanilla',
			url: `http://localhost:${VANILLA_PORT}`,
			reuseExistingServer: !isCI,
			timeout: 120_000,
			stdout: 'ignore',
			stderr: 'pipe',
		},
		{
			command: `npx vite --port ${SVELTE_PORT} --strictPort`,
			cwd: 'demos/demo-svelte',
			url: `http://localhost:${SVELTE_PORT}`,
			reuseExistingServer: !isCI,
			timeout: 120_000,
			stdout: 'ignore',
			stderr: 'pipe',
		},
	],
});
