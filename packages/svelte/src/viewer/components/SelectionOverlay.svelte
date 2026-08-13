<script lang="ts">
	/**
	 * SelectionOverlay: a screen-space layer over the slide stage that draws the
	 * selected element's box, its 8 resize handles, the rotate handle, and
	 * transient snap-alignment lines (Svelte port of the vanilla binding's
	 * `selection-overlay`).
	 *
	 * The layer is UNSCALED: element geometry is multiplied by the stage scale
	 * when positioned, so the handles keep a constant on-screen size at any zoom
	 * (avoiding the "handles shrink inside the zoom transform" bug the earlier
	 * bindings hit). The root and box never intercept pointer events; only the
	 * handles / rotate knob do, so a click on empty box interior still reaches
	 * the element beneath and drives a move gesture.
	 */
	import { RESIZE_HANDLE_GEOMETRY, RESIZE_HANDLES, ROTATE_STEM_PX } from 'pptx-viewer-shared';
	import type { ResizeHandleId } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { DEFAULT_SELECTION_INTERACTIVITY } from '../editor/editor-selection-interactivity';
	import type { SelectionOverlayProps } from './props';

	const { box, scale, snapLines, editing = false, selectionCount = 1, marquee = null, interactivity = DEFAULT_SELECTION_INTERACTIVITY, onhandlepointerdown, onrotatepointerdown, onadjustpointerdown }:
		SelectionOverlayProps = $props();

	const t = useTranslator();

	// Lock verdicts arrive decided (see `editor-selection-interactivity`); this
	// component only chooses what to paint. A `noResize` shape draws no resize
	// handles and a `noRotation` one no rotate stem/knob, so the affordance is
	// absent rather than present-but-inert.
	const showResize = $derived(interactivity.resizable);
	const showRotate = $derived(selectionCount === 1 && interactivity.rotatable);
	// PowerPoint's amber adjustment diamonds, ONE per `a:avLst` guide. `left` /
	// `top` are ELEMENT-LOCAL px from the element's top-left and mark where the
	// diamond's CENTRE belongs, so they are multiplied by the stage scale (this
	// layer is unscaled) and centred by the handle's own negative margin.
	const adjust = $derived(selectionCount === 1 && !editing ? interactivity.adjust : []);

	// `border-width:${scale}px` scales the outline with the zoom so it tracks
	// React's border/ring (which live inside React's scaled stage). Without it
	// the unscaled overlay draws a constant 1px screen border that looks far too
	// thick when zoomed out on mobile, where React's has shrunk below 1px.
	const boxStyle = $derived(
		box
			? `left:${box.x * scale}px;top:${box.y * scale}px;width:${box.width * scale}px;height:${box.height * scale}px;border-width:${scale}px;${box.rotation ? `transform:rotate(${box.rotation}deg);` : ''}`
			: '',
	);
</script>

<!--
	`data-pptx-selection-overlay` marks the selection chrome for hit-testing:
	on a coarse pointer the handles are finger-sized and can sit over a small
	shape's body, so the editor has to recognise a double-tap that landed on
	them (see `editor-controller`.`onStageDblClick`).
-->
<div
	class="pptx-svelte-editor-overlay"
	class:is-editing={editing}
	data-pptx-selection-overlay
