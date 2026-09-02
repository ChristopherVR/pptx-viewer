<script lang="ts">
	/**
	 * SlideOverlays: the overlay stack painted on top of the scaled slide stage
	 * (AI focus/change animations, alignment guides, the editing layer, ink,
	 * presentation annotations, collaboration presence, transition overlay).
	 *
	 * Lifted out of `ViewerBody` so that file stays a layout shell: this is one
	 * cohesive concern (things drawn IN slide space, above the slide) and each
	 * member is gated by exactly one flag, which reads far better as its own
	 * component than as eight sibling `{#if}` blocks buried in the body.
	 */
	import { motionPathFor } from 'pptx-viewer-shared';

	import CollaborationCursors from '../collab/components/CollaborationCursors.svelte';
	import RemoteSelectionOverlay from '../collab/components/RemoteSelectionOverlay.svelte';
	import { PresentationTransitionOverlay } from '../presentation';
	import AiChangeOverlay from './ai/AiChangeOverlay.svelte';
	import AiFocusHighlightOverlay from './ai/AiFocusHighlightOverlay.svelte';
	import AlignmentGuides from './AlignmentGuides.svelte';
	import EditorLayer from './EditorLayer.svelte';
	import InkDrawingOverlay from './InkDrawingOverlay.svelte';
	import MotionPathOverlay from './MotionPathOverlay.svelte';
	import PresentationAnnotationOverlay from './PresentationAnnotationOverlay.svelte';
	import type { SlideOverlaysProps } from './viewer-body-props';

	const {
		editor,
		controller,
		canvasSize,
		mediaDataUrls,
		current,
		activeSlide,
		scale,
		presenting,
		presentationTransition,
		onTransitionDone,
		editingActive,
		blackout = 'none',
		collabCursors = [],
		collabPresences = [],
		annotations,
		guides = [],
		onchangeguide,
		ondeleteguide,
		spellCheck = false,
		aiHighlights = [],
		aiChangeBatch = null,
	}: SlideOverlaysProps = $props();

	// The path lives on the SLIDE's animation entry for the selected element, so
	// the overlay only needs the id to find it and a commit callback to edit it.
	const selectedElement = $derived(editingActive ? editor.selectedElement : undefined);
	const selectedMotionPath = $derived(
		selectedElement ? motionPathFor(activeSlide?.animations ?? [], selectedElement.id) : undefined,
	);
</script>

{#if aiHighlights.length > 0}
	<AiFocusHighlightOverlay
		highlights={aiHighlights}
		elements={activeSlide?.elements ?? []}
		activeSlideIndex={current}
		{scale}
		{canvasSize}
	/>
{/if}
{#if aiChangeBatch}
	<AiChangeOverlay batch={aiChangeBatch} activeSlideIndex={current} {scale} {canvasSize} />
{/if}
{#if editingActive && guides.length && onchangeguide}
	<AlignmentGuides {guides} {scale} onchange={onchangeguide} ondelete={ondeleteguide} />
{/if}
{#if editingActive}
	<EditorLayer {controller} {scale} {spellCheck} />
	<InkDrawingOverlay ink={editor.inkOps} {canvasSize} />
{/if}
{#if selectedElement && selectedMotionPath}
	<MotionPathOverlay
		element={selectedElement}
		path={selectedMotionPath}
		{canvasSize}
		{scale}
		canEdit={editor.editable}
		onchangepath={(next) => editor.animationOps.setMotionPath(next)}
	/>
{/if}
{#if presenting}<PresentationAnnotationOverlay {annotations} {current} {canvasSize} {blackout} />{/if}
{#if collabPresences.length > 0}
	<RemoteSelectionOverlay
		presences={collabPresences}
		elements={activeSlide?.elements ?? []}
		activeSlideIndex={current}
		zoom={scale}
	/>
{/if}
{#if collabCursors.length > 0}
	<CollaborationCursors cursors={collabCursors} zoom={scale} />
{/if}
{#if presenting && presentationTransition}
	<PresentationTransitionOverlay
		outgoingSlide={presentationTransition.outgoing}
		incomingSlide={presentationTransition.incoming}
		{canvasSize}
		{mediaDataUrls}
		{scale}
		transition={presentationTransition.transition}
		ondone={onTransitionDone}
	/>
{/if}
