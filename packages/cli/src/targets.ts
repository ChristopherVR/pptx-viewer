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
}

// Mirrors the demo apps (demos/demo-react, demo-vue, demo-angular): a picker
// to open an existing .pptx, or a "New Presentation" button that hands the
// viewer a freshly built blank deck via PptxHandler.createBlank, so the
// scaffolded app actually shows a working PowerPoint presentation right away
// instead of a bare, empty file input.
const REACT_APP_TSX = `import { useCallback, useState } from 'react';
import { PptxHandler } from 'pptx-viewer-core';
import { PowerPointViewer } from 'pptx-react-viewer';
import 'pptx-react-viewer/styles';

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
		<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, height: '100vh' }}>
			<input
				type="file"
				accept=".pptx"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) loadFile(file);
				}}
			/>
			<button onClick={() => void newPresentation()}>or create a New Presentation</button>
		</div>
	);
}
`;

const VUE_APP_VUE = `<script setup lang="ts">
import { ref } from 'vue';
import { PptxHandler } from 'pptx-viewer-core';
import { PowerPointViewer } from 'pptx-vue-viewer';
import 'pptx-vue-viewer/styles';

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
	<div v-else style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; height: 100vh">
		<input type="file" accept=".pptx" @change="onPick" />
		<button @click="newPresentation">or create a New Presentation</button>
	</div>
</template>
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
			<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; height: 100vh">
				<input type="file" accept=".pptx" (change)="onPick($event)" />
				<button (click)="newPresentation()">or create a New Presentation</button>
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

export const TARGETS: Target[] = [
	{
		id: 'react',
		label: 'React',
		description: 'pptx-react-viewer - viewer/editor component for a React 19 app',
		mode: 'install',
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
import 'pptx-react-viewer/styles';

<PowerPointViewer content={arrayBuffer} canEdit />

Docs: https://www.npmjs.com/package/pptx-react-viewer`,
		compat: { peerPackage: 'react', requiredMajor: 19 },
		scaffold: {
			command: 'create-vite@latest',
			args: (dir) => [dir, '--template', 'react-ts'],
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
		},
	},
	{
		id: 'vue',
		label: 'Vue',
		description: 'pptx-vue-viewer - viewer/editor component for a Vue 3.5+ app',
		mode: 'install',
		packages: ['pptx-vue-viewer', 'vue', 'jszip', 'fast-xml-parser'],
		nextSteps: `<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import 'pptx-vue-viewer/styles';
</script>

<template>
  <PowerPointViewer :content="content" style="height: 100vh" />
</template>

Docs: https://www.npmjs.com/package/pptx-vue-viewer`,
		compat: { peerPackage: 'vue', requiredMajor: 3 },
		scaffold: {
			command: 'create-vite@latest',
			args: (dir) => [dir, '--template', 'vue-ts'],
			extraPackages: ['pptx-vue-viewer', 'pptx-viewer-core', 'jszip', 'fast-xml-parser'],
			entryCandidates: ['src/App.vue'],
			entryContent: VUE_APP_VUE,
		},
	},
	{
		id: 'angular',
		label: 'Angular',
		description: 'pptx-angular-viewer - viewer/editor component for an Angular 22+ app',
		mode: 'install',
		packages: ['pptx-angular-viewer', '@angular/core', '@angular/common', 'rxjs'],
		nextSteps: `import { PowerPointViewerComponent } from 'pptx-angular-viewer';
import 'pptx-angular-viewer/styles';

<pptx-power-point-viewer [content]="content" />

Docs: https://www.npmjs.com/package/pptx-angular-viewer`,
		compat: { peerPackage: '@angular/core', requiredMajor: 22 },
		scaffold: {
			command: '@angular/cli@latest',
			args: (dir) => ['new', dir, '--standalone', '--skip-git', '--style=css', '--skip-install'],
			extraPackages: ['pptx-angular-viewer', 'pptx-viewer-core'],
			// Angular v20+ generates `app.ts`; older schematics generate `app.component.ts`.
			entryCandidates: ['src/app/app.ts', 'src/app/app.component.ts'],
			entryContent: ANGULAR_APP_TS,
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
