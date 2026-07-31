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
	import type { ViewerStateBag } from '../state/create-viewer-state-types';
	import PresentationEndScreen from './PresentationEndScreen.svelte';
	import PresentationTouchControls from './PresentationTouchControls.svelte';
	import PresenterView from './PresenterView.svelte';

	const { vm }: { vm: ViewerStateBag } = $props();

	// Stable controller references (the bag is built once and never reassigned).
	// svelte-ignore state_referenced_locally
	const { loader, viewer, editor, presentation, presenterSession } = vm;
	const pointer = $derived(presenterSession.snapshot.pointer);
</script>

{#if viewer.isFullscreen}
	<PresentationTouchControls
		current={viewer.current}
		total={viewer.slideCount}
		onprev={() => (presentation.retreat() ? undefined : viewer.prev())}
		onnext={() => presentation.advance()}
		onexit={vm.onFullscreenToggle}
	/>
{/if}
<!-- Black "End of slide show" screen: the show has run past its last slide.
     It MUST be visible - while it is up the next input either goes nowhere
     (backward) or ends the show (forward), so a deck that kept painting the
     last slide looked stuck and then exited with no warning. -->
{#if viewer.isFullscreen && presentation.endOfShowVisible}
	<PresentationEndScreen onexit={() => presentation.advance()} />
{/if}
{#if presenterSession.snapshot.blackout !== 'none'}
	<div class="presenter-blackout" style={`background:${presenterSession.snapshot.blackout}`}></div>
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
		onmove={(direction) => viewer.goTo(viewer.current + direction)}
		onaudience={() =>
			presenterSession.audienceOpen
				? presenterSession.closeAudience()
				: presenterSession.openAudience()}
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
	.presenter-blackout {
		position: absolute;
		inset: 0;
		z-index: 75;
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
