<script lang="ts">
	/**
	 * ExportMenu: the toolbar dropdown offering PNG (current slide), PDF,
	 * animated GIF, WebM video, and Print. Svelte port of Vue's
	 * `ExportMenu.vue` (same trigger/menu layout, same shared i18n keys, same
	 * theme tokens; Vue's Tailwind utilities map to the `--pptx-*` variables
	 * this binding styles with directly). Print lives here rather than in a
	 * ribbon because this binding's chrome is the compact viewer toolbar.
	 */
	import { useTranslator } from '../../i18n/context';
	import type { ExportUiState } from '../export/export-ui.svelte';

	const { exportUi }: { exportUi: ExportUiState } = $props();

	const t = useTranslator();

	let open = $state(false);

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			open = false;
		}
	}

	function choose(action: () => void): void {
		open = false;
		action();
	}
</script>

<div class="pptx-svelte-export" onfocusout={onFocusOut}>
	<button
		type="button"
		class="pptx-svelte-export-trigger"
		disabled={exportUi.exporting}
		aria-haspopup="menu"
		aria-expanded={open}
		title={exportUi.exporting ? t('pptx.ribbon.exporting') : t('pptx.export.export')}
		onclick={() => (open = !open)}
	>
		{#if exportUi.exporting}
			…
		{:else}
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v7m0 0 3-3m-3 3-3-3M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
			<span class="pptx-svelte-export-label">{t('pptx.export.export')}</span>
		{/if}
	</button>
	{#if open}
		<div class="pptx-svelte-export-menu" role="menu">
			<button type="button" role="menuitem" onclick={() => choose(() => exportUi.runPng())}>
				{t('pptx.export.pngCurrentSlide')}
			</button>
			<button type="button" role="menuitem" onclick={() => choose(() => void exportUi.runPdf())}>
				{t('pptx.export.pdfAllSlides')}
			</button>
			<button type="button" role="menuitem" onclick={() => choose(() => void exportUi.runGif())}>
				{t('pptx.export.gifAnimated')}
			</button>
			<button type="button" role="menuitem" onclick={() => choose(() => void exportUi.runVideo())}>
				{t('pptx.export.webmVideo')}
			</button>
			<button type="button" role="menuitem" onclick={() => choose(() => exportUi.runPrint())}>
				{t('pptx.print.title')}
			</button>
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-export {
		position: relative;
		display: inline-flex;
	}

	.pptx-svelte-export-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-width: 28px;
		height: 28px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
	}

	.pptx-svelte-export-trigger:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-export-trigger:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pptx-svelte-export-trigger svg {
		width: 16px;
		height: 16px;
	}

	.pptx-svelte-export-label {
		font-size: 12px;
	}

	.pptx-svelte-export-menu {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 50;
		margin-top: 4px;
		display: flex;
		min-width: 160px;
		flex-direction: column;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		padding: 4px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-export-menu button {
		display: block;
		width: 100%;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		padding: 6px 10px;
		text-align: left;
		font-family: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.pptx-svelte-export-menu button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}
</style>
