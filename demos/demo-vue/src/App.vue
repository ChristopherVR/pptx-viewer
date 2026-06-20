<script setup lang="ts">
import { PptxHandler } from 'pptx-viewer-core';
import { PowerPointViewer } from 'pptx-vue-viewer';
import type { PowerPointViewerExpose, ViewerTheme } from 'pptx-vue-viewer';
import 'pptx-vue-viewer/styles';
import { computed, ref, shallowRef } from 'vue';

/**
 * Demo app for `pptx-vue-viewer` — mirrors the React `demo/`.
 *
 * Loads a `.pptx` via drag-drop / file picker / "new presentation", renders it
 * with `<PowerPointViewer>`, and offers a theme switcher plus a download that
 * round-trips through the viewer's exposed `getContent()`.
 */

interface ThemePreset {
	label: string;
	theme: ViewerTheme;
}

const themes: Record<string, ThemePreset> = {
	dark: {
		label: 'Dark',
		theme: {
			colors: {
				background: '#030712',
				foreground: '#f3f4f6',
				card: '#111827',
				primary: '#6366f1',
				border: '#374151',
				mutedForeground: '#9ca3af',
			},
		},
	},
	light: {
		label: 'Light',
		theme: {
			colors: {
				background: '#f8fafc',
				foreground: '#0f172a',
				card: '#ffffff',
				primary: '#4f46e5',
				border: '#e2e8f0',
				mutedForeground: '#64748b',
			},
		},
	},
	midnight: {
		label: 'Midnight Blue',
		theme: {
			colors: {
				background: '#0c1222',
				foreground: '#e2e8f0',
				card: '#162032',
				primary: '#38bdf8',
				border: '#1e3a5f',
				mutedForeground: '#7dd3fc',
			},
		},
	},
};

const content = shallowRef<Uint8Array | null>(null);
const fileName = ref('');
const themeKey = ref<string>('dark');
const isBusy = ref(false);
const viewer = ref<PowerPointViewerExpose>();

// Opt in to the experimental Three.js SmartArt renderer via `?smartArt3D=1`.
const smartArt3D = new URLSearchParams(window.location.search).get('smartArt3D') === '1';

const activeTheme = computed(() => themes[themeKey.value]?.theme ?? themes.dark.theme);

function loadFile(file: File): void {
	fileName.value = file.name;
	const reader = new FileReader();
	reader.onload = () => {
		content.value = new Uint8Array(reader.result as ArrayBuffer);
	};
	reader.readAsArrayBuffer(file);
}

async function newPresentation(): Promise<void> {
	isBusy.value = true;
	try {
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Untitled Presentation',
			initialSlideCount: 1,
		});
		content.value = await handler.save(data.slides);
		fileName.value = 'Untitled Presentation';
	} finally {
		isBusy.value = false;
	}
}

function onDrop(e: DragEvent): void {
	e.preventDefault();
	const file = e.dataTransfer?.files?.[0];
	if (file?.name.endsWith('.pptx')) {
		loadFile(file);
	}
}

function onInputChange(e: Event): void {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) {
		loadFile(file);
	}
}

const fileInput = ref<HTMLInputElement>();
function browse(): void {
	fileInput.value?.click();
}

function close(): void {
	content.value = null;
	fileName.value = '';
}

async function download(): Promise<void> {
	if (!viewer.value) {
		return;
	}
	const bytes = await viewer.value.getContent();
	const blob = new Blob([bytes as BlobPart], {
		type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName.value.endsWith('.pptx')
		? fileName.value
		: `${fileName.value || 'presentation'}.pptx`;
	a.click();
	URL.revokeObjectURL(url);
}
</script>

<template>
	<div v-if="content" class="demo-shell">
		<header class="demo-bar">
			<span class="demo-file">{{ fileName }}</span>
			<div class="demo-actions">
				<label class="demo-theme">
					Theme
					<select v-model="themeKey">
						<option v-for="(preset, key) in themes" :key="key" :value="key">
							{{ preset.label }}
						</option>
					</select>
				</label>
				<button type="button" @click="download">Download .pptx</button>
				<button type="button" @click="close">Close</button>
			</div>
		</header>
		<div class="demo-viewer">
			<PowerPointViewer
				ref="viewer"
				:content="content"
				:theme="activeTheme"
				can-edit
				:smartArt3D="smartArt3D"
				@active-slide-change="(i: number) => console.log('slide', i)"
			/>
		</div>
	</div>

	<div
		v-else
		class="demo-dropzone"
		role="button"
		tabindex="0"
		@drop="onDrop"
		@dragover.prevent
		@click="browse"
		@keydown.enter="browse"
	>
		<h1>pptx-vue-viewer</h1>
		<p class="demo-hint">Drop a <code>.pptx</code> file here or click to browse</p>
		<p class="demo-sub">The file is processed entirely in the browser.</p>
		<button type="button" :disabled="isBusy" @click.stop="newPresentation">
			{{ isBusy ? 'Creating…' : 'or create a New Presentation' }}
		</button>
		<input
			id="file-input"
			ref="fileInput"
			type="file"
			accept=".pptx"
			aria-label="Upload PPTX file"
			style="display: none"
			@change="onInputChange"
		/>
	</div>
</template>

<style>
body {
	font-family:
		system-ui,
		-apple-system,
		'Segoe UI',
		Roboto,
		sans-serif;
	/* Never let demo chrome overflow horizontally — on mobile a wider-than-viewport
	   page expands the layout viewport and mis-anchors the viewer's fixed bottom bar. */
	overflow-x: hidden;
}

.demo-shell {
	display: flex;
	flex-direction: column;
	height: 100%;
}

.demo-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 0.5rem 1rem;
	padding: 0.5rem 1rem;
	background: #0b1220;
	color: #e2e8f0;
	border-bottom: 1px solid #1e293b;
}

.demo-file {
	font-weight: 600;
	font-size: 0.9rem;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.demo-actions {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 0.5rem 0.75rem;
}

.demo-theme {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	font-size: 0.8rem;
	color: #94a3b8;
}

.demo-bar select,
.demo-bar button {
	padding: 0.35rem 0.6rem;
	border-radius: 0.375rem;
	border: 1px solid #334155;
	background: #1e293b;
	color: #e2e8f0;
	font-size: 0.8rem;
	cursor: pointer;
}

.demo-viewer {
	flex: 1;
	min-height: 0;
}

.demo-dropzone {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.75rem;
	height: 100%;
	padding: 2rem;
	text-align: center;
	color: #cbd5e1;
	background: #030712;
	cursor: pointer;
}

.demo-dropzone h1 {
	margin: 0;
	font-size: 1.5rem;
	color: #6366f1;
}

.demo-hint {
	margin: 0;
	font-size: 1rem;
}

.demo-sub {
	margin: 0;
	font-size: 0.8rem;
	color: #64748b;
}

.demo-dropzone code {
	padding: 0.1rem 0.3rem;
	border-radius: 0.25rem;
	background: #1e293b;
	color: #818cf8;
}

.demo-dropzone button {
	margin-top: 0.5rem;
	padding: 0.5rem 1rem;
	border-radius: 0.5rem;
	border: 1px solid #334155;
	background: #1e293b;
	color: #e2e8f0;
	font-size: 0.85rem;
	cursor: pointer;
}

.demo-dropzone button:disabled {
	opacity: 0.5;
	cursor: default;
}
</style>
