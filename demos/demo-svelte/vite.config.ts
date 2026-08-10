import { resolve } from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import { buildStamp } from '../build-stamp';

/**
 * Vite dev server / build for the pptx-svelte-viewer demo.
 *
 * Mirrors the other demos: the bare package specifiers are aliased to the
 * library **source** so the demo hot-reloads against live edits without a
 * rebuild. The svelte plugin compiles both the demo and the aliased
 * `pptx-svelte-viewer` SFCs.
 */
const pkg = (...p: string[]) => resolve(__dirname, '..', '..', 'packages', ...p);

export default defineConfig({
	root: __dirname,
	// Served from a subpath (e.g. /pptx-viewer/demo-svelte/) on GitHub Pages.
	base: process.env.DEMO_BASE ?? '/',
	// The repo-wide .gitignore excludes public/ dirs, so the sample deck is
	// served straight from the committed e2e fixtures instead.
	publicDir: resolve(__dirname, '..', '..', 'e2e', 'fixtures'),
	plugins: [svelte(), tailwindcss(), buildStamp(pkg('svelte', 'package.json'))],
	server: {
		port: 4177,
		open: true,
	},
	build: {
		chunkSizeWarningLimit: 2500,
	},
	resolve: {
		// Order matters: more specific subpath aliases must precede the bare ones.
		alias: [
			{ find: 'pptx-svelte-viewer/i18n', replacement: pkg('svelte', 'src', 'i18n.ts') },
			{ find: 'pptx-svelte-viewer', replacement: pkg('svelte', 'src', 'index.ts') },
			{
				find: 'pptx-viewer-core/converter',
				replacement: pkg('core', 'src', 'converter', 'index.ts'),
			},
			{ find: 'pptx-viewer-core', replacement: pkg('core', 'src', 'index.ts') },
			{ find: 'pptx-viewer-locales', replacement: pkg('locales', 'src', 'index.ts') },
			{
				find: 'pptx-viewer-shared/smartart-3d',
				replacement: pkg('shared', 'src', 'smartart-3d', 'index.ts'),
			},
			{ find: 'pptx-viewer-shared/i18n', replacement: pkg('shared', 'src', 'i18n', 'index.ts') },
			{ find: 'pptx-viewer-shared/ai', replacement: pkg('shared', 'src', 'ai', 'index.ts') },
			{ find: 'pptx-viewer-shared', replacement: pkg('shared', 'src', 'index.ts') },
		],
	},
	optimizeDeps: {
		include: [
			'jszip',
			'fast-xml-parser',
			// The AI assistant panel (`components/ai/*.svelte`) is reached only
			// through the dynamic `import('./AiChatPanel.svelte')` boundary in
			// `AiDock.svelte`, and both `@ai-sdk/svelte` (a SECOND, independent
			// `import('@ai-sdk/svelte')` inside `chat.svelte.ts`'s session init) and
			// `@lucide/svelte`'s deep per-icon specifiers (`@lucide/svelte/icons/
			// <name>`, not one barrel package) live behind it too. Vite's cold-start
			// dependency scanner does not reliably crawl that far through a
			// multi-hop dynamic import into aliased monorepo source, so anything
			// used ONLY inside the AI panel is undiscovered at server start. The
			// first click of the toolbar's "Toggle AI assistant" then triggers
			// mid-session dependency discovery, which forces a full page reload and
			// silently drops the click that was supposed to open the panel (it
			// reopens fine on a second click, once the deps are optimized). Listing
			// them here pre-bundles them at startup instead, matching the jszip /
			// fast-xml-parser entries above for the same class of problem.
			'ai',
			'@ai-sdk/svelte',
			'@lucide/svelte/icons/bot',
			'@lucide/svelte/icons/bug',
			'@lucide/svelte/icons/chart-column',
			'@lucide/svelte/icons/check',
			'@lucide/svelte/icons/crosshair',
			'@lucide/svelte/icons/download',
			'@lucide/svelte/icons/eye',
			'@lucide/svelte/icons/film',
			'@lucide/svelte/icons/git-merge',
			'@lucide/svelte/icons/history',
			'@lucide/svelte/icons/layout-template',
			'@lucide/svelte/icons/loader-circle',
			'@lucide/svelte/icons/message-square',
			'@lucide/svelte/icons/message-square-plus',
			'@lucide/svelte/icons/move',
			'@lucide/svelte/icons/navigation',
			'@lucide/svelte/icons/palette',
			'@lucide/svelte/icons/pin',
			'@lucide/svelte/icons/pin-off',
			'@lucide/svelte/icons/plus',
			'@lucide/svelte/icons/search',
			'@lucide/svelte/icons/send',
			'@lucide/svelte/icons/shapes',
			'@lucide/svelte/icons/sparkles',
			'@lucide/svelte/icons/square',
			'@lucide/svelte/icons/sticky-note',
			'@lucide/svelte/icons/table',
			'@lucide/svelte/icons/trash-2',
			'@lucide/svelte/icons/triangle-alert',
			'@lucide/svelte/icons/type',
			'@lucide/svelte/icons/user',
			'@lucide/svelte/icons/wrench',
			'@lucide/svelte/icons/x',
		],
	},
});
