<script lang="ts">
	/**
	 * ExportProgressModal: a centered, non-dismissable overlay shown while a
	 * multi-slide export (PDF / GIF / WebM) runs. Svelte port of Vue's
	 * `ExportProgressModal.vue` (same layout and theme tokens, scoped CSS over
	 * the `--pptx-*` variables instead of Tailwind utilities).
	 *
	 * It deliberately does NOT close on backdrop click or Escape: an export in
	 * flight should only end by completing, erroring, or the user pressing
	 * Cancel. `oncancel` aborts cooperatively (the export loops check the
	 * signal between slides).
	 */
	import { clampPercent } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		open,
		title,
		progress,
		statusMessage,
		oncancel,
	}: {
		open: boolean;
		title: string;
		progress: number;
		statusMessage?: string;
		oncancel: () => void;
	} = $props();

	const t = useTranslator();

	const clamped = $derived(clampPercent(progress));
</script>

{#if open}
	<div class="pptx-svelte-export-progress-backdrop" role="dialog" aria-modal="true" aria-label={title}>
		<div class="pptx-svelte-export-progress-panel">
			<h3>{title}</h3>
			<div class="pptx-svelte-export-progress-track">
				<div class="pptx-svelte-export-progress-fill" style={`width: ${clamped}%`}></div>
			</div>
			<div class="pptx-svelte-export-progress-status">
				<span>{statusMessage ?? t('pptx.export.processing')}</span>
				<span class="pptx-svelte-export-progress-pct">{clamped}%</span>
			</div>
			<div class="pptx-svelte-export-progress-actions">
				<button type="button" onclick={() => oncancel()}>{t('pptx.export.cancel')}</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.pptx-svelte-export-progress-backdrop {
		position: fixed;
		inset: 0;
		z-index: 1200;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.pptx-svelte-export-progress-panel {
		width: min(92vw, 384px);
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 6px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		padding: 24px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		font-family: system-ui, sans-serif;
	}

	.pptx-svelte-export-progress-panel h3 {
		margin: 0 0 16px;
		font-size: 14px;
		font-weight: 600;
	}

	.pptx-svelte-export-progress-track {
		height: 10px;
		width: 100%;
		overflow: hidden;
		border-radius: 9999px;
		background: var(--pptx-muted, #1f2937);
		margin-bottom: 12px;
	}

	.pptx-svelte-export-progress-fill {
		height: 100%;
		border-radius: 9999px;
		background: var(--pptx-primary, #6366f1);
		transition: width 0.3s ease-out;
	}

	.pptx-svelte-export-progress-status {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16px;
		font-size: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-export-progress-pct {
		font-variant-numeric: tabular-nums;
	}

	.pptx-svelte-export-progress-actions {
		display: flex;
		justify-content: flex-end;
	}

	.pptx-svelte-export-progress-actions button {
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #1f2937);
		color: var(--pptx-foreground, #f3f4f6);
		padding: 6px 16px;
		font-size: 12px;
		font-family: inherit;
		cursor: pointer;
		transition: background 0.15s;
	}

	.pptx-svelte-export-progress-actions button:hover {
		background: var(--pptx-accent, #33334d);
	}
</style>
