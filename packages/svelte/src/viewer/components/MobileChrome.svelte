<script lang="ts">
	/**
	 * MobileChrome: intentionally small, touch-friendly navigation for phone
	 * viewports. Desktop chrome remains mounted for keyboard and wide layouts;
	 * CSS selects this bar at the same breakpoint that hides it.
	 */
	import { useTranslator } from '../../i18n/context';

	const {
		current,
		total,
		zoomPercent,
		notesExpanded,
		showNotes,
		isFullscreen,
		onprev,
		onnext,
		onzoomin,
		onzoomout,
		onzoomfit,
		onfullscreen,
		onnotestoggle,
	}: {
		current: number;
		total: number;
		zoomPercent: number;
		notesExpanded: boolean;
		showNotes: boolean;
		isFullscreen: boolean;
		onprev: () => void;
		onnext: () => void;
		onzoomin: () => void;
		onzoomout: () => void;
		onzoomfit: () => void;
		onfullscreen: () => void;
		onnotestoggle: () => void;
	} = $props();

	const t = useTranslator();
</script>

<nav class="pptx-svelte-mobile-chrome" aria-label={t('pptx.mobileBar.ariaLabel')}>
	<div class="pptx-svelte-mobile-chrome-group">
		<button type="button" aria-label={t('pptx.mobileBar.previousSlide')} title={t('pptx.mobileBar.previousSlide')} disabled={current <= 0} onclick={onprev}>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3 5.5 8l5 5" /></svg>
		</button>
		<span aria-live="polite">{total > 0 ? `${current + 1}/${total}` : '0/0'}</span>
		<button type="button" aria-label={t('pptx.mobileBar.nextSlide')} title={t('pptx.mobileBar.nextSlide')} disabled={current >= total - 1} onclick={onnext}>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3 10.5 8l-5 5" /></svg>
		</button>
	</div>
	<div class="pptx-svelte-mobile-chrome-group">
		<button type="button" aria-label={t('pptx.statusBar.zoomOut')} title={t('pptx.statusBar.zoomOut')} onclick={onzoomout}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" /></svg></button>
		<button type="button" class="pptx-svelte-mobile-zoom" aria-label={t('pptx.statusBar.zoomToFit')} title={t('pptx.statusBar.zoomToFit')} onclick={onzoomfit}>{zoomPercent}%</button>
		<button type="button" aria-label={t('pptx.statusBar.zoomIn')} title={t('pptx.statusBar.zoomIn')} onclick={onzoomin}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" /></svg></button>
		{#if showNotes}
			<button type="button" class:active={notesExpanded} aria-pressed={notesExpanded} aria-label={t('pptx.statusBar.toggleNotes')} title={t('pptx.statusBar.toggleNotes')} onclick={onnotestoggle}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h9v11h-9zM5 5.5h6M5 8h6M5 10.5h4" /></svg></button>
		{/if}
		<button type="button" class:active={isFullscreen} aria-pressed={isFullscreen} aria-label={t('pptx.statusBar.slideShow')} title={t('pptx.statusBar.slideShow')} onclick={onfullscreen}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6v-3.5h3.5M13.5 6v-3.5h-3.5M2.5 10v3.5h3.5M13.5 10v3.5h-3.5" /></svg></button>
	</div>
</nav>

<style>
	.pptx-svelte-mobile-chrome { display: none; }
	@media (max-width: 720px) {
		.pptx-svelte-mobile-chrome { position: absolute; z-index: 30; right: 8px; bottom: calc(72px + env(safe-area-inset-bottom)); left: 8px; display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 4px 6px; border: 1px solid var(--pptx-border, #33334d); border-radius: 12px; background: color-mix(in srgb, var(--pptx-card, #1e1e2e) 92%, #000); box-shadow: 0 8px 24px rgb(0 0 0 / 35%); color: var(--pptx-card-foreground, #e2e8f0); font: 12px system-ui, sans-serif; }
		.pptx-svelte-mobile-chrome-group { display: flex; align-items: center; gap: 2px; }
		.pptx-svelte-mobile-chrome button { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; min-height: 40px; padding: 0 7px; border: 0; border-radius: 8px; background: transparent; color: inherit; cursor: pointer; }
		.pptx-svelte-mobile-chrome button:hover:not(:disabled), .pptx-svelte-mobile-chrome button:focus-visible { background: var(--pptx-accent, #33334d); outline: none; }
		.pptx-svelte-mobile-chrome button:disabled { opacity: .38; cursor: default; }
		.pptx-svelte-mobile-chrome button.active { color: var(--pptx-primary, #6366f1); }
		.pptx-svelte-mobile-chrome svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }
		.pptx-svelte-mobile-zoom { min-width: 48px !important; font-variant-numeric: tabular-nums; }
	}
</style>
