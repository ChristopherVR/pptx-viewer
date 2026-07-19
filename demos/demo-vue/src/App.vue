<script setup lang="ts">
import { PptxHandler } from 'pptx-viewer-core';
import {
	PowerPointViewer,
	isAudienceTab,
	loadAudienceContent,
	parsePresentationSessionId,
	themeToCssVars,
} from 'pptx-vue-viewer';
import type { CollaborationConfig } from 'pptx-vue-viewer';
import 'pptx-vue-viewer/styles';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

import { useDemoAiConfig } from './ai-config';
import {
	isTrustedServerUrl,
	randomUserColor,
	resolveAutoName,
	resolveAutoRoomId,
	resolveDefaultServerUrl,
} from './collab';
import i18n from './i18n';
import type { LanguageCode } from './languages';
import { languageKeys } from './languages';
import { themes } from './themes';

/**
 * Demo app for `pptx-vue-viewer`, mirroring the React `demo/main.tsx`.
 *
 * The viewer fills the screen; there is no demo header (download lives in the
 * viewer's File menu). URL params drive collaboration / broadcast / audience joins.
 */

const content = shallowRef<Uint8Array | null>(null);
const fileName = ref('');

// Demo AI provider: the host builds an OpenAI-compatible browser model from
// user-supplied fields and passes it to the viewer's optional `ai` prop. Works
// blank (assistant simply stays off until a base URL + model are entered).
const { fields: aiFields, config: aiConfig, setField: setAiField } = useDemoAiConfig();

const themeKey = ref<string>(readStoredTheme());

function readStoredTheme(): string {
	try {
		return localStorage.getItem('pptx-demo-theme') ?? 'vermilionDark';
	} catch {
		return 'vermilionDark';
	}
}

const currentPreset = computed(() => themes[themeKey.value] ?? themes.vermilionDark);

const { t } = useI18n();

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
const urlName = params.get('name');
// Serverless peer-to-peer joins carry `?transport=webrtc` (and optional
// `?signaling=a,b`); they need no `?server=` and no file server round-trip.
const urlTransport = params.get('transport');
const urlSignaling = params.get('signaling')?.split(',').filter(Boolean) ?? [];
const isWebrtcJoin = urlTransport === 'webrtc';
// For a webrtc join the server URL is intentionally blank (P2P); otherwise fall
// back to the configured relay / localhost default.
const urlServer = isWebrtcJoin ? '' : (params.get('server') ?? resolveDefaultServerUrl());
// Opt in to the experimental Three.js SmartArt renderer via `?smartArt3D=1`.
const smartArt3D = params.get('smartArt3D') === '1';

// Stable defaults for the Share dialog (demo-specific).
const autoRoomId = resolveAutoRoomId();
const autoName = resolveAutoName();
const defaultServerUrl = resolveDefaultServerUrl();

// ── Collaboration state ────────────────────────────────────────────────────
const collaborationConfig = shallowRef<CollaborationConfig | null>(null);

// A webrtc join is serverless, so it bypasses the trusted-host allowlist (there
// is no server to trust); a websocket join still requires a trusted server.
const joinAllowed = isWebrtcJoin || isTrustedServerUrl(urlServer);

// Auto-connect if room is in URL (collaboration mode).
watchEffect(() => {
	if (urlRoom.value && !collaborationConfig.value && joinAllowed) {
		collaborationConfig.value = {
			roomId: urlRoom.value,
			serverUrl: urlServer,
			userName: urlName ?? autoName,
			userColor: randomUserColor(),
			...(isWebrtcJoin
				? { transport: 'webrtc', signaling: urlSignaling.length ? urlSignaling : undefined }
				: {}),
		};
	} else if (urlRoom.value && !joinAllowed) {
		console.warn(
			`Ignoring ?room= auto-connect because ?server=${urlServer} is not in the trusted-host allowlist. Use the Share dialog to connect explicitly.`,
		);
	}
});

// Auto-connect if broadcast is in URL (viewer mode).
watchEffect(() => {
	if (urlBroadcast.value && !collaborationConfig.value && joinAllowed) {
		collaborationConfig.value = {
			roomId: urlBroadcast.value,
			serverUrl: urlServer,
			userName: urlName ?? autoName,
			userColor: randomUserColor(),
			role: 'viewer',
			...(isWebrtcJoin
				? { transport: 'webrtc', signaling: urlSignaling.length ? urlSignaling : undefined }
				: {}),
		};
	} else if (urlBroadcast.value && !joinAllowed) {
		console.warn(
			`Ignoring ?broadcast= auto-connect because ?server=${urlServer} is not in the trusted-host allowlist.`,
		);
	}
});

