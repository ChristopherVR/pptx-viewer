<script lang="ts">
	/**
	 * RulerStrips: the horizontal + vertical rulers behind View > Rulers.
	 *
	 * Svelte port of React's `Ruler` / `RulerStrips`. Drawn as a sibling of the
	 * scaled stage (NOT inside it) so the stage's CSS transform never scales the
	 * tick strokes or the labels: the strips receive `scale` and lay their ticks
	 * out in already-scaled screen px instead, which is what makes the ruler
	 * track zoom while staying legible at every zoom level.
	 *
	 * Tick geometry comes from `pptx-viewer-shared` (`generateTicks`), the same
	 * generator React and Vue use, so all three agree on unit, subdivision
	 * density and label thinning. Dragging off a strip drops a guide, resolved by
	 * the shared `rulerDragToGuidePosition` rules.
	 */
	import { generateTicks, RULER_FONT_SIZE, RULER_THICKNESS, rulerDragToGuidePosition } from 'pptx-viewer-shared';

	import type { RulerStripsProps } from './viewer-body-props';

	const {
		canvasSize,
		scale,
		unit = 'inches',
		selectedBounds = null,
		oncreateguide,
	}: RulerStripsProps = $props();

	const T = RULER_THICKNESS;
	const FS = RULER_FONT_SIZE;

	const scaledWidth = $derived(canvasSize.width * scale);
	const scaledHeight = $derived(canvasSize.height * scale);
	const hTicks = $derived(generateTicks(canvasSize.width, scale, unit));
	const vTicks = $derived(generateTicks(canvasSize.height, scale, unit));

	/** Selected-element extent, in scaled px, highlighted on each strip. */
	const hHighlight = $derived(
		selectedBounds
			? { start: selectedBounds.x * scale, span: Math.max(selectedBounds.width * scale, 1) }
			: null,
	);
	const vHighlight = $derived(
		selectedBounds
			? { start: selectedBounds.y * scale, span: Math.max(selectedBounds.height * scale, 1) }
			: null,
	);

	// A guide is created on pointer-UP, not pointer-down, so a stray click on the
	// ruler cannot drop a guide the user never dragged out (React does the same).
	// eslint-disable-next-line prefer-const
	let dragAxis = $state<'h' | 'v' | null>(null);

	function startDrag(axis: 'h' | 'v', event: PointerEvent): void {
		if (!oncreateguide) {
			return;
		}
		event.preventDefault();
		(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
		dragAxis = axis;
	}

	function endDrag(event: PointerEvent): void {
		const axis = dragAxis;
		dragAxis = null;
		if (!axis || !oncreateguide) {
			return;
		}
		const strip = event.currentTarget as Element | null;
		if (!strip) {
			return;
		}
		try {
			strip.releasePointerCapture?.(event.pointerId);
		} catch {
			// Capture may already have been released by the browser.
		}
		const rect = strip.getBoundingClientRect();
		const offset = axis === 'h' ? event.clientY - rect.top : event.clientX - rect.left;
		const position = rulerDragToGuidePosition(
			offset,
			scale,
			axis === 'h' ? canvasSize.height : canvasSize.width,
		);
		if (position !== null) {
			oncreateguide(axis, position);
		}
	}
</script>

<!-- Corner square where the two strips meet. -->
<div class="pptx-svelte-ruler-corner" style={`width:${T}px;height:${T}px`} aria-hidden="true"></div>

<!-- Horizontal ruler: spans the top of the stage; drag down for an h-guide. -->
<svg
	class="pptx-svelte-ruler pptx-svelte-ruler-h"
	class:pptx-svelte-ruler-draggable={Boolean(oncreateguide)}
	style={`left:${T}px;width:${scaledWidth}px;height:${T}px`}
	width={scaledWidth}
	height={T}
	data-pptx-ruler="h"
	role="presentation"
	onpointerdown={(event) => startDrag('h', event)}
	onpointerup={endDrag}
>
	<rect width={scaledWidth} height={T} class="pptx-svelte-ruler-bg" />
	{#if hHighlight}
		<rect x={hHighlight.start} y={0} width={hHighlight.span} height={T} class="pptx-svelte-ruler-highlight" />
	{/if}
	{#each hTicks as tick, index (index)}
		<line
			x1={tick.position}
			y1={T}
			x2={tick.position}
			y2={T - (tick.isMajor ? T * 0.6 : T * 0.3)}
			class="pptx-svelte-ruler-tick"
			stroke-width={tick.isMajor ? 1 : 0.5}
		/>
		{#if tick.label}
			<text x={tick.position + 2} y={FS + 1} font-size={FS} class="pptx-svelte-ruler-label">{tick.label}</text>
		{/if}
	{/each}
	<line x1={0} y1={T - 0.5} x2={scaledWidth} y2={T - 0.5} class="pptx-svelte-ruler-edge" stroke-width="1" />
</svg>

<!-- Vertical ruler: spans the left of the stage; drag right for a v-guide. -->
<svg
	class="pptx-svelte-ruler pptx-svelte-ruler-v"
	class:pptx-svelte-ruler-draggable={Boolean(oncreateguide)}
	style={`top:${T}px;width:${T}px;height:${scaledHeight}px`}
	width={T}
	height={scaledHeight}
	data-pptx-ruler="v"
	role="presentation"
	onpointerdown={(event) => startDrag('v', event)}
	onpointerup={endDrag}
>
	<rect width={T} height={scaledHeight} class="pptx-svelte-ruler-bg" />
	{#if vHighlight}
		<rect x={0} y={vHighlight.start} width={T} height={vHighlight.span} class="pptx-svelte-ruler-highlight" />
	{/if}
	{#each vTicks as tick, index (index)}
		<line
			x1={T}
			y1={tick.position}
			x2={T - (tick.isMajor ? T * 0.6 : T * 0.3)}
			y2={tick.position}
			class="pptx-svelte-ruler-tick"
			stroke-width={tick.isMajor ? 1 : 0.5}
		/>
		{#if tick.label}
			<text x={2} y={tick.position + FS + 2} font-size={FS} class="pptx-svelte-ruler-label">{tick.label}</text>
		{/if}
	{/each}
	<line x1={T - 0.5} y1={0} x2={T - 0.5} y2={scaledHeight} class="pptx-svelte-ruler-edge" stroke-width="1" />
</svg>

<style>
	.pptx-svelte-ruler-corner {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 51;
		background: var(--pptx-muted, #f1f5f9);
		border-right: 1px solid var(--pptx-border, #cbd5e1);
		border-bottom: 1px solid var(--pptx-border, #cbd5e1);
	}

	.pptx-svelte-ruler {
		position: absolute;
		z-index: 50;
		display: block;
		user-select: none;
		touch-action: none;
	}

	.pptx-svelte-ruler-h {
		top: 0;
	}

	.pptx-svelte-ruler-v {
		left: 0;
	}

	.pptx-svelte-ruler-h.pptx-svelte-ruler-draggable {
		cursor: row-resize;
	}

	.pptx-svelte-ruler-v.pptx-svelte-ruler-draggable {
		cursor: col-resize;
	}

	.pptx-svelte-ruler-bg {
		fill: var(--pptx-muted, #f1f5f9);
	}

	.pptx-svelte-ruler-edge {
		stroke: var(--pptx-border, #cbd5e1);
	}

	.pptx-svelte-ruler-tick {
		stroke: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-ruler-highlight {
		fill: var(--pptx-primary, #2563eb);
		opacity: 0.2;
	}

	.pptx-svelte-ruler-label {
		fill: var(--pptx-muted-foreground, #94a3b8);
		font-family: system-ui, sans-serif;
	}
</style>
