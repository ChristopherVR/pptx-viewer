<script lang="ts">
	/**
	 * PresenterView: PowerPoint's presenter console.
	 *
	 * A thin composition layer over four sub-components (strip, stage, rail,
	 * navigator), which is what keeps this file inside the repo's 300-line
	 * budget; it owns only the console's own state (clock, timer, notes font
	 * size, navigator visibility) and the dispatch from a shared control id onto
	 * the snapshot patch it produces.
	 *
	 * The strip's inventory and the console's measurements come from
	 * `pptx-viewer-shared`. Measurements arrive as CSS custom properties on the
	 * root's inline style attribute, because a Svelte scoped style block is
	 * compiled ahead of time and cannot read a TypeScript value; every descendant
	 * then inherits them. This is the same seam `PresentationToolbar.svelte`
	 * already uses for `presentToolbarStyleAttr()`.
	 *
	 * The timer is driven by the shared `presenter-console` state helpers rather
	 * than by subtracting `startedAt` from the clock, so Pause actually pauses;
	 * each change is mirrored into the snapshot so an audience display agrees.
	 */
	import type { PptxSlide } from 'pptx-viewer-core';
	import {
		clampPresenterZoom,
		createPresenterTimer,
		formatElapsed,
		NOTES_FONT_SIZE_DEFAULT,
		presenterConsoleStyleAttr,
		presenterElapsed,
		presenterPaneAdvancesOnClick,
		PRESENTER_RAIL_LABEL_KEYS,
		presenterTimerProgress,
		resetPresenterTimer,
		stepPresenterZoom,
		togglePresenterTimer,
	} from 'pptx-viewer-shared';
	import type { CanvasSize, PresentationSnapshot } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { isPresenterPointerTool } from './presenter-console-strip';
	import PresenterConsoleStrip from './PresenterConsoleStrip.svelte';
	import PresenterNotesRail from './PresenterNotesRail.svelte';
	import PresenterSlideNavigator from './PresenterSlideNavigator.svelte';
	import PresenterStage from './PresenterStage.svelte';

	const {
		slides,
		current,
		canvasSize,
		mediaDataUrls,
		startedAt,
		audienceOpen,
		onmove,
		onaudience,
		onswap,
		onexit,
		snapshot,
		onupdate,
		onnavigate,
	}: {
		slides: PptxSlide[];
		current: number;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		startedAt: number;
		audienceOpen: boolean;
		/** Step the SHOW, so hidden slides are skipped (the host owns show order). */
		onmove: (direction: -1 | 1) => void;
		onaudience: () => void;
		/** Move the console to the audience screen and vice versa. */
		onswap: () => void;
		onexit: () => void;
		snapshot: PresentationSnapshot;
		onupdate: (patch: Partial<PresentationSnapshot>) => void;
		onnavigate: (index: number) => void;
	} = $props();

	const t = useTranslator();
	const metricVars = presenterConsoleStyleAttr();

	let now = $state(Date.now());
	// Seeded once, deliberately: the console is mounted fresh each time presenter
	// view opens (`{#if vm.presenterMode}`), and after that the timer is the
	// presenter's to pause and reset, not something a prop may overwrite.
	// svelte-ignore state_referenced_locally
	let timer = $state(createPresenterTimer(startedAt));
	let notesSize = $state(NOTES_FONT_SIZE_DEFAULT);
	let showSlides = $state(false);

	$effect(() => {
		const tick = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(tick);
	});

	const elapsed = $derived(presenterElapsed(timer, now));
	const progress = $derived(presenterTimerProgress(elapsed));

	// An armed drawing tool owns the pointer, so the current-slide pane must stop
	// advancing on click while one is active or it jumps the deck out from under
	// the stroke.
	const paneAdvances = $derived(presenterPaneAdvancesOnClick(snapshot.pointer?.tool));

	function setNotesSize(size: number): void {
		notesSize = size;
	}

	function closeNavigator(): void {
		showSlides = false;
	}

	function setTool(tool: string): void {
		if (!isPresenterPointerTool(tool)) {
			return;
		}
		const pointer = snapshot.pointer ?? { x: 0.5, y: 0.5, color: '#ef4444', tool: 'none' };
		onupdate({ pointer: { ...pointer, tool: pointer.tool === tool ? 'none' : tool } });
	}

	function zoomBy(direction: 1 | -1): void {
		onupdate({
			zoom: stepPresenterZoom(snapshot.zoom ?? clampPresenterZoom({}), direction),
		});
	}

	/** Dispatch a strip control id onto the console's behaviour. */
	function onControl(id: string): void {
		switch (id) {
			case 'timer-toggle': {
				// `Date.now()`, not the once-a-second clock tick: pausing must freeze
				// the timer at the instant of the press, not at the last tick.
				const at = Date.now();
				timer = togglePresenterTimer(timer, at);
				onupdate({ paused: timer.paused, elapsedMs: presenterElapsed(timer, at) });
				break;
			}
			case 'timer-reset':
				timer = resetPresenterTimer(Date.now());
				onupdate({ paused: false, elapsedMs: 0 });
				break;
			case 'all-slides':
				showSlides = true;
				break;
			case 'zoom-in':
				zoomBy(1);
				break;
			case 'zoom-out':
				zoomBy(-1);
				break;
			case 'zoom-reset':
				onupdate({ zoom: clampPresenterZoom({}) });
				break;
			case 'blackout-black':
				onupdate({ blackout: snapshot.blackout === 'black' ? 'none' : 'black' });
				break;
			case 'blackout-white':
				onupdate({ blackout: snapshot.blackout === 'white' ? 'none' : 'white' });
				break;
			case 'captions':
				onupdate({ subtitlesVisible: !snapshot.subtitlesVisible });
				break;
			case 'audience':
				onaudience();
				break;
			case 'swap-displays':
				onswap();
				break;
			case 'end':
				onexit();
				break;
			default:
				setTool(id);
		}
	}
