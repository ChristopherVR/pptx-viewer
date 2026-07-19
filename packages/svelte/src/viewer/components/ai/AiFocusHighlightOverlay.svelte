<script lang="ts">
	/**
	 * AiFocusHighlightOverlay: draws animated rings around the element(s) the AI
	 * assistant is focused on. Two variants share the same overlay:
	 *   - `pick`  : a persistent, subtle ring for an element the user handed to the
	 *     assistant in pick mode (with a brief entry pulse).
	 *   - `active`: a livelier pulsing ring for the element a running tool is
	 *     touching right now ("the AI is looking at / working on this").
	 *
	 * The overlay is placed inside the (unscaled) stage-holder and applies the same
	 * `scale` transform as `SlideStage`, so element canvas coordinates map 1:1.
	 * Purely presentational: it reads element bounds from the active slide and the
	 * highlight list computed by {@link AiPanelController}.
	 */
	import type { PptxElement } from 'pptx-viewer-core';

	import type { AiCanvasHighlight } from '../../ai/ai-panel-controller.svelte';

	const {
		highlights,
		elements,
		activeSlideIndex,
		scale,
		canvasSize,
	}: {
		highlights: readonly AiCanvasHighlight[];
		elements: readonly PptxElement[];
		activeSlideIndex: number;
		scale: number;
		canvasSize: { width: number; height: number };
	} = $props();

	const byId = $derived(new Map(elements.map((el) => [el.id, el])));
	const visible = $derived(
		highlights
			.filter((hl) => hl.slideIndex === activeSlideIndex && byId.has(hl.elementId))
			.map((hl) => ({ hl, el: byId.get(hl.elementId) as PptxElement })),
	);

	const stageStyle = $derived(
		`width:${canvasSize.width}px;height:${canvasSize.height}px;transform:scale(${scale});transform-origin:top left`,
	);

	function ringStyle(el: PptxElement): string {
		return `left:${el.x - 3}px;top:${el.y - 3}px;width:${el.width + 6}px;height:${el.height + 6}px`;
	}
</script>

{#if visible.length > 0}
	<div class="pptx-svelte-ai-hl-stage" style={stageStyle} aria-hidden="true" data-export-ignore="true">
		{#each visible as { hl, el } (`${hl.variant}-${hl.elementId}`)}
			<div
				class="pptx-svelte-ai-hl-ring"
				class:is-active={hl.variant === 'active'}
				data-ai-highlight={hl.variant}
				style={ringStyle(el)}
			></div>
		{/each}
	</div>
{/if}

<style>
	.pptx-svelte-ai-hl-stage {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		z-index: 9998;
	}

	.pptx-svelte-ai-hl-ring {
		position: absolute;
		border-radius: 3px;
		border: 2px solid rgba(59, 130, 246, 0.55);
		box-shadow: 0 0 10px 2px rgba(59, 130, 246, 0.18);
		animation: pptx-svelte-ai-ring-in 0.9s ease-out;
	}

	.pptx-svelte-ai-hl-ring.is-active {
		border-color: rgba(59, 130, 246, 0.9);
		box-shadow: none;
		animation:
			pptx-svelte-ai-ring-in 0.18s ease-out,
			pptx-svelte-ai-ring-pulse 1s ease-out infinite;
	}

	@keyframes pptx-svelte-ai-ring-in {
		0% {
			opacity: 0;
			transform: scale(1.04);
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}

	@keyframes pptx-svelte-ai-ring-pulse {
		0% {
			box-shadow:
				0 0 0 0 rgba(59, 130, 246, 0.55),
				0 0 0 0 rgba(59, 130, 246, 0.35);
		}
		70% {
			box-shadow:
				0 0 0 6px rgba(59, 130, 246, 0),
				0 0 14px 4px rgba(59, 130, 246, 0.28);
		}
		100% {
			box-shadow:
				0 0 0 0 rgba(59, 130, 246, 0),
				0 0 10px 2px rgba(59, 130, 246, 0.22);
		}
	}
</style>
