<script lang="ts">
	/**
	 * PresentationOverlays: everything that floats above the stage while a show
	 * runs, plus the presenter view. Split out of `PowerPointViewer.svelte` to
	 * keep that file under the repo's file-size budget; it owns no state of its
	 * own, only the mapping from the viewer's composition bag onto each overlay.
	 *
	 * The blackout / laser / caption layers are mirrored FROM the presenter's
	 * snapshot, so they render on an audience display as well as on the
	 * presenter's own screen, which is why they are not gated on fullscreen.
	 */
	import { presenterConsoleStyleAttr, resolveAuthoredSlideRange } from 'pptx-viewer-shared';

	import type { PresentationContextMenuActionId } from 'pptx-viewer-shared';

	import type { ViewerStateBag } from '../state/create-viewer-state-types';
	import PresentationContextMenu from './PresentationContextMenu.svelte';
	import PresentationEndScreen from './PresentationEndScreen.svelte';
	import PresentationToolbar from './PresentationToolbar.svelte';
	import PresentationTouchControls from './PresentationTouchControls.svelte';
	import PresenterSlideNavigator from './PresenterSlideNavigator.svelte';
	import PresenterView from './PresenterView.svelte';

	const { vm }: { vm: ViewerStateBag } = $props();

	// Stable controller references (the bag is built once and never reassigned).
	// svelte-ignore state_referenced_locally
	const { loader, viewer, editor, presentation, presenterSession, parityUi, optionsState } = vm;

	/**
	 * Step the show. Forward runs the click-stepped animation build first and
	 * only then changes slide; backward asks the controller to rewind a build
	 * before falling back to the previous slide.
	 *
	 * EVERY navigation surface goes through here (the show toolbar, the touch
	 * controls and the presenter console), which is the point: the console used
	 * to move with `viewer.goTo(viewer.current + direction)`, bypassing the show
	 * order entirely. Its next-slide PREVIEW correctly skipped a hidden slide
	 * (shared `nextPresentedSlide`) but the Next button then landed on that very
	 * slide, so the room saw a slide the author had hidden and the preview had
	 * promised something else. `presentation.advance()` /
	 * `presentation.previousSlide()` both resolve the show order, so all three
	 * surfaces now agree with the preview and with the keyboard.
	 */
	function move(direction: 1 | -1): void {
		if (direction === 1) {
			presentation.advance();
		} else if (!presentation.retreat()) {
			presentation.previousSlide();
		}
	}
	const pointer = $derived(presenterSession.snapshot.pointer);
	/**
	 * `p:showPr/p:sldRg`: the deck's authored slide-range restriction, passed to
	 * `nextPresentedSlide` (via `PresenterView` -> `PresenterNotesRail`) so the
	 * rail's next-slide preview never names a slide outside the authored range
	 * (wave-4 B1). Same source as the show controller's own
	 * `getAuthoredRange`, so the console and the running show agree.
	 */
	const authoredRange = $derived(
		resolveAuthoredSlideRange(loader.presentationProperties, editor.renderedSlides.length),
	);

	/** Route a chosen right-click-menu action onto this overlay's own handlers. */
	function onContextMenuAction(id: PresentationContextMenuActionId): void {
		switch (id) {
			case 'next':
				move(1);
				break;
			case 'previous':
				move(-1);
				break;
			case 'seeAllSlides':
				parityUi.allSlidesOpen = true;
				break;
			case 'presenterView':
				vm.presenterMode = !vm.presenterMode;
				break;
			case 'pointerArrow':
				parityUi.annotations.tool = 'none';
				break;
			case 'pointerPen':
				parityUi.annotations.tool = 'pen';
				break;
			case 'pointerHighlighter':
				parityUi.annotations.tool = 'highlighter';
				break;
			case 'pointerLaser':
				parityUi.annotations.tool = 'laser';
				break;
			case 'eraseInk':
				parityUi.annotations.clear();
				break;
			case 'blankBlack':
				setBlankScreen('black');
				break;
			case 'blankWhite':
				setBlankScreen('white');
				break;
			case 'endShow':
				vm.onFullscreenToggle();
				break;
		}
	}

	/** Set (or clear) the whole-screen blank, mirroring the keyboard B/W shortcuts. */
	function setBlankScreen(value: 'black' | 'white'): void {
		const current = presenterSession.snapshot.blackout;
		presenterSession.updateSnapshot({ blackout: current === value ? 'none' : value });
	}
</script>

