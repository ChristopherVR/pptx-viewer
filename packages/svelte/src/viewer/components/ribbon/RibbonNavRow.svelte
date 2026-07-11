<script lang="ts">
	/**
	 * RibbonNavRow: the compact prev/next/counter row that stays visible
	 * regardless of the active ribbon tab, matching React's layout (core
	 * viewing affordances a read-only viewer still needs, not folded into a
	 * tab). Zoom/fullscreen/notes live under the View tab instead.
	 */
	import { useTranslator } from '../../../i18n/context';

	const {
		current,
		total,
		onprev,
		onnext,
	}: {
		current: number;
		total: number;
		onprev: () => void;
		onnext: () => void;
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
</style>
