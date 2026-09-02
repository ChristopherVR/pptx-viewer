<script lang="ts">
	/**
	 * The presenter console's right-hand rail: clock, elapsed timer, slide
	 * navigation, the next-slide preview and the speaker notes.
	 *
	 * Three fixes over the strip-and-aside this replaced, all of them shared-rule
	 * violations rather than styling:
	 *
	 * - Every string was hard-coded English ("Current time", "Previous",
	 *   "Speaker notes", "No notes for this slide"); they now resolve through the
	 *   dictionary via the shared label keys.
	 * - Next was disabled on the last slide, which strands the presenter: see
	 *   `presenterNextDisabled` for why PowerPoint keeps it live.
	 * - Notes rendered as plain text, dropping every run style the deck authored.
	 *   The cascade is now the shared one React's rail uses: rich segments, then
	 *   plain text, then the "no notes" placeholder.
	 *
	 * The next-slide preview deliberately uses `nextPresentedSlide`, so it shows
	 * the slide the next forward press will actually land on rather than
	 * `slides[current + 1]` (which would preview a hidden slide the show skips).
	 *
	 * The rail's four controls (`prev`, `next`, `notes-font-decrease`,
	 * `notes-font-increase`) emit the SAME `data-pptx-presenter-control` attribute
	 * the console strip uses, because all five bindings agreed on one attribute so
	 * a framework-neutral e2e spec can query a single selector. Anything asserting
	 * the strip's own inventory therefore has to scope to
	 * `[data-pptx-presenter-strip]` rather than sweep the document.
	 */
	import type { PptxSlide } from 'pptx-viewer-core';
	import {
		clampNotesFontSize,
		formatElapsed,
		formatTime,
		nextPresentedSlide,
		notesSegmentsToSpans,
		NOTES_FONT_SIZE_MAX,
		NOTES_FONT_SIZE_MIN,
		NOTES_FONT_SIZE_STEP,
		PRESENTER_LAYOUT_METRICS,
		PRESENTER_RAIL_CONTROLS,
		PRESENTER_RAIL_LABEL_KEYS,
		presenterNextDisabled,
		presenterPrevDisabled,
	} from 'pptx-viewer-shared';
	import type { AuthoredSlideRange, CanvasSize, ShowOrderCustomShow } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { styleToString } from '../style';
	import SlideStage from './SlideStage.svelte';

	const {
		slides,
		current,
		canvasSize,
		mediaDataUrls,
		now,
		elapsed,
		notesSize,
		activeCustomShow,
		authoredRange,
		onmove,
		onnotessize,
	}: {
		slides: PptxSlide[];
		current: number;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		/** `Date.now()` of the console's clock tick, so the rail never owns a timer. */
		now: number;
		elapsed: number;
		notesSize: number;
		/**
		 * The custom show playback is restricted to, so the preview names the
		 * slide the next forward press actually reaches. Without it a running
		 * custom show previewed the next DECK slide instead of the next SHOW one.
		 */
		activeCustomShow?: ShowOrderCustomShow | null;
		/**
		 * `p:showPr/p:sldRg`: the deck's authored slide-range restriction (wave-4
		 * B1), passed to `nextPresentedSlide` alongside `activeCustomShow` so the
		 * preview never names a slide outside the range the show was opened into.
		 */
		authoredRange?: AuthoredSlideRange | null;
		onmove: (direction: -1 | 1) => void;
		onnotessize: (size: number) => void;
	} = $props();

	const t = useTranslator();

	/** The rail's own controls, looked up in the shared inventory by id. */
	function railLabel(id: string): string {
		const control = PRESENTER_RAIL_CONTROLS.find((item) => item.id === id);
		return control === undefined ? '' : t(control.labelKey);
	}

	const slide = $derived(slides[current]);
	const nextSlide = $derived(
		nextPresentedSlide(slides, current, activeCustomShow, authoredRange),
	);
	const nextScale = $derived(
		canvasSize.width > 0 ? PRESENTER_LAYOUT_METRICS.nextPreviewWidth / canvasSize.width : 1,
	);
	const spans = $derived(notesSegmentsToSpans(slide?.notesSegments ?? []));
	const plainNotes = $derived((slide?.notes ?? '').trim());
</script>

