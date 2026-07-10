<script lang="ts">
	/**
	 * Demo shell for `pptx-svelte-viewer`, mirroring the vanilla demo: the
	 * viewer fills the screen, a floating theme picker hovers above it, and a
	 * landing dropzone handles file open / sample deck loading.
	 */
	import { PowerPointViewer, themeToCssVars } from 'pptx-svelte-viewer';

	import { fileToBytes, readStoredTheme, storeTheme, themes } from './themes';

	let bytes = $state<Uint8Array | null>(null);
	let fileName = $state('');
	let themeKey = $state(readStoredTheme());
	let errorMessage = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);

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
		void fileToBytes(file).then((data) => {
			bytes = data;
			document.title = `${file.name} - PPTX Viewer`;
			return undefined;
		});
	}

	function openSample(): void {
		errorMessage = '';
		void fetch(`${import.meta.env.BASE_URL}sample-deck.pptx`)
			.then((res) => {
				if (!res.ok) {
					throw new Error(`sample deck fetch failed (${res.status})`);
				}
				return res.arrayBuffer();
			})
			.then((buf) => {
				bytes = new Uint8Array(buf);
				fileName = 'Sample Deck';
				document.title = 'Sample Deck - PPTX Viewer';
				return undefined;
			})
			.catch((err: unknown) => {
				errorMessage = err instanceof Error ? err.message : 'Failed to load the sample deck';
			});
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
		errorMessage = message || 'Failed to load the presentation';
		bytes = null;
		document.title = 'pptx-svelte-viewer demo';
	}
</script>

<div class="demo-theme-picker">
	<select
		aria-label="Theme"
		value={themeKey}
		onchange={(e) => setTheme((e.target as HTMLSelectElement).value)}
	>
		{#each Object.entries(themes) as [key, preset] (key)}
			<option value={key}>{preset.label}</option>
		{/each}
	</select>
</div>

{#if bytes}
	<div class="demo-shell">
		<PowerPointViewer source={bytes} theme={currentTheme} onerror={onViewerError} />
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
			<p class="demo-hint">Drop a .pptx file here, or click to browse</p>
			<p class="demo-sub">Files are processed entirely in your browser</p>
			<button type="button" onclick={(e) => (e.stopPropagation(), openSample())}>
				Load sample deck
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
				aria-label="Upload a PowerPoint file"
				style="display: none"
				onclick={(e) => e.stopPropagation()}
				onchange={onInputChange}
			/>
		</div>
	</div>
{/if}
