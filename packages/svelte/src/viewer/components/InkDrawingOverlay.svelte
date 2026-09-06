<script lang="ts">
	/**
	 * InkDrawingOverlay: renders the in-progress pen/highlighter stroke's live
	 * SVG preview while `EditorInkController` accumulates points from the
	 * stage's pointer gesture (`editor-ink-gesture.ts`). Pure presentation; all
	 * stroke maths lives in the editor modules.
	 *
	 * Sized to the stage-holder's already-scaled screen box (`inset: 0`, like
	 * `EditorLayer`'s overlay) with an inner `<svg viewBox>` spanning the raw,
	 * unscaled slide canvas: the path's point coordinates come straight out of
	 * the pointer gesture in slide-space px, so the browser's intrinsic
	 * viewBox-to-box scaling does the same zoom-proportional scaling `SlideStage`
	 * gets from its own `transform: scale()`, including stroke width.
	 *
	 * Renders `ink.liveStrokeView`: the same plain-path / pressure-circle /
	 * tilt-nib decision `InkView.svelte` makes for a committed stroke, so a
	 * calligraphic lean or pressure-variable width shows up while the pointer
	 * is still down, not only after `pointerup` commits the stroke.
	 */
	import type { CanvasSize } from 'pptx-viewer-shared';

	import type { EditorInkController } from '../editor/editor-ink-controller.svelte';

	const { ink, canvasSize }: { ink: EditorInkController; canvasSize: CanvasSize } = $props();
	const view = $derived(ink.liveStrokeView);
</script>

{#if view}
	<div class="pptx-svelte-ink-overlay" aria-hidden="true">
		<svg
			class="pptx-svelte-ink-overlay-svg"
			viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
			preserveAspectRatio="none"
		>
			{#if view.nibMarks}
				<g opacity={view.opacity}>
					{#each view.nibMarks as mark, i (i)}
						<ellipse
							cx={mark.cx}
							cy={mark.cy}
							rx={mark.rPerp}
							ry={mark.rTilt}
							transform={`rotate(${mark.rotationDeg} ${mark.cx} ${mark.cy})`}
							fill={view.color}
						/>
					{/each}
				</g>
			{:else if view.circles}
				<g opacity={view.opacity}>
					{#each view.circles as circle, i (i)}
						<circle cx={circle.cx} cy={circle.cy} r={circle.r} fill={view.color} />
					{/each}
				</g>
			{:else}
				<path
					d={view.d}
					fill="none"
					stroke={view.color}
					stroke-width={view.width}
					stroke-opacity={view.opacity}
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{/if}
		</svg>
	</div>
{/if}

<style>
	.pptx-svelte-ink-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 6;
	}

	.pptx-svelte-ink-overlay-svg {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
