<script lang="ts">
	/**
	 * FileTab: the ribbon's File tab. Save as .pptx (download) and the export
	 * menu (PNG/PDF/GIF/video/print), relocated from the pre-ribbon toolbar's
	 * always-visible edit group and `ExportMenu`.
	 */
	import { useTranslator } from '../../../../i18n/context';
	import ExportMenu from '../../ExportMenu.svelte';
	import type { ExportUiState } from '../../../export/export-ui.svelte';

	const {
		ondownload,
		onopenfile,
		exportUi,
	}: { ondownload: () => void; onopenfile?: () => void; exportUi?: ExportUiState } = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-filetab" role="group" aria-label={t('pptx.ribbon.tab.file')}>
	{#if onopenfile}<button type="button" onclick={onopenfile}>{t('pptx.file.open')}</button>{/if}
	<button
		type="button"
		aria-label={t('pptx.file.saveAsPptx')}
		title={t('pptx.file.saveAsPptxTooltip')}
		onclick={ondownload}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v7m0 0 3-3m-3 3-3-3M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
		<span>{t('pptx.file.saveAsPptx')}</span>
	</button>
	{#if exportUi}
		<ExportMenu {exportUi} />
	{/if}
</div>

<style>
	.pptx-svelte-filetab {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.pptx-svelte-filetab button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
	}

	.pptx-svelte-filetab button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-filetab svg {
		width: 15px;
		height: 15px;
	}
</style>
