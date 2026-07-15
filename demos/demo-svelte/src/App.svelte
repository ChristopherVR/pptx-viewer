<script lang="ts">
	/**
	 * Demo shell for `pptx-svelte-viewer`, mirroring demos/demo-vue/src/App.vue:
	 * the viewer fills the screen, floating theme + language pickers hover above
	 * it, and a landing dropzone handles file open / new-deck creation. A
	 * `?room=<id>` URL param joins a serverless (y-webrtc P2P) collaboration
	 * session so two tabs on the same URL edit the same deck live.
	 */
	import type { CollaborationConfig } from 'pptx-svelte-viewer';
	import {
		loadPresentationDeck,
		parsePresentationSessionId,
		PowerPointViewer,
		themeToCssVars,
	} from 'pptx-svelte-viewer';
	import { PptxHandler } from 'pptx-viewer-core';

	import { resolveAutoName, resolveAutoRoomId, randomUserColor } from './collab';
	import { language, setLanguage, t } from './demo-i18n.svelte';
	import LanguagePicker from './LanguagePicker.svelte';
	import ThemePicker from './ThemePicker.svelte';
	import { readStoredTheme, storeTheme, themes } from './themes';

	let bytes = $state<Uint8Array | null>(null);
	let fileName = $state('');
	let themeKey = $state(readStoredTheme());
	let errorMessage = $state('');
	// eslint-disable-next-line prefer-const

	// Opt in to the experimental Three.js SmartArt renderer via `?smartArt3D=1`
	// (mirrors demo-vue/src/App.vue).
	const params = new URLSearchParams(window.location.search);
	const smartArt3D = params.get('smartArt3D') === '1';
	const audienceSession = parsePresentationSessionId(window.location.hash);
	if (audienceSession) {
		void loadPresentationDeck(audienceSession).then((content) => {
			if (content) {
				bytes = content;
				fileName = 'Audience View';
			}
			return undefined;
		});
	}

	// ── Collaboration (serverless WebRTC P2P) ────────────────────────────
	// A `?room=<id>` param auto-joins that room on load (a peer with no local
	// deck yet still needs the viewer mounted to receive one). Once a deck is
	// open, the viewer's own toolbar Share/Broadcast buttons (built into
	// `pptx-svelte-viewer`) start a fresh session directly; `onCollabStart`
	// below stamps the resulting room id into the URL so the session survives
	// a refresh and can be copied from the address bar, mirroring `joinRoom`.
	const autoName = resolveAutoName();
	const autoColor = randomUserColor();
	let collaborationConfig = $state<CollaborationConfig | null>(null);

	function joinRoom(roomId: string): void {
		collaborationConfig = {
			roomId,
			serverUrl: '',
			transport: 'webrtc',
			userName: autoName,
			userColor: autoColor,
			role: 'collaborator',
		};
		setRoomUrlParam(roomId);
	}

	function setRoomUrlParam(roomId: string): void {
		const url = new URL(window.location.href);
		url.searchParams.set('room', roomId);
		window.history.replaceState(null, '', url.toString());
		document.title = `Collaborating: ${roomId} - PPTX Viewer`;
	}

	function clearRoomUrlParam(): void {
		const url = new URL(window.location.href);
		url.searchParams.delete('room');
		window.history.replaceState(null, '', url.toString());
	}

	function onCollabStart(config: CollaborationConfig): void {
		setRoomUrlParam(config.roomId);
	}

	function onCollabStop(): void {
		collaborationConfig = null;
		clearRoomUrlParam();
	}

	const urlRoom = params.get('room');

	// Prefilled values for the viewer's built-in Share dialog form.
	const shareDefaults = { roomId: resolveAutoRoomId(), userName: autoName };

	// Mount the viewer whenever we have a deck OR an active room (a joiner with
	// no local deck still needs the viewer mounted to receive the peer's slides).
	const viewerMounted = $derived(Boolean(bytes) || Boolean(collaborationConfig));

	const currentTheme = $derived((themes[themeKey] ?? themes.vermilionDark).theme);

	function setTheme(key: string): void {
		themeKey = key;
		storeTheme(key);
	}

	// Apply theme vars to :root so the dropzone chrome tracks the theme.
	let appliedVarKeys: string[] = [];
	$effect(() => {
		const vars = themeToCssVars(currentTheme);
		const root = document.documentElement;
		for (const key of appliedVarKeys) {
			root.style.removeProperty(key);
		}
		appliedVarKeys = Object.keys(vars);
		for (const key of appliedVarKeys) {
			root.style.setProperty(key, vars[key]);
		}
	});

	function openFile(file: File): void {
		errorMessage = '';
		fileName = file.name;
		void file.arrayBuffer().then((buf) => {
			bytes = new Uint8Array(buf);
			document.title = `${file.name} - PPTX Viewer`;
			return undefined;
		});
	}

	let creating = $state(false);

	async function newPresentation(): Promise<void> {
		creating = true;
		try {
			const { handler, data } = await PptxHandler.createBlank({
				title: 'Untitled Presentation',
				initialSlideCount: 1,
			});
			const saved = await handler.save(data.slides);
			handler.dispose();
			bytes = saved;
			fileName = 'Untitled Presentation';
			document.title = 'Untitled Presentation - PPTX Viewer';
		} finally {
			creating = false;
		}
	}

	if (urlRoom) {
		joinRoom(urlRoom);
		void newPresentation();
	}

	function onDrop(e: DragEvent): void {
		e.preventDefault();
		const file = e.dataTransfer?.files?.[0];
		if (file?.name.endsWith('.pptx')) {
			openFile(file);
		}
	}

	function onInputChange(e: Event): void {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) {
			openFile(file);
		}
	}

	function onViewerError(message: string): void {
		errorMessage = message || t('demo.viewer.loadError');
		bytes = null;
		document.title = 'pptx-svelte-viewer demo';
	}
