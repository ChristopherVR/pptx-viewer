<script lang="ts">
	/**
	 * RibbonNavRow: the persistent navigation strip (prev/next/counter, zoom
	 * out/in/fit, present toggle, notes toggle) that stays visible regardless
	 * of the active ribbon tab, matching React's layout and the vanilla
	 * binding's `ribbon-nav-row.ts`. These are core *viewing* features a
	 * read-only viewer still needs, so they must not be gated behind an
	 * editing-only ribbon tab (the View tab additionally surfaces the same
	 * actions for ribbon-parity/discoverability while editing).
	 */
	import { useTranslator } from '../../../i18n/context';

	const {
		current,
		total,
		onprev,
		onnext,
		zoomPercent,
		onzoomin,
		onzoomout,
		onzoomfit,
		isFullscreen,
		onfullscreen,
		showNotes = false,
		notesExpanded = false,
		onnotestoggle,
	}: {
		current: number;
		total: number;
		onprev: () => void;
		onnext: () => void;
		zoomPercent: number;
		onzoomin: () => void;
		onzoomout: () => void;
		onzoomfit: () => void;
		isFullscreen: boolean;
		onfullscreen: () => void;
		showNotes?: boolean;
		notesExpanded?: boolean;
		onnotestoggle?: () => void;
	} = $props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-ribbon-nav" role="group" aria-label={t('pptx.statusBar.slideShow')}>
	<button
		type="button"
		aria-label={t('pptx.mobileBar.previousSlide')}
		title={t('pptx.mobileBar.previousSlide')}
		disabled={current <= 0}
		onclick={onprev}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3 5.5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	<span class="pptx-svelte-ribbon-nav-counter" aria-live="polite">
		{total > 0
			? t('pptx.statusBar.slideOf', { current: current + 1, total })
			: t('pptx.statusBar.noSlides')}
	</span>
	<button
		type="button"
		aria-label={t('pptx.mobileBar.nextSlide')}
		title={t('pptx.mobileBar.nextSlide')}
		disabled={current >= total - 1}
		onclick={onnext}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3 10.5 8l-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	<span class="pptx-svelte-ribbon-nav-spacer"></span>
	<button
		type="button"
		aria-label={t('pptx.statusBar.zoomOut')}
		title={t('pptx.statusBar.zoomOut')}
		onclick={onzoomout}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
	</button>
	<span class="pptx-svelte-ribbon-nav-zoom-label">{Math.round(zoomPercent)}%</span>
	<button
		type="button"
		aria-label={t('pptx.statusBar.zoomIn')}
		title={t('pptx.statusBar.zoomIn')}
		onclick={onzoomin}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
	</button>
	<button
		type="button"
		aria-label={t('pptx.statusBar.zoomToFit')}
		title={t('pptx.statusBar.zoomToFit')}
		onclick={onzoomfit}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5V2h3M14 5V2h-3M2 11v3h3M14 11v3h-3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	<button
		type="button"
		aria-label={t('pptx.statusBar.slideShow')}
		title={t('pptx.statusBar.slideShow')}
		aria-pressed={isFullscreen}
		onclick={onfullscreen}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M6 4H4v2M10 12h2v-2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	{#if showNotes}
		<button
			type="button"
			aria-label={t('pptx.statusBar.toggleNotes')}
			title={t('pptx.statusBar.toggleNotes')}
			aria-pressed={notesExpanded}
			class:pptx-svelte-ribbon-nav-active={notesExpanded}
			onclick={() => onnotestoggle?.()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3h12v10H2z" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M4 6h8M4 9h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
		</button>
	{/if}
</div>

<style>
	.pptx-svelte-ribbon-nav {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		font-family: system-ui, sans-serif;
		font-size: 13px;
		color: var(--pptx-card-foreground, #e2e8f0);
	}

	.pptx-svelte-ribbon-nav button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-ribbon-nav button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-ribbon-nav button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pptx-svelte-ribbon-nav svg {
		width: 15px;
		height: 15px;
	}

	.pptx-svelte-ribbon-nav-counter {
		min-width: 80px;
		text-align: center;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ribbon-nav-spacer {
		flex: 1;
	}

	.pptx-svelte-ribbon-nav-zoom-label {
		min-width: 40px;
		text-align: center;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ribbon-nav-active,
	.pptx-svelte-ribbon-nav button[aria-pressed='true'] {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}
</style>
