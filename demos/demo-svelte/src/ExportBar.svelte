<script lang="ts">
	/**
	 * Minimal PNG (current slide) / PDF (all slides) export affordance for the
	 * demo shell: two plain buttons anchored bottom-right, stacked below the
	 * theme/language pickers. This deliberately stays a "couple of buttons"
	 * (per the pptx-svelte-viewer PNG+PDF export pass) rather than porting
	 * Vue's full ExportMenu/ExportProgressModal UI, mirroring
	 * demos/demo-vanilla/src/export-bar.ts.
	 */
	import { t } from './demo-i18n.svelte';

	const {
		exportPng,
		exportPdf,
	}: { exportPng: () => Promise<void>; exportPdf: () => Promise<void> } = $props();

	let busy = $state(false);

	async function run(action: () => Promise<void>): Promise<void> {
		if (busy) {
			return;
		}
		busy = true;
		try {
			await action();
		} catch (error) {
			console.error('[pptx-svelte-viewer demo] export failed', error);
		} finally {
			busy = false;
		}
	}
</script>

<div class="export-bar">
	<button type="button" disabled={busy} onclick={() => void run(exportPng)}>
		{t('demo.export.png')}
	</button>
	<button type="button" disabled={busy} onclick={() => void run(exportPdf)}>
		{t('demo.export.pdf')}
	</button>
</div>

<style>
	.export-bar {
		position: fixed;
		bottom: 12px;
		right: 12px;
		z-index: 99999;
		display: flex;
		gap: 8px;
		font-family: system-ui, sans-serif;
	}

	.export-bar button {
		padding: 6px 12px;
		border-radius: 9999px;
		border: 1px solid var(--pptx-border, #374151);
		background: var(--pptx-muted, #1f2937);
		color: var(--pptx-foreground, #f3f4f6);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
		transition: background 0.15s;
	}

	.export-bar button:hover:not(:disabled) {
		background: var(--pptx-accent, #1f2937);
	}

	.export-bar button:disabled {
		opacity: 0.6;
		cursor: default;
	}
</style>
