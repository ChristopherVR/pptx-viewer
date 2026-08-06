<script lang="ts">
	/**
	 * The ink canvas a show draws annotations onto. It is DRAWING SURFACE ONLY:
	 * the tool palette that used to sit in its bottom-right corner (five buttons
	 * whose accessible names were the raw tool ids, plus a colour input) has
	 * moved into `PresentationToolbar.svelte`, so the show has one toolbar with
	 * translated labels instead of a second, competing strip.
	 */
	import { annotationOverlayZIndex, pointsToSvgPathD } from 'pptx-viewer-shared';
	import type { CanvasSize, PresentationBlackout } from 'pptx-viewer-shared';
	import type { PresentationAnnotations } from '../presentation/presentation-annotations.svelte';

	const { annotations, current, canvasSize, blackout = 'none' }: { annotations: PresentationAnnotations; current: number; canvasSize: CanvasSize; blackout?: PresentationBlackout } = $props();
	function point(event: PointerEvent): { x: number; y: number } { const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvasSize.width / rect.width, y: (event.clientY - rect.top) * canvasSize.height / rect.height }; }
</script>
<!-- The z-index comes from shared `annotationOverlayZIndex` as an inline style
     (a scoped style block cannot read a TS value): 60 during a normal show,
     raised above the blackout sheet (z 75) while the screen is blanked so
     "blackboard" ink stays visible. -->
<div class="overlay" class:interactive={annotations.tool !== 'none'} data-pptx-annotation-overlay style={`z-index:${annotationOverlayZIndex(blackout)}`}>
	<svg role="application" aria-label="Slide annotations" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} preserveAspectRatio="none" onpointerdown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); annotations.pointerDown(current, point(event)); }} onpointermove={(event) => annotations.pointerMove(current, point(event))} onpointerup={() => annotations.pointerUp(current)} onpointerleave={() => (annotations.laser = null)}>
		{#each annotations.strokes(current) as stroke}<path d={pointsToSvgPathD(stroke.points)} stroke={stroke.color} stroke-width={stroke.width} stroke-opacity={stroke.tool === 'highlighter' ? .4 : 1} />{/each}
		{#if annotations.current}<path d={pointsToSvgPathD(annotations.current.points)} stroke={annotations.current.color} stroke-width={annotations.current.width} stroke-opacity={annotations.current.tool === 'highlighter' ? .4 : 1} />{/if}
		{#if annotations.laser}<circle cx={annotations.laser.x} cy={annotations.laser.y} r="7" class="laser" />{/if}
	</svg>
</div>
<style>
	.overlay{position:absolute;inset:0;pointer-events:none}.overlay svg{width:100%;height:100%;touch-action:none}.overlay.interactive svg{pointer-events:auto}.overlay path{fill:none;stroke-linecap:round;stroke-linejoin:round}.laser{fill:#ef4444;filter:drop-shadow(0 0 8px #ef4444)}
</style>
