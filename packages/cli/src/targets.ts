import {
	ANGULAR_APP_TS,
	ANGULAR_GLOBAL_CSS,
	ANGULAR_MAIN_TS,
	MINIMAL_APP_CSS,
	REACT_APP_TSX,
	REACT_I18N_TS,
	SVELTE_APP_SVELTE,
	VANILLA_MAIN_TS,
	VUE_APP_VUE,
	VUE_MAIN_TS,
} from './templates';

/** Framework version this target's peer dependency requires, for a compatibility check against an existing project. */
export interface FrameworkCompat {
	/** npm package name to look for in the user's project, e.g. `react`, `vue`, `@angular/core`. */
	peerPackage: string;
	requiredMajor: number;
}

/** How to bootstrap a brand-new starter project for this target. */
export interface ScaffoldRecipe {
	/** `npx <command> ...args(dir)` bootstraps the base project (Vite, Angular CLI, ...). */
	command: string;
	/** Full argv (including the project directory, wherever the underlying tool expects it) for a given directory name. */
	args: (dir: string) => string[];
	/** Companion packages to add on top of what the framework's own scaffolder already installs. */
	extraPackages: string[];
	/** Entry-file paths (relative to the project dir) to try, in order; the first that exists gets overwritten. */
	entryCandidates: string[];
	entryContent: string;
	/** Additional files to write after scaffolding (relative path -> content). Used for i18n setup, main.ts overrides, etc. */
	extraFiles?: Record<string, string>;
	/**
	 * Optional feature groups the user is prompted about during `--scaffold`.
	 * Each entry shows a confirmation question; the packages are appended to
	 * `extraPackages` when the user accepts (default: yes). In non-interactive
	 * mode (`--yes` or piped stdin) the group is included when `defaultInclude`
	 * is `true` (the default).
	 */
	optionalExtras?: Array<{
		/** Confirmation question shown to the user. */
		prompt: string;
		/** Packages to install when the user opts in. */
		packages: string[];
		/** Whether to auto-include in non-interactive / --yes mode. Defaults to `true`. */
		defaultInclude?: boolean;
	}>;
	/**
	 * Optional pre-flight check invoked before the project-name prompt and the
	 * "Continue?" confirmation. Throw an `Error` with a human-readable message
	 * to abort scaffolding before any interactive prompts are shown.
	 */
	preflight?: () => void;
}

/** One thing a user can scaffold: a UI binding, the bare engine, or the MCP server. */
export interface Target {
	id: string;
	label: string;
	description: string;
	/** How `run()` should hand this target off after it is picked. */
	mode: 'install' | 'print-config';
	/** npm package names to install when adding this target to an existing project. */
	packages: string[];
	/** Printed after a successful install (or instead of installing, for `print-config`). */
	nextSteps: string;
	/** Present for UI framework targets: enables the installed-version compatibility check. */
	compat?: FrameworkCompat;
	/** Present for UI framework targets: enables "scaffold a new project" mode. */
	scaffold?: ScaffoldRecipe;
	/** Targets sharing a `group` are mutually exclusive: the UI bindings aren't meant to be picked together. */
	group?: string;
}

/** Collaboration optional extra shared by all UI-binding scaffolds. */
const COLLAB_EXTRAS: NonNullable<ScaffoldRecipe['optionalExtras']> = [
	{
		prompt: 'Include real-time collaboration? (adds yjs, y-websocket, y-webrtc)',
		packages: ['yjs', 'y-websocket', 'y-webrtc'],
		// defaultInclude is true (the default) - demo apps ship with collab packages.
	},
];

