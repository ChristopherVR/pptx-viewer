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
	/** Targets sharing a `group` are mutually exclusive: React, Vue, and Angular bindings aren't meant to be picked together. */
	group?: string;
}

// Mirrors the demo apps (demos/demo-react, demo-vue, demo-angular): a picker
// to open an existing .pptx, or a "New Presentation" button that hands the
// viewer a freshly built blank deck via PptxHandler.createBlank, so the
// scaffolded app actually shows a working PowerPoint presentation right away
// instead of a bare, empty file input.
//
// The style import uses the `/styles.css` subpath, not the extension-less
// `/styles` alias: Vite's ambient `declare module '*.css'` (from its
// `vite/client` types) only matches specifiers that literally end in
// `.css`, so the extension-less form fails `vue-tsc -b`/`tsc -b` in a fresh
// scaffold with "Cannot find module ... for side-effect import".
const REACT_APP_TSX = `import { useCallback, useState } from 'react';
import { PptxHandler } from 'pptx-viewer-core';
import { PowerPointViewer } from 'pptx-react-viewer';
import 'pptx-react-viewer/styles.css';
import './i18n';

export default function App() {
	const [content, setContent] = useState<Uint8Array | null>(null);

	const loadFile = useCallback((file: File) => {
		const reader = new FileReader();
		reader.onload = () => setContent(new Uint8Array(reader.result as ArrayBuffer));
		reader.readAsArrayBuffer(file);
	}, []);

	const newPresentation = useCallback(async () => {
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Untitled Presentation',
			initialSlideCount: 1,
		});
		setContent(await handler.save(data.slides));
	}, []);

	if (content) {
		return (
			<div style={{ height: '100vh' }}>
				<PowerPointViewer content={content} canEdit />
			</div>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
			<h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, color: '#e5e7eb' }}>Open a Presentation</h1>
			<label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, border: '1px solid #4b5563', background: '#1f2937', color: '#f3f4f6', cursor: 'pointer', fontSize: 14, transition: 'background 0.15s' }}>
				Choose .pptx file
				<input
					type="file"
					accept=".pptx"
					style={{ display: 'none' }}
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) loadFile(file);
					}}
				/>
			</label>
			<span style={{ color: '#6b7280', fontSize: 13 }}>or</span>
			<button
				onClick={() => void newPresentation()}
				style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
			>
				New Presentation
			</button>
		</div>
	);
}
`;

const REACT_I18N_TS = `import { createInstance } from 'i18next';
import { translationsEn, keyToLabel } from 'pptx-react-viewer/i18n';
import { initReactI18next } from 'react-i18next';

const i18n = createInstance();

i18n.use(initReactI18next).init({
	resources: {
		en: { translation: translationsEn },
	},
	lng: 'en',
	fallbackLng: 'en',
	interpolation: { escapeValue: false },
	parseMissingKeyHandler: (key: string) => keyToLabel(key),
	missingKeyHandler: false,
});

export default i18n;
`;
const REACT_INDEX_CSS = `:root {
  color-scheme: light dark;
}

body {
  margin: 0;
}
`;
const VUE_APP_VUE = `<script setup lang="ts">
import { ref } from 'vue';
import { PptxHandler } from 'pptx-viewer-core';
import { PowerPointViewer } from 'pptx-vue-viewer';
import 'pptx-vue-viewer/styles.css';

const content = ref<Uint8Array>();

function loadFile(file: File) {
	const reader = new FileReader();
	reader.onload = () => (content.value = new Uint8Array(reader.result as ArrayBuffer));
	reader.readAsArrayBuffer(file);
}

function onPick(e: Event) {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) loadFile(file);
}

async function newPresentation() {
	const { handler, data } = await PptxHandler.createBlank({
		title: 'Untitled Presentation',
		initialSlideCount: 1,
	});
	content.value = await handler.save(data.slides);
}
</script>

<template>
	<div v-if="content" style="height: 100vh">
		<PowerPointViewer :content="content" can-edit style="height: 100%" />
	</div>
	<div v-else style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; height: 100vh; font-family: system-ui, sans-serif">
		<h1 style="margin: 0; font-size: 24px; font-weight: 500; color: #e5e7eb">Open a Presentation</h1>
		<label style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; border: 1px solid #4b5563; background: #1f2937; color: #f3f4f6; cursor: pointer; font-size: 14px">
			Choose .pptx file
			<input type="file" accept=".pptx" style="display: none" @change="onPick" />
		</label>
		<span style="color: #6b7280; font-size: 13px">or</span>
		<button style="padding: 10px 20px; border-radius: 8px; border: none; background: #2563eb; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500" @click="newPresentation">New Presentation</button>
	</div>
</template>
`;

const VUE_MAIN_TS = `import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import { translationsEn, keyToLabel } from 'pptx-vue-viewer/i18n';
import App from './App.vue';

const i18n = createI18n({
	legacy: false,
	locale: 'en',
	fallbackLocale: 'en',
	messages: { en: translationsEn },
	missing: (_locale, key) => keyToLabel(key),
	missingWarn: false,
	fallbackWarn: false,
});

createApp(App).use(i18n).mount('#app');
`;

const ANGULAR_APP_TS = `import { Component, signal } from '@angular/core';
import { PptxHandler } from 'pptx-viewer-core';
import { PowerPointViewerComponent } from 'pptx-angular-viewer';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [PowerPointViewerComponent],
	template: \`
		@if (content(); as c) {
			<div style="height: 100vh">
				<pptx-power-point-viewer [content]="c" [canEdit]="true" style="height: 100%" />
			</div>
		} @else {
			<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; height: 100vh; font-family: system-ui, sans-serif">
				<h1 style="margin: 0; font-size: 24px; font-weight: 500; color: #e5e7eb">Open a Presentation</h1>
				<label style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; border: 1px solid #4b5563; background: #1f2937; color: #f3f4f6; cursor: pointer; font-size: 14px">
					Choose .pptx file
					<input type="file" accept=".pptx" style="display: none" (change)="onPick($event)" />
				</label>
				<span style="color: #6b7280; font-size: 13px">or</span>
				<button style="padding: 10px 20px; border-radius: 8px; border: none; background: #2563eb; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500" (click)="newPresentation()">New Presentation</button>
			</div>
		}
	\`,
})
export class App {
	content = signal<ArrayBuffer | Uint8Array | null>(null);

	async onPick(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) {
			this.content.set(await file.arrayBuffer());
		}
	}

	async newPresentation() {
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Untitled Presentation',
			initialSlideCount: 1,
		});
		this.content.set(await handler.save(data.slides));
	}
}
`;

const ANGULAR_MAIN_TS = `import 'zone.js';
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { Injectable } from '@angular/core';
import type { MissingTranslationHandlerParams } from '@ngx-translate/core';
import { MissingTranslationHandler, provideTranslateService } from '@ngx-translate/core';
import { keyToLabel } from 'pptx-angular-viewer';

import { App } from './app/app.ts';

@Injectable()
class LabelFallbackHandler implements MissingTranslationHandler {
	handle(params: MissingTranslationHandlerParams): string {
		return keyToLabel(params.key);
	}
}

bootstrapApplication(App, {
	providers: [
		provideTranslateService({
			lang: 'en',
			fallbackLang: 'en',
			missingTranslationHandler: {
				provide: MissingTranslationHandler,
				useClass: LabelFallbackHandler,
			},
		}),
	],
}).catch((err) => console.error(err));
`;

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
				'src/index.css': REACT_INDEX_CSS,
			},
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
			extraFiles: { 'src/main.ts': ANGULAR_MAIN_TS },
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
