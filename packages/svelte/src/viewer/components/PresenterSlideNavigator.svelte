<script lang="ts">
	/**
	 * The presenter console's "all slides" navigator overlay.
	 *
	 * Split out of `PresenterView.svelte` so that file stays inside the repo's
	 * 300-line budget, and because the overlay owns a self-contained job: pick a
	 * slide, or close. Its headings come from the shared
	 * `PRESENTER_NAVIGATOR_LABEL_KEYS` (they were hard-coded "See all slides" and
	 * "Close"), and its grid metrics from the shared layout metrics, read as CSS
	 * custom properties inherited from the console root.
	 *
	 * Hidden slides are DIMMED, never omitted: PowerPoint's typed-number jump
	 * reaches a hidden slide on purpose (it is the documented backup-slide escape
	 * hatch), so the navigator has to offer them too.
	 */
	import type { PptxSlide } from 'pptx-viewer-core';
	import { PRESENTER_LAYOUT_METRICS, PRESENTER_NAVIGATOR_LABEL_KEYS } from 'pptx-viewer-shared';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import SlideStage from './SlideStage.svelte';

	const {
		slides,
		current,
		canvasSize,
		mediaDataUrls,
		onselect,
		onclose,
	}: {
		slides: PptxSlide[];
		current: number;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		onselect: (index: number) => void;
		onclose: () => void;
	} = $props();

	const t = useTranslator();
	const tileScale = $derived(
		canvasSize.width > 0 ? PRESENTER_LAYOUT_METRICS.navigatorTileWidth / canvasSize.width : 1,
	);
</script>

<div
	class="pptx-svelte-presenter-navigator"
	role="dialog"
	aria-label={t(PRESENTER_NAVIGATOR_LABEL_KEYS.title)}
>
	<header>
		<h2>{t(PRESENTER_NAVIGATOR_LABEL_KEYS.subtitle)}</h2>
		<button
			type="button"
			data-pptx-presenter-navigator="close"
			aria-label={t(PRESENTER_NAVIGATOR_LABEL_KEYS.close)}
			onclick={onclose}
		>
			{t(PRESENTER_NAVIGATOR_LABEL_KEYS.close)}
		</button>
	</header>
	<main>
		{#each slides as item, index (index)}
			<button
				type="button"
				class:active={index === current}
				class:hidden={item.hidden}
				aria-current={index === current}
				aria-label={t('pptx.presenter.slideLabel', { current: index + 1, total: slides.length })}
				onclick={() => onselect(index)}
			>
				<div style={`width:${canvasSize.width * tileScale}px;height:${canvasSize.height * tileScale}px`}>
					<SlideStage slide={item} {canvasSize} {mediaDataUrls} scale={tileScale} />
				</div>
				<small>{index + 1}</small>
			</button>
		{/each}
	</main>
</div>

<style>
	.pptx-svelte-presenter-navigator {
		position: absolute;
		z-index: var(--pptx-pv-nav-z);
		inset: 0;
		display: flex;
		flex-direction: column;
		background: var(--pptx-card, #020617);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 22px;
		border-bottom: 1px solid var(--pptx-border, #334155);
	}

	h2 {
		margin: 0;
		font-size: 15px;
	}

	header button {
		border: 0;
		border-radius: var(--pptx-pv-control-radius);
		padding: 7px 12px;
		background: var(--pptx-secondary, #334155);
		color: inherit;
		cursor: pointer;
	}

	main {
		display: grid;
		gap: var(--pptx-pv-nav-gap);
		grid-template-columns: repeat(auto-fill, minmax(var(--pptx-pv-nav-track-min), 1fr));
		padding: 22px;
		overflow: auto;
	}

	main button {
		border: 0;
		padding: 0;
		background: none;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}

	main button > div {
		position: relative;
		overflow: hidden;
	}

	main button.active {
		outline: 2px solid var(--pptx-primary, #38bdf8);
	}

	main button.hidden {
		opacity: var(--pptx-pv-hidden-opacity);
	}
</style>