function handleStartCollaboration(config: CollaborationConfig): void {
	collaborationConfig.value = config;
	const webrtc = config.transport === 'webrtc';
	// Update URL with room/broadcast info for sharing.
	const url = new URL(window.location.href);
	// The viewer's broadcast session is the session owner (role 'owner'); a
	// regular collaboration session is role 'collaborator'.
	if (config.role === 'owner') {
		url.searchParams.set('broadcast', config.roomId);
	} else {
		url.searchParams.set('room', config.roomId);
	}
	// A serverless webrtc session shares `transport=webrtc` (no server URL);
	// a websocket session shares its server so joiners fetch the file from it.
	if (webrtc) {
		url.searchParams.set('transport', 'webrtc');
		url.searchParams.delete('server');
		if (config.signaling?.length) {
			url.searchParams.set('signaling', config.signaling.join(','));
		}
	} else {
		url.searchParams.set('server', config.serverUrl);
		url.searchParams.delete('transport');
		url.searchParams.delete('signaling');
	}
	window.history.replaceState({}, '', url.toString());
	// Upload PPTX content to the collab server so joiners can download it.
	// Restricted to trusted hosts to prevent crafted ?server= URLs from
	// exfiltrating user content. Serverless webrtc has no file server: joiners
	// receive the deck through Y.Doc late-joiner sync instead.
	const bytes = content.value;
	if (config.sessionIntent !== 'join' && !webrtc && bytes && isTrustedServerUrl(config.serverUrl)) {
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
	url.searchParams.delete('transport');
	url.searchParams.delete('signaling');
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
	// Serverless webrtc joins have no file server: the deck arrives via Y.Doc
	// late-joiner sync, so skip the HTTP fetch entirely.
	if (isWebrtcJoin) {
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

// Serverless webrtc joins have no file server and no IndexedDB seed: bootstrap
// a blank deck so the viewer mounts and starts collaborating. The owner's real
// slides then arrive through Y.Doc late-joiner sync and replace the blank deck.
watchEffect((onCleanup) => {
	if (!isWebrtcJoin || !joinRoomId.value || content.value) {
		return;
	}
	let cancelled = false;
	void PptxHandler.createBlank({ title: 'Collaboration Session', initialSlideCount: 1 })
		.then(({ handler, data }) => handler.save(data.slides))
		.then((bytes) => {
			if (cancelled || content.value) {
				return undefined;
			}
			content.value = bytes;
			fileName.value = 'Collaboration Session';
			return undefined;
		});
	onCleanup(() => {
		cancelled = true;
	});
});

// When opened as an audience tab, load the PPTX content from IndexedDB.
onMounted(() => {
	if (!isAudienceTab()) {
		return;
	}
	void loadAudienceContent(parsePresentationSessionId(window.location.hash) ?? undefined).then(
		(bytes) => {
			if (!bytes) {
				return undefined;
			}
			content.value = bytes;
			fileName.value = 'Audience View';
			return undefined;
		},
	);
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

// Reflect the loaded deck's name in the document title (all other demos do
// this). The collaboration effect above owns the title while a session is
// active; otherwise show "<fileName> - PPTX Viewer", falling back to the plain
// demo title before any deck is opened.
watchEffect(() => {
	if (collaborationConfig.value) {
		return;
	}
	document.title =
		content.value && fileName.value ? `${fileName.value} - PPTX Viewer` : 'pptx-vue-viewer demo';
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
</script>

<template>
	<main v-if="content" class="demo-shell">
		<PowerPointViewer
			:content="content"
			:file-name="fileName"
			autosave
			can-edit
			:smartArt3D="smartArt3D"
			:ai="aiConfig"
			:author-name="collaborationConfig?.userName ?? autoName"
			:collaboration="collaborationConfig ?? undefined"
			:share-defaults="{ roomId: autoRoomId, userName: autoName, serverUrl: defaultServerUrl }"
			@start-collaboration="handleStartCollaboration"
			@stop-collaboration="handleStopCollaboration"
			@dirty-change="onDirtyChange"
		/>
	</main>

	<main v-else class="demo-stage">
		<h1 class="sr-only">PPTX Viewer</h1>
		<div
			class="demo-dropzone"
			role="group"
			:aria-label="t('demo.dropzone.uploadAriaLabel')"
			@drop="onDrop"
			@dragover.prevent
		>
			<template v-if="urlBroadcast">
				<p class="demo-join">
					{{ t('demo.dropzone.joiningBroadcast') }} <code>{{ urlBroadcast }}</code>
				</p>
				<p class="demo-hint">{{ t('demo.dropzone.loadingBroadcast') }}</p>
			</template>
			<template v-else-if="urlRoom">
				<p class="demo-join">
					{{ t('demo.dropzone.joiningSession') }} <code>{{ urlRoom }}</code>
				</p>
				<label class="demo-hint" for="file-input">{{ t('demo.dropzone.hintCollab') }}</label>
			</template>
			<template v-else>
				<label class="demo-hint" for="file-input">{{ t('demo.dropzone.hint') }}</label>
			</template>
			<p class="demo-sub">{{ t('demo.dropzone.processed') }}</p>
			<button type="button" @click.stop="newPresentation">
				{{ t('demo.dropzone.newPresentation') }}
			</button>
			<input
				id="file-input"
				type="file"
				accept=".pptx"
				:aria-label="t('demo.dropzone.uploadAriaLabel')"
				class="sr-only"
				@change="onInputChange"
			/>

			<!-- Demo-only AI provider form: build an OpenAI-compatible browser model
			     from user-supplied fields. Leave blank to keep the assistant off. -->
			<details class="demo-ai" @click.stop>
				<summary>
					AI assistant (optional)
					<span :class="aiConfig ? 'demo-ai-on' : 'demo-ai-off'">
						{{ aiConfig ? '- ready' : '- not configured' }}
					</span>
				</summary>
				<p class="demo-ai-hint">
					Paste an OpenAI-compatible endpoint to enable the in-viewer assistant. The demo builds the
					model in the browser; a real app would proxy through its own backend and keep the key
					server-side.
				</p>
				<div class="demo-ai-fields">
					<label>
						Base URL
						<input
							type="url"
							placeholder="https://api.openai.com/v1"
							:value="aiFields.baseURL"
							@input="setAiField('baseURL', ($event.target as HTMLInputElement).value)"
						/>
					</label>
					<label>
						API key
						<input
							type="password"
							placeholder="sk-..."
							:value="aiFields.apiKey"
							@input="setAiField('apiKey', ($event.target as HTMLInputElement).value)"
						/>
					</label>
					<label>
						Model id
						<input
							type="text"
							placeholder="gpt-4o-mini"
							:value="aiFields.model"
							@input="setAiField('model', ($event.target as HTMLInputElement).value)"
						/>
					</label>
				</div>
			</details>
		</div>
	</main>
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
	display: block;
	margin: 0;
	font-size: 1rem;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.demo-sub {
	margin: 0;
	font-size: 0.8rem;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
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

.demo-ai {
	width: 100%;
	max-width: 640px;
	margin-top: 1rem;
	padding: 0.75rem 1rem;
	border-radius: 0.5rem;
	border: 1px solid var(--pptx-border, #374151);
	background: var(--pptx-card, rgba(31, 41, 55, 0.4));
	text-align: left;
}

.demo-ai summary {
	cursor: pointer;
	font-size: 0.85rem;
	color: var(--pptx-foreground, #f3f4f6);
}

.demo-ai-on {
	color: var(--pptx-primary, #6366f1);
}

.demo-ai-off {
	color: var(--pptx-muted-foreground, #9ca3af);
}

.demo-ai-hint {
	margin: 0.5rem 0 0;
	font-size: 0.75rem;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.demo-ai-fields {
	display: grid;
	gap: 0.5rem;
	margin-top: 0.75rem;
	grid-template-columns: repeat(3, minmax(0, 1fr));
}

.demo-ai-fields label {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	font-size: 0.72rem;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.demo-ai-fields input {
	border-radius: 0.375rem;
	border: 1px solid var(--pptx-border, #374151);
	background: var(--pptx-background, #111827);
	padding: 0.35rem 0.5rem;
	font-size: 0.8rem;
	color: var(--pptx-foreground, #f3f4f6);
}

@media (max-width: 640px) {
	.demo-ai-fields {
		grid-template-columns: 1fr;
	}
}
</style>
