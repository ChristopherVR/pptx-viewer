<script lang="ts">
	/**
	 * The presenter console's large current-slide pane.
	 *
	 * Split out of `PresenterView.svelte` to keep that file inside the repo's
	 * 300-line budget; it owns no state, only the zoomed frame, the slide-number
	 * badge and the click-to-advance affordance.
	 *
	 * Clicking the pane advances the show, the way PowerPoint's presenter console
	 * does: that is how presenters actually drive a deck, with the Next button and
	 * the keyboard as fallbacks. An armed drawing tool owns the pointer instead
	 * (shared `presenterPaneAdvancesOnClick`), so a click then annotates rather
	 * than jumping the deck out from under the stroke.
	 */
	import type { PptxSlide } from 'pptx-viewer-core';
	import { PRESENTER_RAIL_LABEL_KEYS } from 'pptx-viewer-shared';
	import type { CanvasSize, PresentationZoomState } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import SlideStage from './SlideStage.svelte';

	const {
		slide,
		current,
		total,
		canvasSize,
		mediaDataUrls,
		zoom,
		advances,
		onadvance,
	}: {
		slide: PptxSlide | undefined;
		/** Zero-based; rendered one-based in the badge. */
		current: number;
		total: number;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		zoom: PresentationZoomState | undefined;
		/** Whether a click on the pane should step the show. */
		advances: boolean;
		onadvance: () => void;
	} = $props();

	const t = useTranslator();
	const scale = $derived(
		canvasSize.width > 0 && canvasSize.height > 0
			? Math.min(760 / canvasSize.width, 460 / canvasSize.height)
			: 1,
	);
	const frameStyle = $derived(
		[
			`width:${canvasSize.width * scale}px`,
			`height:${canvasSize.height * scale}px`,
			`transform:scale(${zoom?.scale ?? 1})`,
			`transform-origin:${(zoom?.originX ?? 0.5) * 100}% ${(zoom?.originY ?? 0.5) * 100}%`,
		].join(';'),
	);

	function onPaneClick(): void {
		if (advances) {
			onadvance();
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -- keyboard nav is owned by the host -->
<section
	class="pptx-svelte-presenter-main"
	class:advances
	role="presentation"
	data-pptx-presenter-slide
	onclick={onPaneClick}
>
	{#if slide}
		<div class="pptx-svelte-presenter-frame" style={frameStyle}>
			<SlideStage {slide} {canvasSize} {mediaDataUrls} {scale} />
		</div>
		<span class="pptx-svelte-presenter-badge">
			{t('pptx.presenter.slideLabel', { current: current + 1, total })}
		</span>
	{:else}
		<span class="pptx-svelte-presenter-badge">{t(PRESENTER_RAIL_LABEL_KEYS.noSlides)}</span>
	{/if}
</section>

<style>
	.pptx-svelte-presenter-main {
		display: flex;
		min-width: 0;
		flex: var(--pptx-pv-main-flex);
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: var(--pptx-pv-main-pad);
		background: #000;
		overflow: hidden;
	}

	.pptx-svelte-presenter-main.advances {
		cursor: pointer;
	}

	.pptx-svelte-presenter-frame {
		position: relative;
		overflow: hidden;
	}

	.pptx-svelte-presenter-badge {
		color: rgb(255 255 255 / 50%);
		font-family: ui-monospace, monospace;
		font-size: 12px;
		user-select: none;
	}
</style>
