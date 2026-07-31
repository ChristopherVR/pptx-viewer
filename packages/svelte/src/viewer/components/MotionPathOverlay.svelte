<script lang="ts">
	/**
	 * MotionPathOverlay: draws the selected element's motion path over the stage
	 * and lets the user drag its end point (Svelte port of React's
	 * `canvas/MotionPathOverlay.tsx`).
	 *
	 * WHY it is a stage-level sibling rather than part of the element's own
	 * adorners: a motion path routinely extends far outside the shape's bounding
	 * box, and the element wrapper carries the shape's rotation / flip transform,
	 * which would skew the path. Drawn here it lives in unscaled slide-pixel
	 * space, so the only zoom maths needed is dividing the pointer delta by
	 * `scale`. The SVG applies the same `scale` transform `SlideStage` does (the
	 * Svelte overlay slot sits in the UNSCALED stage holder, unlike React's,
	 * where overlays are children of the already-scaled stage).
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import {
		isEditableMotionPath,
		motionPathEndPixel,
		motionPathToSvgD,
		setMotionPathEnd,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		element,
		path,
		canvasSize,
		scale,
		canEdit,
		onchangepath,
	}: {
		/** Element the path is anchored to; its centre is the path origin. */
		element: PptxElement;
		/** OOXML path data (slide fractions, relative to the element centre). */
		path: string;
		/** Stage size in slide pixels: the unit the path fractions scale by. */
		canvasSize: { width: number; height: number };
		/** Editor zoom, so a pointer delta converts back to slide pixels. */
		scale: number;
		/** Whether the end handle can be dragged. */
		canEdit: boolean;
		/** Commit an edited path (drag of the end handle). */
		onchangepath?: (path: string) => void;
	} = $props();

	const t = useTranslator();

	const frame = $derived({
		originX: element.x + element.width / 2,
		originY: element.y + element.height / 2,
		slideWidth: canvasSize.width,
		slideHeight: canvasSize.height,
	});
	const d = $derived(motionPathToSvgD(path, frame));
	const end = $derived(motionPathEndPixel(path, frame));
	const editable = $derived(canEdit && Boolean(onchangepath) && isEditableMotionPath(path));

	/** Live drag anchor; re-based on every committed move so deltas stay small. */
	let drag: { pointerId: number; startX: number; startY: number } | null = null;

	function onPointerDown(event: PointerEvent): void {
		if (!editable) {
			return;
		}
		event.stopPropagation();
		event.preventDefault();
		(event.currentTarget as SVGCircleElement).setPointerCapture(event.pointerId);
		drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
	}

	function onPointerMove(event: PointerEvent): void {
		if (!drag || drag.pointerId !== event.pointerId || !onchangepath) {
			return;
		}
		event.stopPropagation();
		const dxPx = (event.clientX - drag.startX) / (scale || 1);
		const dyPx = (event.clientY - drag.startY) / (scale || 1);
		const nextX = (end.x + dxPx - frame.originX) / frame.slideWidth;
		const nextY = (end.y + dyPx - frame.originY) / frame.slideHeight;
		const next = setMotionPathEnd(path, nextX, nextY);
		if (next !== path) {
			drag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
			onchangepath(next);
		}
	}

	function onPointerUp(event: PointerEvent): void {
		if (drag?.pointerId === event.pointerId) {
			(event.currentTarget as SVGCircleElement).releasePointerCapture(event.pointerId);
			drag = null;
		}
	}
</script>

{#if d}
	<svg
		class="pptx-svelte-motionpath-overlay"
		width={canvasSize.width}
		height={canvasSize.height}
		style={`transform: scale(${scale}); transform-origin: top left`}
		role="img"
		aria-label={t('pptx.animation.motionPath.overlay')}
		data-pptx-motion-path-overlay="true"
	>
		<path {d} fill="none" stroke="#0ea5e9" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" />
		<circle cx={frame.originX} cy={frame.originY} r="5" fill="#0ea5e9" opacity="0.55" />
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- Deliberately role-less, matching React byte for byte: the handle is a
		     drag affordance inside an `img`-role overlay, and giving it a widget
		     role here would make Svelte's accessibility tree diverge from the
		     other four bindings that the parity spec diffs. It carries the same
		     `aria-label` and `data-pptx-motion-path-handle` contract instead. -->
		<circle
			cx={end.x}
			cy={end.y}
			r="7"
			fill="#ffffff"
			stroke="#0ea5e9"
			stroke-width="2"
			class:is-editable={editable}
			aria-label={t('pptx.animation.motionPath.endHandle')}
			data-pptx-motion-path-handle="end"
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		/>
	</svg>
{/if}

<style>
	.pptx-svelte-motionpath-overlay {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 45;
		/* The path is an annotation: only the end handle takes the pointer, so a
		   click anywhere else still reaches the element underneath. */
		pointer-events: none;
		overflow: visible;
	}

	.pptx-svelte-motionpath-overlay circle.is-editable {
		pointer-events: auto;
		cursor: move;
	}
</style>