</script>

<div
	class="pptx-svelte-presenter"
	role="dialog"
	aria-label={t('pptx.presenter.presenterView')}
	style={metricVars}
>
	<PresenterConsoleStrip {snapshot} {audienceOpen} onselect={onControl} />

	<div class="pptx-svelte-presenter-body">
		<PresenterStage
			slide={slides[current]}
			{current}
			total={slides.length}
			{canvasSize}
			{mediaDataUrls}
			zoom={snapshot.zoom}
			advances={paneAdvances}
			onadvance={() => onmove(1)}
		/>

		<PresenterNotesRail
			{slides}
			{current}
			{canvasSize}
			{mediaDataUrls}
			{now}
			{elapsed}
			{notesSize}
			{onmove}
			onnotessize={setNotesSize}
		/>
	</div>

	<!-- Elapsed-time pacing bar: one fill is `PRESENTER_TIMER_SEGMENT_MS`, the
	     five-minute interval PowerPoint's own console paces a talk in. -->
	<div
		class="pptx-svelte-presenter-progress"
		role="progressbar"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={Math.round(progress.percent)}
		aria-label={t(PRESENTER_RAIL_LABEL_KEYS.timerProgress)}
		title={t('pptx.presenter.timerTitle', {
			elapsed: formatElapsed(elapsed),
			segment: progress.segment + 1,
		})}
	>
		<div style={`width:${progress.percent}%`}></div>
	</div>

	{#if showSlides}
		<PresenterSlideNavigator
			{slides}
			{current}
			{canvasSize}
			{mediaDataUrls}
			onselect={(index) => {
				onnavigate(index);
				closeNavigator();
			}}
			onclose={closeNavigator}
		/>
	{/if}
</div>

<style>
	.pptx-svelte-presenter {
		position: absolute;
		z-index: var(--pptx-pv-z);
		inset: 0;
		display: flex;
		flex-direction: column;
		background: var(--pptx-card, #111827);
		color: var(--pptx-foreground, #f8fafc);
	}

	.pptx-svelte-presenter-body {
		display: flex;
		min-height: 0;
		flex: 1;
	}

	.pptx-svelte-presenter-progress {
		flex-shrink: 0;
		width: 100%;
		height: var(--pptx-pv-progress-h);
		background: var(--pptx-muted, #1e293b);
	}

	.pptx-svelte-presenter-progress > div {
		height: 100%;
		background: var(--pptx-primary, #38bdf8);
		transition: width 1s linear;
	}
</style>
