<script lang="ts">
	/**
	 * The ink canvas a show draws annotations onto. It is DRAWING SURFACE ONLY:
	 * the tool palette that used to sit in its bottom-right corner (five buttons
	 * whose accessible names were the raw tool ids, plus a colour input) has
	 * moved into `PresentationToolbar.svelte`, so the show has one toolbar with
	 * translated labels instead of a second, competing strip.
	 */
	import { annotationCapturesPointer, annotationOverlayZIndex, pointsToSvgPathD } from 'pptx-viewer-shared';
	import type { CanvasSize, PresentationBlackout } from 'pptx-viewer-shared';
	import type { PresentationAnnotations } from '../presentation/presentation-annotations.svelte';

	const { annotations, current, canvasSize, blackout = 'none' }: { annotations: PresentationAnnotations; current: number; canvasSize: CanvasSize; blackout?: PresentationBlackout } = $props();
	function point(event: PointerEvent): { x: number; y: number } { const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvasSize.width / rect.width, y: (event.clientY - rect.top) * canvasSize.height / rect.height }; }
	const capturing = $derived(annotationCapturesPointer(annotations.tool));
	/**
	 * Keep the drawing gesture off the show surface. The overlay sits INSIDE the
	 * stage holder, whose click advances the show while presenting, so without
	 * this a finished stroke stepped to the next slide and took the ink with it
	 * (the stroke belongs to the slide it was drawn on). It has to run on the
	 * `click` too: cancelling the pointerdown does not suppress that, and the
	 * stage's advance is a delegated `click` handler. Both calls are template
	 * handlers because Svelte dispatches these events from the app root, where
	 * `stopPropagation` is what ends the delegated walk. See shared
	 * `annotationCapturesPointer`.
	 */
	function keepGesture(event: PointerEvent | MouseEvent): void { if (capturing) { event.preventDefault(); event.stopPropagation(); } }
</script>
<!-- The z-index comes from shared `annotationOverlayZIndex` as an inline style
     (a scoped style block cannot read a TS value): 60 during a normal show,
     raised above the blackout sheet (z 75) while the screen is blanked so
     "blackboard" ink stays visible. -->
<div class="overlay" class:interactive={capturing} data-pptx-annotation-overlay style={`z-index:${annotationOverlayZIndex(blackout)}`}>
	<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -- the drawing surface is pointer-only by nature; the show's keyboard commands live on the viewer root, and `onclick` here exists solely to keep a stroke from also advancing the slide -->
	<svg role="application" aria-label="Slide annotations" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} preserveAspectRatio="none" onpointerdown={(event) => { keepGesture(event); event.currentTarget.setPointerCapture(event.pointerId); annotations.pointerDown(current, point(event)); }} onpointermove={(event) => annotations.pointerMove(current, point(event))} onpointerup={(event) => { keepGesture(event); annotations.pointerUp(current); }} onclick={keepGesture} onpointerleave={() => (annotations.laser = null)}>
		{#each annotations.strokes(current) as stroke}<path d={pointsToSvgPathD(stroke.points)} stroke={stroke.color} stroke-width={stroke.width} stroke-opacity={stroke.tool === 'highlighter' ? .4 : 1} />{/each}
		{#if annotations.current}<path d={pointsToSvgPathD(annotations.current.points)} stroke={annotations.current.color} stroke-width={annotations.current.width} stroke-opacity={annotations.current.tool === 'highlighter' ? .4 : 1} />{/if}
		{#if annotations.laser}<circle cx={annotations.laser.x} cy={annotations.laser.y} r="7" class="laser" />{/if}
	</svg>
</div>
<style>
	.overlay{position:absolute;inset:0;pointer-events:none}.overlay svg{width:100%;height:100%;touch-action:none}.overlay.interactive svg{pointer-events:auto}.overlay path{fill:none;stroke-linecap:round;stroke-linejoin:round}.laser{fill:#ef4444;filter:drop-shadow(0 0 8px #ef4444)}
</style>
