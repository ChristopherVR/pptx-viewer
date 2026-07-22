<script lang="ts">
	/**
	 * AiChangeOverlay: plays the "watch the AI edit land" animation (Svelte port of
	 * React's `AiChangeOverlay`). For each element the assistant just changed on the
	 * visible slide it draws a ghost rect that, on the next frame, flips from its
	 * `start` to `end` state so the browser transitions between them: added elements
	 * fade+scale in, removed fade+scale out, moved/resized glide old->new, all under
	 * a glow-pulse.
	 *
	 * Like {@link AiFocusHighlightOverlay}, the overlay sits inside the (unscaled)
	 * stage-holder and applies the same `scale` transform as `SlideStage`, so the
	 * change bounds (slide CSS pixels, carried on each change) map 1:1. Purely
	 * presentational: the batch (with per-element from/to bounds + resolved config)
	 * comes from the shared {@link AiChangeAnimator} via the panel controller, so no
	 * element lookup is needed.
	 */
	import type { AiChangeBatch, AiElementChange, ResolvedAiChangeAnimationConfig } from 'pptx-viewer-shared/ai';
	import { aiChangeAnimationCss, changeGhostStyle } from 'pptx-viewer-shared/ai';

	const {
		batch,
		activeSlideIndex,
		scale,
		canvasSize,
	}: {
		batch: AiChangeBatch | null;
		activeSlideIndex: number;
		scale: number;
		canvasSize: { width: number; height: number };
	} = $props();

	let phase = $state<'start' | 'end'>('start');

	// Two frames: let the browser paint the `start` state before flipping to `end`,
	// so the CSS transition actually runs instead of snapping. Re-armed per batch
	// (the nonce read below makes this effect depend on each new batch).
	$effect(() => {
		const active = batch;
		void active?.nonce;
		if (!active) {
			return;
		}
		phase = 'start';
		let inner = 0;
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => {
				phase = 'end';
			});
		});
		return () => {
			cancelAnimationFrame(outer);
			cancelAnimationFrame(inner);
		};
	});

	const changes = $derived(
		batch ? batch.changes.filter((change) => change.slideIndex === activeSlideIndex) : [],
	);

	const stageStyle = $derived(
		`width:${canvasSize.width}px;height:${canvasSize.height}px;transform:scale(${scale});transform-origin:top left`,
	);

	/** Serialise the shared React-style `GhostStyle` object into a CSS string. */
	function ghostStyle(change: AiElementChange, config: ResolvedAiChangeAnimationConfig): string {
		const s = changeGhostStyle(change, phase, config);
		return [
			`position:${s.position}`,
			`left:${s.left}px`,
			`top:${s.top}px`,
			`width:${s.width}px`,
			`height:${s.height}px`,
			`opacity:${s.opacity}`,
			`transform:${s.transform}`,
			`transition:${s.transition}`,
			`box-shadow:${s.boxShadow}`,
			`border:${s.border}`,
			`border-radius:${s.borderRadius}`,
			`pointer-events:${s.pointerEvents}`,
			`z-index:${s.zIndex}`,
		].join(';');
	}
</script>

<svelte:head>
	{#if batch}
		{@html `<style>${aiChangeAnimationCss(batch.config)}</style>`}
	{/if}
</svelte:head>

{#if batch && changes.length > 0}
	<div class="pptx-svelte-ai-change-stage" style={stageStyle} aria-hidden="true" data-export-ignore="true">
		{#each changes as change (`${change.elementId}-${batch.nonce}`)}
			<div
				data-testid={`ai-change-${change.elementId}`}
				data-ai-change={change.kind}
				data-export-ignore="true"
				style={ghostStyle(change, batch.config)}
			></div>
		{/each}
	</div>
{/if}

<style>
	.pptx-svelte-ai-change-stage {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		z-index: 9997;
	}
</style>