</script>

<header aria-label="Demo settings">
	<ThemePicker current={themeKey} onchange={setTheme} />
	<LanguagePicker current={language.current} theme={themeKey} onchange={setLanguage} />
</header>

{#if viewerMounted}
	<!-- Match the React demo's full-screen viewer shell and hide the build badge
	     once the presentation chrome is mounted. -->
	<main class="demo-shell" data-pptx-viewer>
		<PowerPointViewer
			source={bytes}
			theme={currentTheme}
			locale={language.current}
			{smartArt3D}
			editable
			autosave
			filePath={fileName || (collaborationConfig ? `room-${collaborationConfig.roomId}.pptx` : undefined)}
			collaboration={collaborationConfig ?? undefined}
			{shareDefaults}
			onstartcollaboration={onCollabStart}
			onstopcollaboration={onCollabStop}
			onerror={onViewerError}
		/>
	</main>
{:else}
	<main class="demo-stage">
		<h1 class="sr-only">PPTX Viewer</h1>
		<div
			class="demo-dropzone"
			role="group"
			aria-label={t('demo.dropzone.uploadAriaLabel')}
			ondrop={onDrop}
			ondragover={(e) => e.preventDefault()}
		>
			<label class="demo-hint" for="file-input">{t('demo.dropzone.hint')}</label>
			<p class="demo-sub">{t('demo.dropzone.processed')}</p>
			<button type="button" onclick={(e) => (e.stopPropagation(), newPresentation())} disabled={creating}>
				{creating ? t('demo.dropzone.creating') : t('demo.dropzone.newPresentation')}
			</button>
			{#if errorMessage}
				<p class="demo-error">{errorMessage}</p>
			{/if}
			<!-- stopPropagation: the programmatic click() would bubble back to the
			     zone's onclick and re-open the file chooser in a loop -->
			<input
				id="file-input"
				type="file"
				accept=".pptx"
				aria-label={t('demo.dropzone.uploadAriaLabel')}
				class="sr-only"
				onclick={(e) => e.stopPropagation()}
				onchange={onInputChange}
			/>
		</div>
	</main>
{/if}
