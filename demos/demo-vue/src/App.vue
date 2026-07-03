<script setup lang="ts">
import { PptxHandler } from 'pptx-viewer-core';
import {
	PowerPointViewer,
	isAudienceTab,
	loadAudienceContent,
	themeToCssVars,
} from 'pptx-vue-viewer';
import type { CollaborationConfig } from 'pptx-vue-viewer';
import 'pptx-vue-viewer/styles';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watchEffect } from 'vue';

import {
	isTrustedServerUrl,
	randomUserColor,
	resolveAutoName,
	resolveAutoRoomId,
	resolveDefaultServerUrl,
} from './collab';
import i18n from './i18n';
import LanguagePicker from './LanguagePicker.vue';
import type { LanguageCode } from './languages';
import { languageKeys } from './languages';
import ThemePicker from './ThemePicker.vue';
import { themes } from './themes';

/**
 * Demo app for `pptx-vue-viewer`, mirroring the React `demo/main.tsx`.
 *
 * The viewer fills the screen; there is no demo header (download lives in the
 * viewer's File menu). A floating theme picker hovers above the viewer. URL
 * params drive collaboration / broadcast / audience joins.
 */

const content = shallowRef<Uint8Array | null>(null);
const fileName = ref('');
const fileInput = ref<HTMLInputElement>();

const themeKey = ref<string>(readStoredTheme());

function readStoredTheme(): string {
	try {
		return localStorage.getItem('pptx-demo-theme') ?? 'dark';
	} catch {
		return 'dark';
	}
}

const currentPreset = computed(() => themes[themeKey.value] ?? themes.dark);

function setTheme(key: string): void {
	themeKey.value = key;
	try {
		localStorage.setItem('pptx-demo-theme', key);
	} catch {
		/* ignore */
	}
}

// ── Language ────────────────────────────────────────────────────────────────
function readStoredLanguage(): LanguageCode {
	try {
		const stored = localStorage.getItem('pptx-demo-lang');
		return stored && languageKeys.includes(stored as LanguageCode)
			? (stored as LanguageCode)
			: 'en';
	} catch {
		return 'en';
	}
}

const languageKey = ref<LanguageCode>(readStoredLanguage());
watchEffect(() => {
	i18n.global.locale.value = languageKey.value;
});

function setLanguage(code: LanguageCode): void {
	languageKey.value = code;
	try {
		localStorage.setItem('pptx-demo-lang', code);
	} catch {
		/* ignore */
	}
}

// ── Apply theme vars to :root so the dropzone chrome tracks the theme ──────
let appliedVarKeys: string[] = [];
watchEffect(() => {
	const vars = themeToCssVars(currentPreset.value.theme);
	const root = document.documentElement;
	for (const key of appliedVarKeys) {
		root.style.removeProperty(key);
	}
	appliedVarKeys = Object.keys(vars);
	for (const key of appliedVarKeys) {
		root.style.setProperty(key, vars[key]);
	}
});
onBeforeUnmount(() => {
	const root = document.documentElement;
	for (const key of appliedVarKeys) {
		root.style.removeProperty(key);
	}
});

// ── URL-based collaboration / broadcast join ───────────────────────────────
const params = new URLSearchParams(window.location.search);
const urlRoom = ref(params.get('room'));
const urlBroadcast = ref(params.get('broadcast'));
const urlServer = params.get('server') ?? resolveDefaultServerUrl();
const urlName = params.get('name');
// Opt in to the experimental Three.js SmartArt renderer via `?smartArt3D=1`.
const smartArt3D = params.get('smartArt3D') === '1';

// Stable defaults for the Share dialog (demo-specific).
const autoRoomId = resolveAutoRoomId();
const autoName = resolveAutoName();
const defaultServerUrl = resolveDefaultServerUrl();

// ── Collaboration state ────────────────────────────────────────────────────
const collaborationConfig = shallowRef<CollaborationConfig | null>(null);

// Auto-connect if room is in URL (collaboration mode), only if server trusted.
watchEffect(() => {
	if (urlRoom.value && !collaborationConfig.value && isTrustedServerUrl(urlServer)) {
		collaborationConfig.value = {
			roomId: urlRoom.value,
			serverUrl: urlServer,
			userName: urlName ?? autoName,
			userColor: randomUserColor(),
		};
	} else if (urlRoom.value && !isTrustedServerUrl(urlServer)) {
		console.warn(
			`Ignoring ?room= auto-connect because ?server=${urlServer} is not in the trusted-host allowlist. Use the Share dialog to connect explicitly.`,
		);
	}
});

