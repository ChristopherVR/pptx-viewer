import { defineConfig } from 'vite';

export default defineConfig({
	root: __dirname,
	server: {
		port: 4173,
		open: true,
	},
	resolve: {
		alias: {
			'pptx-viewer': '../src/index.ts',
		},
	},
});
