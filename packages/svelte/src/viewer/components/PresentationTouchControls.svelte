<script lang="ts">
	/** Persistent safe-area-aware controls for touch presentation mode. */
	import { buildPresentationTouchControlState } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const { current, total, onprev, onnext, onexit }: {
		current: number;
		total: number;
		onprev: () => void;
		onnext: () => void;
		onexit: () => void;
	} = $props();

	const t = useTranslator();
	const state = $derived(buildPresentationTouchControlState(current, total));

	function stop(event: Event): void {
		event.stopPropagation();
	}
</script>

<div class="pptx-svelte-presentation-touch-controls" aria-label={t('pptx.statusBar.slideShow')}>
	<button
		type="button"
		class="pptx-svelte-presentation-touch-exit"
		aria-label={t('pptx.presenter.endPresentation')}
		onpointerdown={stop}
		onclick={(event) => { stop(event); onexit(); }}
	>×</button>
	<button
		type="button"
		class="pptx-svelte-presentation-touch-prev"
		aria-label={t('pptx.presenter.previousSlide')}
		disabled={state.previousDisabled}
		onpointerdown={stop}
		onclick={(event) => { stop(event); onprev(); }}
	><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3 5.5 8l5 5" /></svg></button>
	<button
		type="button"
		class="pptx-svelte-presentation-touch-next"
		aria-label={t('pptx.presenter.nextSlide')}
		disabled={state.nextDisabled}
		onpointerdown={stop}
		onclick={(event) => { stop(event); onnext(); }}
	><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3 10.5 8l-5 5" /></svg></button>
	<span class="pptx-svelte-presentation-touch-counter" aria-live="polite">
		{state.counterLabel}
	</span>
</div>

<style>
	.pptx-svelte-presentation-touch-controls { display: none; }
	@media (any-pointer: coarse) {
		.pptx-svelte-presentation-touch-controls { display: contents; }
		.pptx-svelte-presentation-touch-controls button { position: fixed; z-index: 90; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 999px; background: rgb(0 0 0 / 55%); box-shadow: 0 4px 14px rgb(0 0 0 / 30%); color: #fff; font: 28px/1 system-ui, sans-serif; touch-action: manipulation; }
		.pptx-svelte-presentation-touch-controls button:active { background: rgb(0 0 0 / 75%); }
		.pptx-svelte-presentation-touch-controls button:disabled { opacity: .3; }
		.pptx-svelte-presentation-touch-controls svg { width: 26px; height: 26px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
		.pptx-svelte-presentation-touch-exit { top: calc(env(safe-area-inset-top, 0px) + 8px); right: calc(env(safe-area-inset-right, 0px) + 8px); }
		.pptx-svelte-presentation-touch-prev { top: 50%; left: calc(env(safe-area-inset-left, 0px) + 8px); transform: translateY(-50%); }
		.pptx-svelte-presentation-touch-next { top: 50%; right: calc(env(safe-area-inset-right, 0px) + 8px); transform: translateY(-50%); }
		.pptx-svelte-presentation-touch-counter { position: fixed; z-index: 90; bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); left: 50%; padding: 4px 12px; border-radius: 999px; background: rgb(0 0 0 / 55%); color: #fff; font: 12px ui-monospace, monospace; font-variant-numeric: tabular-nums; pointer-events: none; transform: translateX(-50%); }
	}
</style>
