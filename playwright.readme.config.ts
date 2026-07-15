import { defineConfig, devices } from '@playwright/test';

const demos = [
	['react', 4173, 'demos/demo-react'],
	['vue', 4175, 'demos/demo-vue'],
	['angular', 4174, 'demos/demo-angular'],
	['vanilla', 4176, 'demos/demo-vanilla'],
	['svelte', 4177, 'demos/demo-svelte'],
] as const;

export default defineConfig({
	testDir: './e2e',
	testMatch: 'capture-package-readmes.spec.ts',
	globalSetup: './e2e/global-setup.ts',
	timeout: 90_000,
	reporter: 'list',
	workers: 1,
	use: {
		...devices['Desktop Chrome'],
		actionTimeout: 10_000,
		viewport: { width: 1280, height: 720 },
		video: { mode: 'on', size: { width: 1280, height: 720 } },
	},
	projects: demos.map(([name, port]) => ({
		name,
		use: { baseURL: `http://localhost:${port}` },
	})),
	webServer: demos.map(([, port, cwd]) => ({
		command: `npx vite --force --port ${port} --strictPort`,
		cwd,
		url: `http://localhost:${port}`,
		reuseExistingServer: true,
		timeout: 120_000,
		stdout: 'ignore' as const,
		stderr: 'pipe' as const,
	})),
});