// Auto-connect if broadcast is in URL (viewer mode), only if server trusted.
watchEffect(() => {
	if (urlBroadcast.value && !collaborationConfig.value && isTrustedServerUrl(urlServer)) {
		collaborationConfig.value = {
			roomId: urlBroadcast.value,
			serverUrl: urlServer,
			userName: urlName ?? autoName,
			userColor: randomUserColor(),
			role: 'viewer',
		};
	} else if (urlBroadcast.value && !isTrustedServerUrl(urlServer)) {
		console.warn(
			`Ignoring ?broadcast= auto-connect because ?server=${urlServer} is not in the trusted-host allowlist.`,
		);
	}
});

function handleStartCollaboration(config: CollaborationConfig): void {
	collaborationConfig.value = config;
	// Update URL with room/broadcast info for sharing.
	const url = new URL(window.location.href);
	// The viewer's broadcast session is the session owner (role 'owner'); a
	// regular collaboration session is role 'collaborator'.
	if (config.role === 'owner') {
		url.searchParams.set('broadcast', config.roomId);
	} else {
		url.searchParams.set('room', config.roomId);
	}
	url.searchParams.set('server', config.serverUrl);
	window.history.replaceState({}, '', url.toString());
	// Upload PPTX content to the collab server so joiners can download it.
	// Restricted to trusted hosts to prevent crafted ?server= URLs from
	// exfiltrating user content.
	const bytes = content.value;
	if (bytes && isTrustedServerUrl(config.serverUrl)) {
		const httpUrl = config.serverUrl.replace(/^ws/u, 'http');
		void fetch(`${httpUrl}/file/${encodeURIComponent(config.roomId)}`, {
			method: 'POST',
			body: bytes as BodyInit,
		}).catch(() => {
			/* server may not support file storage, fall back silently */
		});
	}
}

function handleStopCollaboration(): void {
	collaborationConfig.value = null;
	urlRoom.value = null;
	urlBroadcast.value = null;
	const url = new URL(window.location.href);
	url.searchParams.delete('room');
	url.searchParams.delete('broadcast');
	url.searchParams.delete('server');
	url.searchParams.delete('name');
	window.history.replaceState({}, '', url.toString());
}

// When joining via URL with a room/broadcast param, download PPTX from the
// collab server, but ONLY if the server is in the trusted-host allowlist.
const joinRoomId = computed(() => urlRoom.value ?? urlBroadcast.value);
watchEffect((onCleanup) => {
	const roomId = joinRoomId.value;
	if (!roomId || content.value) {
		return;
	}
	if (!isTrustedServerUrl(urlServer)) {
		console.warn(
			`Refusing to fetch presentation from untrusted ?server=${urlServer}. Add the host to TRUSTED_COLLAB_HOSTS or use the Share dialog.`,
		);
		return;
	}
	let cancelled = false;
	const httpUrl = urlServer.replace(/^ws/u, 'http');
	void fetch(`${httpUrl}/file/${encodeURIComponent(roomId)}`)
		.then((res) => {
			if (!res.ok) {
				throw new Error('Not found');
			}
			return res.arrayBuffer();
		})
		.then((buf) => {
			if (cancelled) {
				return undefined;
			}
			content.value = new Uint8Array(buf);
			fileName.value = urlBroadcast.value ? 'Broadcast Session' : 'Collaboration Session';
			return undefined;
		})
		.catch(() => {
			// File not available on server, user will need to load manually.
		});
	onCleanup(() => {
		cancelled = true;
	});
});

// Fallback: try IndexedDB if server download didn't work (same-browser tabs).
watchEffect((onCleanup) => {
	if (!joinRoomId.value || content.value) {
		return;
	}
	let cancelled = false;
	const timer = setTimeout(() => {
		void loadAudienceContent().then((bytes) => {
			if (cancelled || !bytes) {
				return undefined;
			}
			content.value = bytes;
			fileName.value = 'Collaboration Session';
			return undefined;
		});
	}, 1500);
	onCleanup(() => {
		cancelled = true;
		clearTimeout(timer);
	});
});

// When opened as an audience tab, load the PPTX content from IndexedDB.
onMounted(() => {
	if (!isAudienceTab()) {
		return;
	}
	void loadAudienceContent().then((bytes) => {
		if (!bytes) {
			return undefined;
		}
		content.value = bytes;
		fileName.value = 'Audience View';
		return undefined;
	});
});

// Update document title when in collaboration/broadcast mode.
watchEffect(() => {
	const config = collaborationConfig.value;
	if (config && content.value) {
		const prefix =
			config.role === 'owner'
				? '[Broadcasting]'
				: config.role === 'viewer'
					? '[Watching]'
					: '[Collab]';
		document.title = `${prefix} ${fileName.value} - PPTX Viewer`;
	}
});

