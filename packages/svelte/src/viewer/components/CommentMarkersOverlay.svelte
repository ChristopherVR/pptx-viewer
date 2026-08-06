<script lang="ts">
	/**
	 * CommentMarkersOverlay: numbered comment marker dots drawn over the slide
	 * stage (Svelte port of React's `canvas/CommentMarkersOverlay.tsx` / Vue's
	 * `CommentMarkersOverlay.vue`). The descriptors (position clamped to the
	 * slide or a 4-column grid fallback, 1-based numbering, and the
	 * `"<author>: <text>"` tooltip) come from the shared `buildCommentMarkers`,
	 * so the dots match every other binding. Rendered INSIDE the stage so the
	 * dots live in the `aria-roledescription="slide"` region, authored in raw
	 * slide coordinates (the stage's CSS scale applies exactly once).
	 */
	import type { PptxComment } from 'pptx-viewer-core';
	import type { CanvasSize } from 'pptx-viewer-shared';
	import { buildCommentMarkers, COMMENT_MARKER_SIZE } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		comments,
		canvasSize,
		onmarkerclick,
	}: {
		comments: readonly PptxComment[];
		canvasSize: CanvasSize;
		onmarkerclick?: (commentId: string) => void;
	} = $props();

	const t = useTranslator();

	const markers = $derived(
		buildCommentMarkers(
			comments,
			canvasSize.width,
			canvasSize.height,
			t('pptx.comments.unknownAuthor'),
		),
	);

	const half = COMMENT_MARKER_SIZE / 2;

	function handleClick(event: MouseEvent, commentId: string): void {
		event.stopPropagation();
		onmarkerclick?.(commentId);
	}
</script>

<div class="pptx-svelte-comment-markers">
	{#each markers as marker (marker.commentId)}
		<button
			type="button"
			class="pptx-svelte-comment-marker"
			style={`left:${marker.x - half}px;top:${marker.y - half}px;width:${COMMENT_MARKER_SIZE}px;height:${COMMENT_MARKER_SIZE}px`}
			title={marker.title}
			onclick={(event) => handleClick(event, marker.commentId)}
		>{marker.label}</button>
	{/each}
</div>

<style>
	.pptx-svelte-comment-markers {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 45;
	}

	.pptx-svelte-comment-marker {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0;
		pointer-events: auto;
		cursor: pointer;
		border-radius: 50%;
		background: rgba(255, 165, 0, 0.9);
		border: 2px solid #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
		font-size: 10px;
		font-weight: 700;
		line-height: 1;
		color: #fff;
	}
</style>
