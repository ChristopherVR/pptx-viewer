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
	import { RESIZE_HANDLES } from 'pptx-viewer-shared';
	import type { ResizeHandleId } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { SelectionOverlayProps } from './props';

	const { box, scale, snapLines, editing = false, selectionCount = 1, marquee = null, onhandlepointerdown, onrotatepointerdown }:
		SelectionOverlayProps = $props();

	const t = useTranslator();

	/** Rotate-handle stem length in screen px (constant at any zoom). */
	const ROTATE_STEM_PX = 24;

	const HANDLE_CURSORS: Record<ResizeHandleId, string> = {
		nw: 'nwse-resize',
		n: 'ns-resize',
		ne: 'nesw-resize',
		e: 'ew-resize',
		se: 'nwse-resize',
		s: 'ns-resize',
		sw: 'nesw-resize',
		w: 'ew-resize',
	};

	/** Fractional handle position within the box: 0 = left/top, 1 = right/bottom. */
	const HANDLE_POSITIONS: Record<ResizeHandleId, { fx: number; fy: number }> = {
		nw: { fx: 0, fy: 0 },
		n: { fx: 0.5, fy: 0 },
		ne: { fx: 1, fy: 0 },
		e: { fx: 1, fy: 0.5 },
		se: { fx: 1, fy: 1 },
		s: { fx: 0.5, fy: 1 },
		sw: { fx: 0, fy: 1 },
		w: { fx: 0, fy: 0.5 },
	};

	const boxStyle = $derived(
		box
			? `left:${box.x * scale}px;top:${box.y * scale}px;width:${box.width * scale}px;height:${box.height * scale}px;${box.rotation ? `transform:rotate(${box.rotation}deg);` : ''}`
			: '',
	);
</script>

<div class="pptx-svelte-editor-overlay" class:is-editing={editing}>
	{#if box && !editing}
		<div class="pptx-svelte-sel-box" style={boxStyle}>
			{#if selectionCount === 1}<div
				class="pptx-svelte-rotate-stem"
				style={`height:${ROTATE_STEM_PX}px;top:${-ROTATE_STEM_PX}px`}
			></div>
			<button
				type="button"
				class="pptx-svelte-rotate-knob"
				style={`top:${-ROTATE_STEM_PX}px`}
				aria-label={t('pptx.selectionOverlay.rotate')}
				onpointerdown={onrotatepointerdown}
			></button>{/if}
			{#each RESIZE_HANDLES as handle (handle)}
				<button
					type="button"
					class="pptx-svelte-sel-handle"
					style={`left:${HANDLE_POSITIONS[handle].fx * 100}%;top:${HANDLE_POSITIONS[handle].fy * 100}%;cursor:${HANDLE_CURSORS[handle]}`}
					data-handle={handle}
					aria-label={t('pptx.selectionOverlay.resize', { handle })}
					onpointerdown={(event) => onhandlepointerdown(handle, event)}
				></button>
			{/each}
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
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
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
