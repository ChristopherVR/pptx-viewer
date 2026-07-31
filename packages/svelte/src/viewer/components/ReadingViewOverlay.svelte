<script lang="ts">
	/**
	 * PowerPoint's Reading View.
	 *
	 * The deck at full window size with the editor chrome reduced to a nav bar.
	 * This is NOT the slide show: no Fullscreen API, no pointer tools, no
	 * presenter console, no blackout. The reader gets the slide, a counter and
	 * three controls, and Escape puts them back in the editor on the slide they
	 * stopped at.
	 *
	 * `position: fixed; inset: 0` fills the browser window without requesting
	 * fullscreen, which is exactly the difference between this view and a show.
	 * The slide itself is drawn by the ordinary `SlideStage`, so Reading View can
	 * never disagree with the main canvas about how a deck looks, and it applies
	 * no element cap: this is the one view whose entire purpose is reading the
	 * content.
	 */
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import type { PptxSlide } from 'pptx-viewer-core';
	import {
		READING_VIEW_ATTR,
		READING_VIEW_COUNTER_ATTR,
		READING_VIEW_STAGE_ATTR,
	} from 'pptx-viewer-shared';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { ReadingViewSession } from '../state/reading-view.svelte';
	import { styleToString } from '../style';
	import SlideStage from './SlideStage.svelte';

	const {
		slides,
		canvasSize,
		mediaDataUrls,
		activeSlideIndex,
		onexit,
	}: {
		slides: PptxSlide[];
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		/** Slide the editor was on when the view was opened. */
		activeSlideIndex: number;
		/** Receives the slide the reader ended on. */
		onexit: (slideIndex: number) => void;
	} = $props();

	const t = useTranslator();

	// The session is built once: it owns the reader's position, which must not be
	// reset when the editor underneath reacts to a key that also reached it.
	// svelte-ignore state_referenced_locally
	const session = new ReadingViewSession({
		initialSlideIndex: activeSlideIndex,
		getSlideCount: () => slides.length,
		getCanvasSize: () => canvasSize,
		onExit: (slideIndex) => onexit(slideIndex),
	});

	// Capture phase, deliberately: `<svelte:window onkeydown>` can only bubble,
	// and by then the editor still mounted underneath has already acted on the
	// key. Reading View is modal over it, so the key has to be intercepted on
	// the way down.
	$effect(() => {
		const handle = (event: KeyboardEvent): void => session.handleKey(event);
		window.addEventListener('keydown', handle, true);
		return () => window.removeEventListener('keydown', handle, true);
	});

	const slide = $derived(slides[session.state.slideIndex]);
	const stageStyle = $derived(
		styleToString({
			width: `${Math.max(canvasSize.width, 1) * session.scale}px`,
			height: `${Math.max(canvasSize.height, 1) * session.scale}px`,
		}),
	);

	// Neutral data attributes rather than classes: `e2e/` addresses all five
	// bindings through one selector, and each binding styles itself as it likes.
	const rootAttrs = { [READING_VIEW_ATTR]: 'true' };
	const stageAttrs = { [READING_VIEW_STAGE_ATTR]: 'true' };
	const counterAttrs = { [READING_VIEW_COUNTER_ATTR]: 'true' };
</script>

{#if session.state.open && slide}
	<div
		{...rootAttrs}
		class="pptx-svelte-readingview"
		role="region"
		aria-label={t('pptx.view.readingView')}
	>
		<div
			class="pptx-svelte-readingview-viewport"
			bind:clientWidth={session.viewportWidth}
			bind:clientHeight={session.viewportHeight}
		>
			{#if session.scale > 0}
				<div
					{...stageAttrs}
					class="pptx-svelte-readingview-stage"
					aria-roledescription="slide"
					style={stageStyle}
				>
					<SlideStage
						{slide}
						{canvasSize}
						{mediaDataUrls}
						scale={session.scale}
						presenting={false}
					/>
				</div>
			{/if}
		</div>
		<div class="pptx-svelte-readingview-nav">
			<button
				type="button"
				aria-label={t('pptx.common.previous')}
				title={t('pptx.common.previous')}
				disabled={!session.canPrevious}
				onclick={() => session.run({ command: 'previous' })}
			>
				<ChevronLeft size={16} aria-hidden="true" />
			</button>
			<span {...counterAttrs} class="pptx-svelte-readingview-counter">{session.counter}</span>
			<button
				type="button"
				aria-label={t('pptx.common.next')}
				title={t('pptx.common.next')}
				disabled={!session.canNext}
				onclick={() => session.run({ command: 'next' })}
			>
				<ChevronRight size={16} aria-hidden="true" />
			</button>
			<button
				type="button"
				aria-label={t('pptx.statusBar.normalView')}
				title={t('pptx.statusBar.normalView')}
				onclick={() => session.run({ command: 'exit' })}
			>
				<X size={16} aria-hidden="true" />
			</button>
		</div>
	</div>
{/if}

<style>
	.pptx-svelte-readingview {
		position: fixed;
		inset: 0;
		z-index: 1300;
		display: flex;
		flex-direction: column;
		background: #171721;
	}

	.pptx-svelte-readingview-viewport {
		display: flex;
		flex: 1;
		min-height: 0;
		align-items: center;
		justify-content: center;
	}

	.pptx-svelte-readingview-stage {
		position: relative;
		overflow: hidden;
		background: #fff;
		box-shadow: 0 24px 60px rgb(0 0 0 / 55%);
	}

	.pptx-svelte-readingview-nav {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 8px 16px;
		border-top: 1px solid rgb(255 255 255 / 10%);
	}

	.pptx-svelte-readingview-nav button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: rgb(255 255 255 / 80%);
		cursor: pointer;
	}

	.pptx-svelte-readingview-nav button:hover:not(:disabled) {
		background: rgb(255 255 255 / 15%);
		color: #fff;
	}

	.pptx-svelte-readingview-nav button:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.pptx-svelte-readingview-counter {
		min-width: 64px;
		color: rgb(255 255 255 / 70%);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}
</style>
