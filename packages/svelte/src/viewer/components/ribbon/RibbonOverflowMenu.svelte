<script lang="ts">
	/**
	 * RibbonOverflowMenu: the "..." (more actions) button React keeps at the far
	 * right of the toolbar's primary row (`OverflowMenu.tsx`). React has NO
	 * standalone Export button up here; the export/print actions live inside this
	 * overflow popup instead. This binding mirrors that: the ellipsis trigger
	 * opens a fixed-position popup (fixed so it escapes any ancestor clipping,
	 * matching React's `RibbonMenu` pattern) listing the export + print actions,
	 * plus every other File/Options action React exposes here (save-as variants,
	 * copy-as-image, document properties, accessibility check, keyboard
	 * shortcuts, version history, password protection, embed fonts, digital
	 * signatures) - each routed to the same handler its File-tab card already
	 * uses, so nothing here is a second implementation.
	 */
	import { useTranslator } from '../../../i18n/context';
	import type { ExportUiState } from '../../export/export-ui.svelte';

	const {
		exportUi,
		onsaveppsx,
		onsavepptm,
		oninfo,
		ona11y,
		onshortcuts,
		onversionhistory,
		onprotect,
		onfonts,
		onsignatures,
	}: {
		exportUi: ExportUiState;
		onsaveppsx?: () => void;
		onsavepptm?: () => void;
		oninfo?: () => void;
		ona11y?: () => void;
		onshortcuts?: () => void;
		onversionhistory?: () => void;
		onprotect?: () => void;
		onfonts?: () => void;
		onsignatures?: () => void;
	} = $props();
	const t = useTranslator();

	let open = $state(false);
	// eslint-disable-next-line prefer-const
	let triggerEl: HTMLButtonElement | undefined = $state();
	let pos = $state<{ left: number; top: number } | null>(null);

	function sync(): void {
		if (!triggerEl) {
			return;
		}
		const rect = triggerEl.getBoundingClientRect();
		pos = { left: rect.right, top: rect.bottom };
	}

	function toggle(): void {
		open = !open;
		if (open) {
			sync();
		}
	}

	function choose(action: () => void): void {
		open = false;
		action();
	}
</script>

<svelte:window onresize={() => open && sync()} onscroll={() => open && sync()} />

<div class="pptx-svelte-overflow">
	<button
		bind:this={triggerEl}
		type="button"
		class="pptx-svelte-overflow-trigger"
		class:pptx-svelte-overflow-open={open}
		aria-haspopup="menu"
		aria-expanded={open}
		title={t('pptx.ribbon.moreActions')}
		aria-label={t('pptx.ribbon.moreActions')}
		onclick={toggle}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1.3" fill="currentColor" /><circle cx="8" cy="8" r="1.3" fill="currentColor" /><circle cx="13" cy="8" r="1.3" fill="currentColor" /></svg>
	</button>
	{#if open}
		<button
			type="button"
			class="pptx-svelte-overflow-scrim"
			aria-label={t('pptx.overflow.closeMenu')}
			onclick={() => (open = false)}
		></button>
		<div class="pptx-svelte-overflow-menu" role="menu" style={pos ? `left:${pos.left}px;top:${pos.top}px` : 'visibility:hidden'}>
			<button type="button" role="menuitem" disabled={exportUi.exporting} onclick={() => choose(() => exportUi.runPng())}>{t('pptx.export.pngCurrentSlide')}</button>
			<button type="button" role="menuitem" disabled={exportUi.exporting} onclick={() => choose(() => void exportUi.runPdf())}>{t('pptx.export.pdfAllSlides')}</button>
			<button type="button" role="menuitem" disabled={exportUi.exporting} onclick={() => choose(() => void exportUi.runGif())}>{t('pptx.export.gifAnimated')}</button>
			<button type="button" role="menuitem" disabled={exportUi.exporting} onclick={() => choose(() => void exportUi.runVideo())}>{t('pptx.export.webmVideo')}</button>
			{#if onsaveppsx}<button type="button" role="menuitem" onclick={() => choose(onsaveppsx)}>{t('pptx.file.saveAsPpsxTooltip')}</button>{/if}
			{#if onsavepptm}<button type="button" role="menuitem" onclick={() => choose(onsavepptm)}>{t('pptx.file.saveAsPptmTooltip')}</button>{/if}
			<div class="pptx-svelte-overflow-sep" aria-hidden="true"></div>
			<button type="button" role="menuitem" onclick={() => choose(() => exportUi.runPrint())}>{t('pptx.print.title')}</button>
			<button type="button" role="menuitem" disabled={exportUi.exporting} onclick={() => choose(() => exportUi.runCopyImage())}>{t('pptx.file.copyImageTooltip')}</button>
			<div class="pptx-svelte-overflow-sep" aria-hidden="true"></div>
			{#if oninfo}<button type="button" role="menuitem" onclick={() => choose(oninfo)}>{t('pptx.ribbon.documentProperties')}</button>{/if}
			{#if ona11y}<button type="button" role="menuitem" onclick={() => choose(ona11y)}>{t('pptx.ribbon.accessibilityCheck')}</button>{/if}
			{#if onshortcuts}<button type="button" role="menuitem" onclick={() => choose(onshortcuts)}>{t('pptx.settings.keyboardShortcuts')}</button>{/if}
			{#if onversionhistory}<button type="button" role="menuitem" onclick={() => choose(onversionhistory)}>{t('pptx.ribbon.versionHistory')}</button>{/if}
			<div class="pptx-svelte-overflow-sep" aria-hidden="true"></div>
			{#if onprotect}<button type="button" role="menuitem" onclick={() => choose(onprotect)}>{t('pptx.security.protectPresentation')}</button>{/if}
			{#if onfonts}<button type="button" role="menuitem" onclick={() => choose(onfonts)}>{t('pptx.ribbon.embedFonts')}</button>{/if}
			{#if onsignatures}<button type="button" role="menuitem" onclick={() => choose(onsignatures)}>{t('pptx.viewer.digitalSignatures')}</button>{/if}
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-overflow {
		position: relative;
		display: inline-flex;
	}

	.pptx-svelte-overflow-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
		font: inherit;
	}

	.pptx-svelte-overflow-trigger:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-overflow-open {
		background: var(--pptx-primary, #6366f1) !important;
		color: #fff !important;
	}

	.pptx-svelte-overflow-trigger svg {
		width: 16px;
		height: 16px;
	}

	.pptx-svelte-overflow-scrim {
		position: fixed;
		inset: 0;
		z-index: 40;
		border: none;
		background: transparent;
		cursor: default;
	}

	.pptx-svelte-overflow-menu {
		position: fixed;
		z-index: 50;
		transform: translateX(-100%);
		display: flex;
		min-width: 176px;
		flex-direction: column;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		padding: 4px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-overflow-menu button {
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

	.pptx-svelte-overflow-menu button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-overflow-menu button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pptx-svelte-overflow-sep {
		height: 1px;
		margin: 4px 2px;
		background: color-mix(in srgb, var(--pptx-border, #33334d) 60%, transparent);
	}
</style>