{#if viewer.isFullscreen}
	<PresentationTouchControls
		current={viewer.current}
		total={viewer.slideCount}
		onprev={() => move(-1)}
		onnext={() => move(1)}
		onexit={vm.onFullscreenToggle}
	/>
	<PresentationToolbar
		annotations={parityUi.annotations}
		chrome={parityUi.showChrome}
		current={viewer.current}
		total={viewer.slideCount}
		presenterMode={vm.presenterMode}
		blackout={presenterSession.snapshot.blackout}
		onblackoutchange={(value) => presenterSession.updateSnapshot({ blackout: value })}
		onmove={move}
		onpresenterview={() => (vm.presenterMode = !vm.presenterMode)}
		onexit={vm.onFullscreenToggle}
		popupToolbarEnabled={optionsState.options.advanced.slideShowShowPopupToolbar}
	/>
{/if}
<!-- Black "End of slide show" screen: the show has run past its last slide.
     It MUST be visible - while it is up the next input either goes nowhere
     (backward) or ends the show (forward), so a deck that kept painting the
     last slide looked stuck and then exited with no warning. -->
<!--
	PowerPoint's "See All Slides" (Ctrl+S during a show). The navigator's own
	metrics are CSS custom properties the presenter console normally supplies, so
	the wrapper carries them here: without it the grid collapses to one column and
	loses its stacking level.
-->
{#if viewer.isFullscreen && parityUi.allSlidesOpen}
	<div class="pptx-svelte-show-navigator" style={presenterConsoleStyleAttr()}>
		<PresenterSlideNavigator
			slides={editor.renderedSlides}
			current={viewer.current}
			canvasSize={loader.canvasSize}
			mediaDataUrls={loader.mediaDataUrls}
			onselect={(index) => {
				viewer.goTo(index);
				parityUi.allSlidesOpen = false;
			}}
			onclose={() => (parityUi.allSlidesOpen = false)}
		/>
	</div>
{/if}
{#if viewer.isFullscreen && presentation.endOfShowVisible}
	<PresentationEndScreen onexit={() => presentation.advance()} />
{/if}
{#if viewer.isFullscreen && parityUi.presentationContextMenu}
	<PresentationContextMenu
		x={parityUi.presentationContextMenu.x}
		y={parityUi.presentationContextMenu.y}
		capabilities={{
			seeAllSlides: true,
			presenterView: true,
			pointerTools: true,
			eraseInk: true,
			blankBlack: true,
			blankWhite: true,
		}}
		onaction={onContextMenuAction}
		onclose={() => (parityUi.presentationContextMenu = null)}
	/>
{/if}
{#if presenterSession.snapshot.blackout !== 'none'}
	<div class="presenter-blackout" data-pptx-blackout style={`background:${presenterSession.snapshot.blackout}`}></div>
{/if}
{#if pointer?.tool === 'laser'}
	<div
		class="presenter-laser"
		style={`left:${(pointer.x ?? 0.5) * 100}%;top:${(pointer.y ?? 0.5) * 100}%`}
	></div>
{/if}
{#if presenterSession.snapshot.subtitlesVisible && presenterSession.snapshot.caption}
	<div class="presenter-caption">{presenterSession.snapshot.caption}</div>
{/if}
{#if vm.presenterMode}
	<PresenterView
		slides={editor.renderedSlides}
		current={viewer.current}
		canvasSize={loader.canvasSize}
		mediaDataUrls={loader.mediaDataUrls}
		startedAt={vm.presenterStartedAt}
		audienceOpen={presenterSession.audienceOpen}
		activeCustomShow={parityUi.activeCustomShowId
			? (editor.customShows.find(({ id }) => id === parityUi.activeCustomShowId) ?? null)
			: null}
		{authoredRange}
		onmove={move}
		onaudience={() =>
			presenterSession.audienceOpen
				? presenterSession.closeAudience()
				: presenterSession.openAudience()}
		onswap={() => void presenterSession.swapDisplays()}
		onexit={() => {
			presenterSession.closeAudience();
			vm.presenterMode = false;
		}}
		snapshot={presenterSession.snapshot}
		onupdate={(patch) => presenterSession.updateSnapshot(patch)}
		onnavigate={(index) => viewer.goTo(index)}
	/>
{/if}

<style>
	.pptx-svelte-show-navigator {
		position: absolute;
		inset: 0;
		z-index: 120;
	}

	.presenter-blackout {
		position: absolute;
		inset: 0;
		z-index: 75;
		/* Decorative sheet only, exactly like React's: PowerPoint still advances
		   the show when the presenter clicks a blanked screen, and the ink
		   overlay (raised above this while blanked) must keep receiving the
		   presses that draw on the "blackboard". */
		pointer-events: none;
	}

	.presenter-laser {
		position: absolute;
		z-index: 76;
		width: 20px;
		height: 20px;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: #ef4444;
		box-shadow: 0 0 20px 8px #ef444488;
		pointer-events: none;
	}

	.presenter-caption {
		position: absolute;
		z-index: 77;
		left: 10%;
		right: 10%;
		bottom: 32px;
		padding: 12px 24px;
		border-radius: 8px;
		background: #000c;
		color: #fff;
		text-align: center;
		font-size: 20px;
		pointer-events: none;
	}
</style>
