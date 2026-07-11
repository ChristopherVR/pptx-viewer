<script lang="ts">
	/**
	 * Compact export affordance for the demo shell: one row of plain buttons
	 * anchored bottom-right (PNG of the current slide, PDF / GIF / WebM video
	 * of the whole deck, and the print flow). Deliberately stays a button row
	 * rather than porting Vue's full ExportMenu/ExportProgressModal UI,
	 * mirroring demos/demo-vanilla/src/export-bar.ts.
	 */
	import { t } from './demo-i18n.svelte';

	interface ExportBarProps {
		exportPng: () => Promise<void>;
		exportPdf: () => Promise<void>;
		exportGif: () => Promise<void>;
		exportVideo: () => Promise<void>;
		print: () => Promise<void>;
	}

	const { exportPng, exportPdf, exportGif, exportVideo, print }: ExportBarProps = $props();

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

	const actions = $derived([
		{ key: 'demo.export.png', action: exportPng },
		{ key: 'demo.export.pdf', action: exportPdf },
		{ key: 'demo.export.gif', action: exportGif },
		{ key: 'demo.export.video', action: exportVideo },
		{ key: 'demo.export.print', action: print },
	]);
</script>

<div class="export-bar">
	{#each actions as { key, action } (key)}
		<button type="button" disabled={busy} onclick={() => void run(action)}>
			{t(key)}
		</button>
	{/each}
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
