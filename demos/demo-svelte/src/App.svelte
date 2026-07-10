<script lang="ts">
	/**
	 * Demo shell for `pptx-svelte-viewer`, mirroring demos/demo-vue/src/App.vue:
	 * the viewer fills the screen, floating theme + language pickers hover above
	 * it, and a landing dropzone handles file open / new-deck creation. A
	 * `?room=<id>` URL param joins a serverless (y-webrtc P2P) collaboration
	 * session so two tabs on the same URL edit the same deck live.
	 */
	import type { CollaborationConfig, PowerPointViewerApi } from 'pptx-svelte-viewer';
	import { PowerPointViewer, themeToCssVars } from 'pptx-svelte-viewer';
	import { PptxHandler } from 'pptx-viewer-core';

	import { resolveAutoName, resolveAutoRoomId, randomUserColor } from './collab';
	import { language, setLanguage, t } from './demo-i18n.svelte';
	import ExportBar from './ExportBar.svelte';
	import LanguagePicker from './LanguagePicker.svelte';
	import ThemePicker from './ThemePicker.svelte';
	import { readStoredTheme, storeTheme, themes } from './themes';

	let bytes = $state<Uint8Array | null>(null);
	let fileName = $state('');
	// In-place editing is on by default (mirrors the vanilla demo's editable:true).
	// eslint-disable-next-line prefer-const
	let editable = $state(true);
	let themeKey = $state(readStoredTheme());
	let errorMessage = $state('');
	// eslint-disable-next-line prefer-const
	let fileInput = $state<HTMLInputElement | null>(null);
	// Assigned by the viewer's bind:this (invisible to the linter).
	// eslint-disable-next-line no-unassigned-vars, prefer-const
	let viewerRef = $state<PowerPointViewerApi>();

	// Opt in to the experimental Three.js SmartArt renderer via `?smartArt3D=1`
	// (mirrors demo-vue/src/App.vue).
	const params = new URLSearchParams(window.location.search);
	const smartArt3D = params.get('smartArt3D') === '1';

	// ── Collaboration (serverless WebRTC P2P) ────────────────────────────
	// A `?room=<id>` param auto-joins that room; otherwise a "Share" button
	// starts a fresh session and stamps the id into the URL so it can be copied.
	const autoName = resolveAutoName();
	const autoColor = randomUserColor();
	let collaborationConfig = $state<CollaborationConfig | null>(null);
	let shareCopied = $state(false);

	function joinRoom(roomId: string): void {
		collaborationConfig = {
			roomId,
			serverUrl: '',
			transport: 'webrtc',
			userName: autoName,
			userColor: autoColor,
			role: 'collaborator',
		};
		const url = new URL(window.location.href);
		url.searchParams.set('room', roomId);
		window.history.replaceState(null, '', url.toString());
		document.title = `Collaborating: ${roomId} - PPTX Viewer`;
	}

	function startShare(): void {
		joinRoom(resolveAutoRoomId());
	}

	function stopShare(): void {
		collaborationConfig = null;
		const url = new URL(window.location.href);
		url.searchParams.delete('room');
		window.history.replaceState(null, '', url.toString());
	}

	async function copyShareLink(): Promise<void> {
		await navigator.clipboard.writeText(window.location.href);
		shareCopied = true;
		setTimeout(() => (shareCopied = false), 1500);
	}

	const urlRoom = params.get('room');
	if (urlRoom) {
		joinRoom(urlRoom);
	}

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

	function browse(): void {
		fileInput?.click();
	}

	function onViewerError(message: string): void {
		errorMessage = message || t('demo.viewer.loadError');
		bytes = null;
		document.title = 'pptx-svelte-viewer demo';
	}
</script>

<style>
	.demo-editable-toggle {
		position: fixed;
		bottom: 12px;
		left: 12px;
		z-index: 50;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--pptx-card, #1e1e2e) 85%, transparent);
		color: var(--pptx-card-foreground, #e2e8f0);
		font: 500 13px/1 system-ui, sans-serif;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
		cursor: pointer;
		user-select: none;
	}

	.demo-collab-bar {
		position: fixed;
		top: 12px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 50;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--pptx-card, #1e1e2e) 90%, transparent);
		color: var(--pptx-card-foreground, #e2e8f0);
		font: 500 12px/1 system-ui, sans-serif;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
	}

	.demo-collab-bar button {
		padding: 4px 10px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.demo-collab-bar button:hover {
		background: var(--pptx-accent, #33334d);
	}

	.demo-collab-room {
		opacity: 0.85;
	}
</style>

<ThemePicker current={themeKey} onchange={setTheme} />
<LanguagePicker current={language.current} theme={themeKey} onchange={setLanguage} />

{#if viewerMounted}
	<!-- data-pptx-viewer: mirrors the marker attribute the React binding puts on
	     its own viewer root (packages/react/src/viewer/PowerPointViewer.tsx),
	     which the demos/build-stamp.ts badge watches for to auto-hide itself
	     once a viewer mounts. pptx-svelte-viewer's own root doesn't set this
	     marker yet, so without it here the badge stays pinned bottom-right and
	     visually collides with ExportBar's buttons in the same corner. -->
	<div class="demo-shell" data-pptx-viewer>
		<label class="demo-editable-toggle">
			<input type="checkbox" bind:checked={editable} />
			{t('demo.editToggle.label')}
		</label>
		<div class="demo-collab-bar">
			{#if collaborationConfig}
				<span class="demo-collab-room" data-testid="collab-room">Room: {collaborationConfig.roomId}</span>
				<button type="button" onclick={() => void copyShareLink()}>
					{shareCopied ? 'Copied!' : 'Copy link'}
				</button>
				<button type="button" onclick={stopShare}>Leave</button>
			{:else}
				<button type="button" onclick={startShare}>Share (collaborate)</button>
			{/if}
		</div>
		<PowerPointViewer
			bind:this={viewerRef}
			source={bytes}
			theme={currentTheme}
			locale={language.current}
			{smartArt3D}
			{editable}
			autosave
			filePath={fileName || (collaborationConfig ? `room-${collaborationConfig.roomId}.pptx` : undefined)}
			collaboration={collaborationConfig ?? undefined}
			onstartcollaboration={(config) => console.info('collaboration started', config.roomId)}
			onstopcollaboration={() => console.info('collaboration stopped')}
			onerror={onViewerError}
		/>
		<ExportBar
			exportPng={() => viewerRef?.exportSlidePng() ?? Promise.resolve()}
			exportPdf={() => viewerRef?.exportPdf() ?? Promise.resolve()}
		/>
	</div>
{:else}
	<div class="demo-stage">
		<div
			class="demo-dropzone"
			role="button"
			tabindex="0"
			ondrop={onDrop}
			ondragover={(e) => e.preventDefault()}
			onclick={browse}
			onkeydown={(e) => e.key === 'Enter' && browse()}
		>
			<p class="demo-hint">{t('demo.dropzone.hint')}</p>
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
				bind:this={fileInput}
				type="file"
				accept=".pptx"
				aria-label={t('demo.dropzone.uploadAriaLabel')}
				style="display: none"
				onclick={(e) => e.stopPropagation()}
				onchange={onInputChange}
			/>
		</div>
	</div>
{/if}
