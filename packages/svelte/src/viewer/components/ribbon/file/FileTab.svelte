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
		ondownloadppsx,
		ondownloadpptm,
		onpackage,
		hasMacros,
		onopenfile,
		exportUi,
		onproperties,
		onfonts,
		onsignatures,
		onprotect,
	}: {
		ondownload: () => void;
		ondownloadppsx: () => void;
		ondownloadpptm: () => void;
		onpackage: () => void;
		hasMacros: boolean;
		onopenfile?: () => void;
		exportUi?: ExportUiState;
		onproperties?: () => void;
		onfonts?: () => void;
		onsignatures?: () => void;
		onprotect?: () => void;
	} = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-filetab" role="group" aria-label={t('pptx.ribbon.tab.file')}>
	{#if onopenfile}<button type="button" onclick={onopenfile}>{t('pptx.ribbon.open')}</button>{/if}
	<button
		type="button"
		aria-label={t('pptx.file.saveAsPptx')}
		title={t('pptx.file.saveAsPptxTooltip')}
		onclick={ondownload}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v7m0 0 3-3m-3 3-3-3M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
		<span>{t('pptx.file.saveAsPptx')}</span>
	</button>
	<button
		type="button"
		title={t('pptx.file.saveAsPpsxTooltip')}
		onclick={ondownloadppsx}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 6 5-6 5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
		<span>{t('pptx.file.saveAsPpsx')}</span>
	</button>
	{#if hasMacros}
		<button
			type="button"
			title={t('pptx.file.saveAsPptmTooltip')}
			onclick={ondownloadpptm}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h5l3 3v8H4zM9 2.5v3h3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
			<span>{t('pptx.file.saveAsPptm')}</span>
		</button>
	{/if}
	<button type="button" title={t('pptx.file.packageTooltip')} onclick={onpackage}>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14 5 8 8.5 2 5m0 0 6-3 6 3v6L8 14l-6-3zM8 8.5V14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" /></svg>
		<span>{t('pptx.file.package')}</span>
	</button>
	{#if onproperties}<button type="button" title={t('pptx.ribbon.documentProperties')} onclick={onproperties}><span>{t('pptx.ribbon.documentProperties')}</span></button>{/if}
	{#if onprotect}<button type="button" onclick={onprotect}><span>{t('pptx.security.protectPresentation')}</span></button>{/if}
	{#if onfonts}<button type="button" onclick={onfonts}><span>{t('pptx.ribbon.embedFonts')}</span></button>{/if}
	{#if onsignatures}<button type="button" onclick={onsignatures}><span>{t('pptx.viewer.digitalSignatures')}</span></button>{/if}
	{#if exportUi}
		<button
			type="button"
			title={t('pptx.file.copyImageTooltip')}
			onclick={() => exportUi.runCopyImage()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 6h7v7H6zM3 10V3h7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
			<span>{t('pptx.file.copyImage')}</span>
		</button>
	{/if}
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
