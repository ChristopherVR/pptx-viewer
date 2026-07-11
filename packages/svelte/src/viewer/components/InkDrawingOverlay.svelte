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
	 */
	import type { CanvasSize } from 'pptx-viewer-shared';

	import type { EditorInkController } from '../editor/editor-ink-controller.svelte';

	const { ink, canvasSize }: { ink: EditorInkController; canvasSize: CanvasSize } = $props();
</script>

{#if ink.livePathD}
	<div class="pptx-svelte-ink-overlay" aria-hidden="true">
		<svg
			class="pptx-svelte-ink-overlay-svg"
			viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
			preserveAspectRatio="none"
		>
			<path
				d={ink.livePathD}
				fill="none"
				stroke={ink.color}
				stroke-width={ink.width}
				stroke-opacity={ink.tool === 'highlighter' ? 0.4 : 1}
				stroke-linecap="round"
				stroke-linejoin="round"
			/>
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