<aside class="pptx-svelte-presenter-rail">
	<header>
		<div>
			<small>{t(PRESENTER_RAIL_LABEL_KEYS.currentTime)}</small>
			<strong>{formatTime(new Date(now))}</strong>
		</div>
		<div>
			<small>{t(PRESENTER_RAIL_LABEL_KEYS.elapsed)}</small>
			<strong>{formatElapsed(elapsed)}</strong>
		</div>
	</header>

	<nav>
		<button
			type="button"
			data-pptx-presenter-control="prev"
			disabled={presenterPrevDisabled(current)}
			aria-label={railLabel('prev')}
			onclick={() => onmove(-1)}
		>
			{railLabel('prev')}
		</button>
		<span>{current + 1} / {slides.length}</span>
		<!-- Never disabled: the console has to be able to run off the end of the
		     show, or the presenter cannot finish and the audience display never
		     closes. The rule is `presenterNextDisabled`, not a local judgement. -->
		<button
			type="button"
			data-pptx-presenter-control="next"
			disabled={presenterNextDisabled()}
			aria-label={railLabel('next')}
			onclick={() => onmove(1)}
		>
			{railLabel('next')}
		</button>
	</nav>

	<section class="pptx-svelte-presenter-next">
		<small>{t(PRESENTER_RAIL_LABEL_KEYS.nextSlidePreview)}</small>
		{#if nextSlide}
			<div
				class="pptx-svelte-presenter-next-frame"
				data-pptx-presenter-next-preview
				style={`width:${canvasSize.width * nextScale}px;height:${canvasSize.height * nextScale}px`}
			>
				<SlideStage slide={nextSlide} {canvasSize} {mediaDataUrls} scale={nextScale} />
			</div>
		{:else}
			<em>{t(PRESENTER_RAIL_LABEL_KEYS.endOfPresentation)}</em>
		{/if}
	</section>

	<section class="pptx-svelte-presenter-notes">
		<header>
			<small>{t(PRESENTER_RAIL_LABEL_KEYS.speakerNotes)}</small>
			<div class="pptx-svelte-presenter-notes-size">
				<button
					type="button"
					data-pptx-presenter-control="notes-font-decrease"
					disabled={notesSize <= NOTES_FONT_SIZE_MIN}
					aria-label={railLabel('notes-font-decrease')}
					title={railLabel('notes-font-decrease')}
					onclick={() => onnotessize(clampNotesFontSize(notesSize - NOTES_FONT_SIZE_STEP))}
				>
					<!-- A literal minus glyph, not an em-dash and not an icon font. -->
					<span aria-hidden="true">-</span>
				</button>
				<span class="pptx-svelte-presenter-notes-readout">{notesSize}px</span>
				<button
					type="button"
					data-pptx-presenter-control="notes-font-increase"
					disabled={notesSize >= NOTES_FONT_SIZE_MAX}
					aria-label={railLabel('notes-font-increase')}
					title={railLabel('notes-font-increase')}
					onclick={() => onnotessize(clampNotesFontSize(notesSize + NOTES_FONT_SIZE_STEP))}
				>
					<span aria-hidden="true">+</span>
				</button>
			</div>
		</header>
		<div
			class="pptx-svelte-presenter-notes-body"
			data-pptx-presenter-notes
			style={`font-size:${notesSize}px`}
		>
			{#if spans.length > 0}
				{#each spans as span (span.key)}
					{#if span.kind === 'break'}
						<br />
					{:else}
						<span style={styleToString(span.style)}>{span.text}</span>
					{/if}
				{/each}
			{:else if plainNotes}
				{plainNotes}
			{:else}
				<em>{t(PRESENTER_RAIL_LABEL_KEYS.noNotes)}</em>
			{/if}
		</div>
	</section>
</aside>

<style>
	.pptx-svelte-presenter-rail {
		display: flex;
		flex: var(--pptx-pv-rail-flex);
		min-width: var(--pptx-pv-rail-min);
		max-width: var(--pptx-pv-rail-max);
		flex-direction: column;
		border-left: 1px solid var(--pptx-border, #334155);
	}

	header,
	nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 12px;
		border-bottom: 1px solid var(--pptx-border, #334155);
	}

	header div {
		display: flex;
		flex-direction: column;
	}

	small {
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	button {
		border: 0;
		border-radius: var(--pptx-pv-control-radius);
		padding: 7px 10px;
		background: var(--pptx-secondary, #334155);
		color: inherit;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pptx-svelte-presenter-next {
		padding: 14px;
		border-bottom: 1px solid var(--pptx-border, #334155);
	}

	.pptx-svelte-presenter-next-frame {
		position: relative;
		margin-top: 8px;
		overflow: hidden;
	}

	.pptx-svelte-presenter-notes {
		display: flex;
		min-height: 0;
		flex: 1;
		flex-direction: column;
		padding: 12px;
	}

	.pptx-svelte-presenter-notes header {
		padding: 0 0 8px;
		border: 0;
	}

	.pptx-svelte-presenter-notes-size {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.pptx-svelte-presenter-notes-readout {
		min-width: 34px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-family: ui-monospace, monospace;
		font-size: 10px;
		text-align: center;
	}

	.pptx-svelte-presenter-notes-body {
		flex: 1;
		padding: 12px;
		border: 1px solid var(--pptx-border, #334155);
		border-radius: 6px;
		line-height: 1.5;
		overflow: auto;
		white-space: pre-wrap;
	}
</style>