export const TARGETS: Target[] = [
	{
		id: 'react',
		label: 'React',
		description: 'pptx-react-viewer - viewer/editor component for a React 19 app',
		mode: 'install',
		group: 'framework',
		packages: [
			'pptx-react-viewer',
			'react',
			'react-dom',
			'framer-motion',
			'lucide-react',
			'react-icons',
			'jspdf',
			'jszip',
			'fast-xml-parser',
			'i18next',
			'react-i18next',
		],
		nextSteps: `import { PowerPointViewer } from 'pptx-react-viewer';
import 'pptx-react-viewer/styles.css';

<PowerPointViewer content={arrayBuffer} canEdit />

Docs: https://www.npmjs.com/package/pptx-react-viewer`,
		compat: { peerPackage: 'react', requiredMajor: 19 },
		scaffold: {
			command: 'create-vite@latest',
			// --no-interactive/--no-immediate stop create-vite from prompting for a linter
			// choice and then auto-installing + auto-starting its own dev server; if it did,
			// that dev server would block forever and our own entry-file patch + extra
			// package install below would never run, leaving the default Vite template in place.
			args: (dir) => [dir, '--template', 'react-ts', '--no-interactive', '--no-immediate'],
			extraPackages: [
				'pptx-react-viewer',
				'pptx-viewer-core',
				'framer-motion',
				'lucide-react',
				'react-icons',
				'jspdf',
				'jszip',
				'fast-xml-parser',
				'i18next',
				'react-i18next',
			],
			entryCandidates: ['src/App.tsx'],
			entryContent: REACT_APP_TSX,
			extraFiles: {
				'src/i18n.ts': REACT_I18N_TS,
				'src/index.css': MINIMAL_APP_CSS,
			},
			optionalExtras: COLLAB_EXTRAS,
		},
	},
	{
		id: 'vue',
		label: 'Vue',
		description: 'pptx-vue-viewer - viewer/editor component for a Vue 3.5+ app',
		mode: 'install',
		group: 'framework',
		packages: ['pptx-vue-viewer', 'vue', 'jszip', 'fast-xml-parser'],
		nextSteps: `<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import 'pptx-vue-viewer/styles.css';
</script>

<template>
  <PowerPointViewer :content="content" style="height: 100vh" />
</template>

Docs: https://www.npmjs.com/package/pptx-vue-viewer`,
		compat: { peerPackage: 'vue', requiredMajor: 3 },
		scaffold: {
			command: 'create-vite@latest',
			args: (dir) => [dir, '--template', 'vue-ts', '--no-interactive', '--no-immediate'],
			extraPackages: [
				'pptx-vue-viewer',
				'pptx-viewer-core',
				'vue-i18n',
				'jszip',
				'fast-xml-parser',
			],
			entryCandidates: ['src/App.vue'],
			entryContent: VUE_APP_VUE,
			extraFiles: { 'src/main.ts': VUE_MAIN_TS },
			optionalExtras: COLLAB_EXTRAS,
		},
	},
	{
		id: 'angular',
		label: 'Angular',
		description: 'pptx-angular-viewer - viewer/editor component for an Angular 22+ app',
		mode: 'install',
		group: 'framework',
		packages: ['pptx-angular-viewer', '@angular/core', '@angular/common', 'rxjs'],
		nextSteps: `import { PowerPointViewerComponent } from 'pptx-angular-viewer';
import 'pptx-angular-viewer/styles.css';

<pptx-power-point-viewer [content]="content" />

Docs: https://www.npmjs.com/package/pptx-angular-viewer`,
		compat: { peerPackage: '@angular/core', requiredMajor: 22 },
		scaffold: {
			command: '@angular/cli@latest',
			// --no-interactive matters even with the flags above supplied: the
			// `application` schematic's `ssr` option has an `x-prompt`, and `ng new`
			// prompts for it (plus anything else not already given a value) whenever
			// stdin is a TTY, which ours is (we inherit the real user's terminal).
			args: (dir) => [
				'new',
				dir,
				'--standalone',
				'--skip-git',
				'--style=css',
				'--skip-install',
				'--no-interactive',
			],
			extraPackages: ['pptx-angular-viewer', 'pptx-viewer-core', '@ngx-translate/core'],
			// Angular v20+ generates `app.ts`; older schematics generate `app.component.ts`.
			entryCandidates: ['src/app/app.ts', 'src/app/app.component.ts'],
			entryContent: ANGULAR_APP_TS,
			extraFiles: { 'src/main.ts': ANGULAR_MAIN_TS, 'src/styles.css': ANGULAR_GLOBAL_CSS },
			// @angular/cli@22 requires Node.js >=22.22.0, >=24.13.1, or >=26.0.0. Check
			// BEFORE the project-name prompt so the user sees the real reason immediately.
			preflight: () => {
				const node = process.versions.node;
				const [maj, min, pat] = node.split('.').map(Number);
				const ok =
					(maj === 22 && min >= 22) ||
					(maj === 24 && (min > 13 || (min === 13 && pat >= 1))) ||
					maj >= 26;
				if (!ok) {
					throw new Error(
						`@angular/cli@latest requires Node.js v22.22.0+, v24.13.1+, or v26.0.0+.\n` +
							`  You are running Node.js v${node}.\n` +
							`  Update Node.js at: https://nodejs.org`,
					);
				}
			},
			optionalExtras: COLLAB_EXTRAS,
		},
	},
	{
		id: 'svelte',
		label: 'Svelte',
		description: 'pptx-svelte-viewer - viewer/editor component for a Svelte 5 app',
		mode: 'install',
		group: 'framework',
		packages: ['pptx-svelte-viewer', 'svelte', 'jszip', 'fast-xml-parser'],
		// The Svelte binding compiles its styles into the components, so there
		// is no `/styles.css` subpath to import.
		nextSteps: `<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';
</script>

<PowerPointViewer source={bytes} editable />

Docs: https://www.npmjs.com/package/pptx-svelte-viewer`,
		compat: { peerPackage: 'svelte', requiredMajor: 5 },
		scaffold: {
			command: 'create-vite@latest',
			args: (dir) => [dir, '--template', 'svelte-ts', '--no-interactive', '--no-immediate'],
			extraPackages: ['pptx-svelte-viewer', 'pptx-viewer-core', 'jszip', 'fast-xml-parser'],
			entryCandidates: ['src/App.svelte'],
			entryContent: SVELTE_APP_SVELTE,
			// The starter's main.ts imports ./app.css; replace the Vite demo
			// styles (centred #app with padding) with a full-viewport reset.
			extraFiles: { 'src/app.css': MINIMAL_APP_CSS },
			optionalExtras: COLLAB_EXTRAS,
		},
	},
	{
		id: 'vanilla',
		label: 'Vanilla JS',
		description:
			'pptx-vanilla-viewer - zero-framework viewer/editor, plain DOM, no framework at all',
		mode: 'install',
		group: 'framework',
		// The vanilla binding injects its own stylesheet at runtime; jszip and
		// fast-xml-parser are its only peers.
		packages: ['pptx-vanilla-viewer', 'jszip', 'fast-xml-parser'],
		nextSteps: `import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
  source: '/deck.pptx', // URL, ArrayBuffer, Uint8Array, Blob, or File
  editable: true,
});

Docs: https://www.npmjs.com/package/pptx-vanilla-viewer`,
		scaffold: {
			command: 'create-vite@latest',
			args: (dir) => [dir, '--template', 'vanilla-ts', '--no-interactive', '--no-immediate'],
			extraPackages: [
				'pptx-vanilla-viewer',
				'pptx-viewer-core',
				'three',
				'jszip',
				'fast-xml-parser',
			],
			entryCandidates: ['src/main.ts'],
			entryContent: VANILLA_MAIN_TS,
			// main.ts imports ./style.css; replace the Vite demo styles with a
			// full-viewport reset.
			extraFiles: { 'src/style.css': MINIMAL_APP_CSS },
			optionalExtras: COLLAB_EXTRAS,
		},
	},
	{
		id: 'core',
		label: 'Core engine only',
		description: 'pptx-viewer-core - framework-agnostic parse/edit/save/convert SDK, no UI',
		mode: 'install',
		// jszip and fast-xml-parser are regular dependencies of pptx-viewer-core,
		// so npm/yarn/pnpm/bun pull them in automatically. Nothing else to add.
		packages: ['pptx-viewer-core'],
		nextSteps: `import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(arrayBuffer);
const bytes = await handler.save(data.slides);

Docs: https://www.npmjs.com/package/pptx-viewer-core`,
	},
	{
		id: 'mcp',
		label: 'MCP server',
		description: 'pptx-viewer-mcp - PowerPoint editing tools for AI agents (Claude, Cursor, ...)',
		mode: 'print-config',
		packages: ['pptx-viewer-mcp'],
		nextSteps: `Add this to your MCP client config (Claude Desktop, Claude Code, Cursor, ...):

{
  "mcpServers": {
    "pptx": {
      "command": "npx",
      "args": ["pptx-viewer-mcp"]
    }
  }
}

npx downloads pptx-viewer-mcp (and its bundled pptx-viewer-core engine) the
first time your MCP client starts it, so there is nothing to install by hand.

Docs: https://www.npmjs.com/package/pptx-viewer-mcp`,
	},
];