>
	{#if box && !editing}
		<div class="pptx-svelte-sel-box" style={boxStyle}>
			{#if showRotate}<div
				class="pptx-svelte-rotate-stem"
				style={`height:${ROTATE_STEM_PX}px;top:${-ROTATE_STEM_PX}px`}
			></div>
			<button
				type="button"
				class="pptx-svelte-rotate-knob"
				style={`top:${-ROTATE_STEM_PX}px`}
				aria-label={t('pptx.selectionOverlay.rotate')}
				data-pptx-compact
				onpointerdown={onrotatepointerdown}
			></button>{/if}
			{#each adjust as descriptor (descriptor.key)}<button
				type="button"
				class="pptx-svelte-adjust-handle"
				style={`left:${descriptor.left * scale}px;top:${descriptor.top * scale}px;cursor:${descriptor.cursor}`}
				data-pptx-adjust-handle
				data-pptx-adjust-key={descriptor.key}
				aria-label={t('pptx.selectionOverlay.adjust')}
				data-pptx-compact
				onpointerdown={(event) => onadjustpointerdown?.(event, descriptor)}
			></button>{/each}
			{#if showResize}{#each RESIZE_HANDLES as handle (handle)}
				<button
					type="button"
					class="pptx-svelte-sel-handle"
					style={`left:${RESIZE_HANDLE_GEOMETRY[handle].fx * 100}%;top:${RESIZE_HANDLE_GEOMETRY[handle].fy * 100}%;cursor:${RESIZE_HANDLE_GEOMETRY[handle].cursor}`}
					data-handle={handle}
					aria-label={t('pptx.selectionOverlay.resize', { handle })}
					data-pptx-compact
					onpointerdown={(event) => onhandlepointerdown(handle, event)}
				></button>
			{/each}{/if}
		</div>
	{/if}
	{#if marquee}
		<div class="pptx-svelte-marquee" style={`left:${Math.min(marquee.startX, marquee.currentX) * scale}px;top:${Math.min(marquee.startY, marquee.currentY) * scale}px;width:${Math.abs(marquee.currentX - marquee.startX) * scale}px;height:${Math.abs(marquee.currentY - marquee.startY) * scale}px`}></div>
	{/if}
	<div class="pptx-svelte-snap-layer">
		{#each snapLines as line, i (i)}
			{#if line.axis === 'v'}
				<div class="pptx-svelte-snap-line pptx-svelte-snap-v" style={`left:${line.position * scale}px`}></div>
			{:else}
				<div class="pptx-svelte-snap-line pptx-svelte-snap-h" style={`top:${line.position * scale}px`}></div>
			{/if}
		{/each}
	</div>
</div>

<style>
	.pptx-svelte-editor-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 5;
	}

	.pptx-svelte-sel-box {
		position: absolute;
		box-sizing: border-box;
		border: 1px solid var(--pptx-ring, #6366f1);
		pointer-events: none;
		transform-origin: center;
	}

	.pptx-svelte-sel-handle {
		position: absolute;
		width: 10px;
		height: 10px;
		margin: -5px 0 0 -5px;
		padding: 0;
		border: 1px solid var(--pptx-ring, #6366f1);
		border-radius: 2px;
		background: var(--pptx-background, #ffffff);
		pointer-events: auto;
		/* The handle must own its touch gesture (no scroll/zoom stealing). */
		touch-action: none;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	/* PowerPoint's shape-adjustment affordance: a small amber diamond, drawn by
	   rotating a square 45deg so it needs no extra element or SVG. */
	.pptx-svelte-adjust-handle {
		position: absolute;
		width: 10px;
		height: 10px;
		margin: -5px 0 0 -5px;
		padding: 0;
		border: 1px solid #b45309;
		background: #f59e0b;
		transform: rotate(45deg);
		pointer-events: auto;
		/* The handle must own its touch gesture (no scroll/zoom stealing). */
		touch-action: none;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	.pptx-svelte-rotate-stem {
		position: absolute;
		left: 50%;
		width: 1px;
		margin-left: -0.5px;
		background: var(--pptx-ring, #6366f1);
		pointer-events: none;
	}

	.pptx-svelte-rotate-knob {
		position: absolute;
		left: 50%;
		width: 12px;
		height: 12px;
		margin: -6px 0 0 -6px;
		padding: 0;
		border: 1px solid var(--pptx-ring, #6366f1);
		border-radius: 50%;
		background: var(--pptx-background, #ffffff);
		cursor: grab;
		pointer-events: auto;
		/* The knob must own its touch gesture (no scroll/zoom stealing). */
		touch-action: none;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
	}

	/* On coarse (touch) pointers a 10px handle is far too small to grab reliably;
	   grow the resize/rotate hit targets to a finger-friendly size. */
	@media (pointer: coarse) {
		.pptx-svelte-sel-handle {
			width: 22px;
			height: 22px;
			margin: -11px 0 0 -11px;
		}

		.pptx-svelte-rotate-knob {
			width: 24px;
			height: 24px;
			margin: -12px 0 0 -12px;
		}

		.pptx-svelte-adjust-handle {
			width: 20px;
			height: 20px;
			margin: -10px 0 0 -10px;
		}
	}

	.pptx-svelte-snap-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.pptx-svelte-marquee {
		position: absolute;
		box-sizing: border-box;
		border: 1px solid var(--pptx-primary, #6366f1);
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 14%, transparent);
	}

	.pptx-svelte-snap-line {
		position: absolute;
		background: var(--pptx-destructive, #ef4444);
	}

	.pptx-svelte-snap-v {
		top: 0;
		bottom: 0;
		width: 1px;
	}

	.pptx-svelte-snap-h {
		left: 0;
		right: 0;
		height: 1px;
	}
</style>