function onDirtyChange(dirty: boolean): void {
	document.title = dirty ? `* ${fileName.value} - PPTX Viewer` : `${fileName.value} - PPTX Viewer`;
}

// ── Loading ────────────────────────────────────────────────────────────────
function loadFile(file: File): void {
	fileName.value = file.name;
	const reader = new FileReader();
	reader.onload = () => {
		content.value = new Uint8Array(reader.result as ArrayBuffer);
	};
	reader.readAsArrayBuffer(file);
}

async function newPresentation(): Promise<void> {
	const { handler, data } = await PptxHandler.createBlank({
		title: 'Untitled Presentation',
		initialSlideCount: 1,
	});
	content.value = await handler.save(data.slides);
	fileName.value = 'Untitled Presentation';
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

function browse(): void {
	fileInput.value?.click();
}
</script>

<template>
	<div v-if="content" class="demo-shell">
		<ThemePicker :current="themeKey" @change="setTheme" />
		<LanguagePicker :current="languageKey" @change="setLanguage" />
		<PowerPointViewer
			:content="content"
			:theme="currentPreset.theme"
			can-edit
			:smartArt3D="smartArt3D"
			:author-name="collaborationConfig?.userName ?? autoName"
			:collaboration="collaborationConfig ?? undefined"
			:share-defaults="{ roomId: autoRoomId, userName: autoName, serverUrl: defaultServerUrl }"
			@start-collaboration="handleStartCollaboration"
			@stop-collaboration="handleStopCollaboration"
			@dirty-change="onDirtyChange"
		/>
	</div>

	<div v-else class="demo-stage">
		<ThemePicker :current="themeKey" @change="setTheme" />
		<LanguagePicker :current="languageKey" @change="setLanguage" />
		<div
			class="demo-dropzone"
			role="button"
			tabindex="0"
			@drop="onDrop"
			@dragover.prevent
			@click="browse"
			@keydown.enter="browse"
		>
			<template v-if="urlBroadcast">
				<p class="demo-join">
					Joining broadcast: <code>{{ urlBroadcast }}</code>
				</p>
				<p class="demo-hint">Loading presentation from broadcaster...</p>
			</template>
			<template v-else-if="urlRoom">
				<p class="demo-join">
					Joining collaboration session: <code>{{ urlRoom }}</code>
				</p>
				<p class="demo-hint">Drop a .pptx file here or click to browse to start collaborating</p>
			</template>
			<template v-else>
				<p class="demo-hint">Drop a <code>.pptx</code> file here or click to browse</p>
			</template>
			<p class="demo-sub">The file is processed entirely in the browser.</p>
			<button type="button" @click.stop="newPresentation">or create a New Presentation</button>
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
	/* Never let demo chrome overflow horizontally; on mobile a wider-than-viewport
	   page expands the layout viewport and mis-anchors the viewer's fixed bottom bar. */
	overflow-x: hidden;
}

.demo-shell {
	height: 100dvh;
	width: 100vw;
}

.demo-stage {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100dvh;
	width: 100vw;
	padding: 2rem;
	color: var(--pptx-foreground, #f3f4f6);
	background: var(--pptx-background, #030712);
}

.demo-dropzone {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.75rem;
	max-width: 900px;
	width: 100%;
	padding: 3rem;
	text-align: center;
	border: 2px dashed var(--pptx-border, #374151);
	border-radius: 0.75rem;
	cursor: pointer;
	transition:
		border-color 0.15s,
		background 0.15s;
}

.demo-dropzone:hover {
	border-color: var(--pptx-primary, #6366f1);
	background: var(--pptx-accent, #1f2937);
}

.demo-join {
	margin: 0;
	font-weight: 500;
	color: var(--pptx-foreground, #f3f4f6);
}

.demo-hint {
	margin: 0;
	font-size: 1rem;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.demo-sub {
	margin: 0;
	font-size: 0.8rem;
	color: var(--pptx-muted-foreground, #9ca3af);
	opacity: 0.6;
}

.demo-dropzone code {
	padding: 0.1rem 0.3rem;
	border-radius: 0.25rem;
	background: var(--pptx-muted, #1f2937);
	color: var(--pptx-primary, #6366f1);
	font-family: ui-monospace, monospace;
}

.demo-dropzone button {
	margin-top: 0.5rem;
	padding: 0.5rem 1rem;
	border-radius: 0.5rem;
	border: 1px solid var(--pptx-border, #374151);
	background: var(--pptx-muted, #1f2937);
	color: var(--pptx-foreground, #f3f4f6);
	font-size: 0.85rem;
	cursor: pointer;
	transition: background 0.15s;
}

.demo-dropzone button:hover {
	background: var(--pptx-accent, #1f2937);
}
</style>
