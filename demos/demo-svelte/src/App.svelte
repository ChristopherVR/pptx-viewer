<script lang="ts">
	/**
	 * Demo shell for `pptx-svelte-viewer`, mirroring demos/demo-vue/src/App.vue
	 * (minus collaboration, which the Svelte binding does not support yet): the
	 * viewer fills the screen, floating theme + language pickers hover above it,
	 * and a landing dropzone handles file open / sample deck loading.
	 */
	import { PowerPointViewer, themeToCssVars } from 'pptx-svelte-viewer';
	import { PptxHandler } from 'pptx-viewer-core';

	import { language, setLanguage, t } from './demo-i18n.svelte';
	import LanguagePicker from './LanguagePicker.svelte';
	import ThemePicker from './ThemePicker.svelte';
	import { readStoredTheme, storeTheme, themes } from './themes';

	let bytes = $state<Uint8Array | null>(null);
	let fileName = $state('');
	let themeKey = $state(readStoredTheme());
	let errorMessage = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);

	// Opt in to the experimental Three.js SmartArt renderer via `?smartArt3D=1`
	// (mirrors demo-vue/src/App.vue).
	const smartArt3D = new URLSearchParams(window.location.search).get('smartArt3D') === '1';

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

<ThemePicker current={themeKey} onchange={setTheme} />
<LanguagePicker current={language.current} theme={themeKey} onchange={setLanguage} />

{#if bytes}
	<div class="demo-shell">
		<PowerPointViewer
			source={bytes}
			theme={currentTheme}
			locale={language.current}
			{smartArt3D}
			onerror={onViewerError}
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
