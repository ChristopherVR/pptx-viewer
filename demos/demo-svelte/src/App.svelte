<script lang="ts">
	/**
	 * Demo shell for `pptx-svelte-viewer`, mirroring demos/demo-vue/src/App.vue:
	 * the viewer fills the screen and a landing dropzone handles file open /
	 * new-deck creation. A
	 * `?room=<id>` URL param joins a serverless (y-webrtc P2P) collaboration
	 * session so two tabs on the same URL edit the same deck live.
	 */
	import type { CollaborationConfig, PptxAiConfig } from 'pptx-svelte-viewer';
	import {
		forgetSessionDeck,
		loadPresentationDeck,
		parsePresentationSessionId,
		PowerPointViewer,
		rememberSessionDeck,
		restoreSessionDeck,
		themeToCssVars,
	} from 'pptx-svelte-viewer';
	import { PptxHandler } from 'pptx-viewer-core';

	import { buildViewerAiConfig } from './ai-config';
	import { resolveAutoName, resolveAutoRoomId, randomUserColor } from './collab';
	import { language, t } from './demo-i18n.svelte';
	import { readStoredTheme, themes } from './themes';

	let bytes = $state<Uint8Array | null>(null);
	let fileName = $state('');
	// Built from the persisted demo AI settings when a deck opens; undefined
	// leaves the viewer with no AI assistant (the default when no key is set).
	let aiConfig = $state<PptxAiConfig | undefined>(undefined);
	const themeKey = readStoredTheme();
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

	// Apply theme vars to :root so the dropzone chrome tracks the theme. Like
	// the React demo, the preset is NOT passed to <PowerPointViewer>: the
	// viewer's own Settings > Appearance picker owns the viewer chrome theme
	// (so "Default" resolves to the built-in defaults).
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
		dropSampleParam();
		errorMessage = '';
		aiConfig = buildViewerAiConfig();
		fileName = file.name;
		void file.arrayBuffer().then((buf) => {
			bytes = new Uint8Array(buf);
			document.title = `${file.name} - PPTX Viewer`;
			return undefined;
		});
	}

	let creating = $state(false);

	async function newPresentation(): Promise<void> {
		dropSampleParam();
		creating = true;
		aiConfig = buildViewerAiConfig();
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

	// `?sample=1` auto-loads the bundled sample deck (used by the docs landing
	// page to embed a live, pre-populated viewer). With `?room=` too, the sample
	// seeds the collaboration session instead of a blank deck.
	const urlSample = params.get('sample') === '1';

	async function loadSampleDeck(): Promise<void> {
		try {
			const res = await fetch(`${import.meta.env.BASE_URL}sample-deck.pptx`);
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`);
			}
			const buf = await res.arrayBuffer();
			if (!bytes) {
				bytes = new Uint8Array(buf);
				fileName = 'sample-deck.pptx';
				document.title = 'sample-deck.pptx - PPTX Viewer';
			}
		} catch {
			// Sample not available: fall through to the regular dropzone.
		}
	}

	// ── Refresh survival ────────────────────────────────────────────────────
	// Remember the open deck for THIS tab, and reopen it on the next load. A
	// refresh used to drop the presentation and land the user back on the file
	// picker; now it comes back, with any autosaved edits (restoreSessionDeck
	// prefers the newer of the two). An audience tab is fed by the presenter
	// window, so it neither remembers nor restores.
	$effect(() => {
		const current = bytes;
		if (!current || audienceSession) {
			return;
		}
		void rememberSessionDeck(fileName, current);
	});

	/**
	 * Reopen the deck this tab had before a refresh, falling back to the
	 * `?sample=1` deck. A restored deck beats the sample: this tab has moved on
	 * from it (the user opened a deck of their own, possibly through the viewer's
	 * own File > Open), so the flag is retired rather than seeding it again.
	 */
	async function restoreSession(): Promise<void> {
		const deck = await restoreSessionDeck();
		if (!deck || bytes) {
			if (urlSample && !bytes) {
				await loadSampleDeck();
			}
			return;
		}
		dropSampleParam();
		aiConfig = buildViewerAiConfig();
		bytes = deck.data;
		fileName = deck.fileName;
		document.title = `${deck.fileName} - PPTX Viewer`;
	}

	/**
	 * Drop `?sample=1` from the address bar.
	 *
	 * The docs landing page embeds the demo with `?sample=1` so it opens
	 * pre-populated. Once the user opens a deck of their own that param is stale:
	 * left in place it would re-seed the bundled sample on the next refresh and
	 * throw away what they were looking at.
	 */
	function dropSampleParam(): void {
		const url = new URL(window.location.href);
		if (!url.searchParams.has('sample')) {
			return;
		}
		url.searchParams.delete('sample');
		window.history.replaceState(null, '', url.toString());
	}

	if (urlRoom) {
		joinRoom(urlRoom);
		void (urlSample ? loadSampleDeck() : newPresentation());
	} else if (!audienceSession) {
		// The audience branch above owns its tab; everything else reopens this
		// tab's deck, falling back to the sample and then to the dropzone.
		void restoreSession();
	}

	function onDrop(e: DragEvent): void {
		e.preventDefault();
		const file = e.dataTransfer?.files?.[0];
		if (file && /\.(?:pptx|ppt|json)$/iu.test(file.name)) {
			openFile(file);
		}
	}

	function onInputChange(e: Event): void {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) {
			openFile(file);
		}
	}

	// eslint-disable-next-line prefer-const -- `fileInput` is reassigned by Svelte bind:this.
	let fileInput: HTMLInputElement | null = $state(null);

	/** Open the native picker from the explicit Browse control. */
	function openFilePicker(): void {
		fileInput?.click();
	}

	/**
	 * The dashed zone paints `cursor: pointer` over its whole area and the copy
	 * says "click to browse", so the whole area has to open the picker, not just
	 * the one text line that happens to be a <label>. Clicks that originate on a
	 * button, on the label, or on the input itself are already handled by those
	 * elements; re-opening from here would double-fire or loop.
	 */
	function onZoneClick(e: MouseEvent): void {
		if ((e.target as HTMLElement).closest('button, label[for="file-input"], #file-input')) {
			return;
		}
		openFilePicker();
	}

	function onViewerError(message: string): void {
		errorMessage = message || t('demo.viewer.loadError');
		bytes = null;
		document.title = 'pptx-svelte-viewer demo';
		// A deck the viewer cannot load must not be reopened on every refresh.
		void forgetSessionDeck();
	}
</script>

{#if viewerMounted}
	<!-- Match the React demo's full-screen viewer shell and hide the build badge
	     once the presentation chrome is mounted. -->
	<main class="demo-shell" data-pptx-viewer>
		<PowerPointViewer
			source={bytes}
			locale={language.current}
			{smartArt3D}
			editable
			autosave
			fileName={fileName || undefined}
			filePath={fileName || (collaborationConfig ? `room-${collaborationConfig.roomId}.pptx` : undefined)}
			collaboration={collaborationConfig ?? undefined}
			{shareDefaults}
			ai={aiConfig}
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
			data-testid="dropzone"
			aria-label={t('demo.dropzone.uploadAriaLabel')}
			onclick={onZoneClick}
			ondrop={onDrop}
			ondragover={(e) => e.preventDefault()}
		>
			<label class="demo-hint" for="file-input">{t('demo.dropzone.hint')}</label>
			<p class="demo-sub">{t('demo.dropzone.processed')}</p>
			<div class="demo-actions">
				<button
					type="button"
					class="demo-browse"
					data-testid="browse-files"
					onclick={(e) => (e.stopPropagation(), openFilePicker())}
				>
					{t('demo.dropzone.browse')}
				</button>
				<button type="button" onclick={(e) => (e.stopPropagation(), newPresentation())} disabled={creating}>
					{creating ? t('demo.dropzone.creating') : t('demo.dropzone.newPresentation')}
				</button>
			</div>
			{#if errorMessage}
				<p class="demo-error">{errorMessage}</p>
			{/if}
			<!-- stopPropagation: the programmatic click() would bubble back to the
			     zone's onclick and re-open the file chooser in a loop -->
			<input
				id="file-input"
				bind:this={fileInput}
				type="file"
				accept=".pptx,.ppt,.json"
				aria-label={t('demo.dropzone.uploadAriaLabel')}
				class="sr-only"
				onclick={(e) => e.stopPropagation()}
				onchange={onInputChange}
			/>
		</div>
	</main>
{/if}
