import { defineConfig, devices } from '@playwright/test';

const REACT_PORT = 4173;

/**
 * Deliberate React-only documentation asset jobs. These capture specs are kept
 * separate from the five-project, 26-file product test matrix.
 */
export default defineConfig({
	testDir: './e2e',
	testMatch: 'capture-*.spec.ts',
	testIgnore: ['**/fixtures/**', '**/global-setup.*'],
	globalSetup: './e2e/global-setup.ts',
	timeout: 60_000,
	expect: { timeout: 10_000 },
	reporter: 'list',
	use: { trace: 'retain-on-failure', actionTimeout: 10_000 },
	projects: [
		{
			name: 'react-capture',
			use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${REACT_PORT}` },
		},
	],
	webServer: {
		command: `npx vite --port ${REACT_PORT} --strictPort`,
		cwd: 'demos/demo-react',
		url: `http://localhost:${REACT_PORT}`,
		reuseExistingServer: true,
		timeout: 120_000,
		stdout: 'ignore',
		stderr: 'pipe',
	},
});
