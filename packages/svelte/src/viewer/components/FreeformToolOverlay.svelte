<script lang="ts">
	/**
	 * FreeformToolOverlay: the capture layer of the click-to-place Freeform:
	 * Shape and Curve tools (Svelte port of React's
	 * `canvas/FreeformToolOverlay.tsx`). The gesture itself (corners, freehand
	 * runs, smooth spans, closing on the start point, double-click / Enter /
	 * Escape) is the shared `FreeformToolSession`; this only paints its preview
	 * and forwards events. Re-created per tool by `OutlineAuthoringLayer`.
	 */
	import type { ShapePptxElement } from 'pptx-viewer-core';
	import type { FreeformToolKind } from 'pptx-viewer-shared';
	import { attachOverlayKeyboard, clientToSlidePoint, FreeformToolSession } from 'pptx-viewer-shared';
	import { untrack } from 'svelte';

	import { useTranslator } from '../../i18n/context';

	const {
		tool,
		canvasSize,
		scale,
		oncommit,
		oncancel,
	}: {
		tool: FreeformToolKind;
		canvasSize: { width: number; height: number };
		scale: number;
		oncommit: (element: ShapePptxElement) => void;
		oncancel: () => void;
	} = $props();

	const t = useTranslator();
	let version = $state(0);
	// eslint-disable-next-line prefer-const
	let svgEl = $state<SVGSVGElement | null>(null);

	const session = new FreeformToolSession({
		tool: untrack(() => tool),
		onCommit: (element) => oncommit(element),
		onCancel: () => oncancel(),
		onChange: () => {
			version += 1;
		},
	});

	$effect(() => {
		session.setScale(scale);
	});
	$effect(() => attachOverlayKeyboard(session));

	const view = $derived.by(() => {
		void version;
		void scale;
		return session.view();
	});

	function point(event: PointerEvent | MouseEvent): { x: number; y: number } {
		return clientToSlidePoint(
			svgEl ?? (event.currentTarget as Element),
			event.clientX,
			event.clientY,
			canvasSize.width,
			canvasSize.height,
		);
	}

	function onPointerDown(event: PointerEvent): void {
		event.stopPropagation();
		event.preventDefault();
		(event.currentTarget as SVGSVGElement).setPointerCapture?.(event.pointerId);
		session.pointerDown({ ...point(event), button: event.button });
	}

	function onPointerUp(event: PointerEvent): void {
		(event.currentTarget as SVGSVGElement).releasePointerCapture?.(event.pointerId);
		session.pointerUp();
	}

	function stop(event: Event): void {
		event.stopPropagation();
	}
</script>

<!-- The keyboard is routed through attachOverlayKeyboard (window capture), not onkeydown here. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
	bind:this={svgEl}
	class="pptx-svelte-freeform-tool-overlay"
	width={canvasSize.width}
	height={canvasSize.height}
	role="application"
	aria-label={t('pptx.freeformTool.overlay')}
	data-pptx-freeform-tool-overlay={tool}
	onpointerdown={onPointerDown}
	onpointermove={(event) => session.pointerMove(point(event))}
	onpointerup={onPointerUp}
	ondblclick={(event) => {
		event.stopPropagation();
		session.doubleClick();
	}}
	oncontextmenu={(event) => {
		event.preventDefault();
		event.stopPropagation();
	}}
	onmousedown={stop}
	onclick={stop}
>
	<rect width={canvasSize.width} height={canvasSize.height} fill="transparent" />
	{#if view.previewD}
		<path d={view.previewD} fill="none" stroke="#2f528f" stroke-width={view.strokeWidth} pointer-events="none" />
	{/if}
	{#if view.start}
		<circle
			cx={view.start.x}
			cy={view.start.y}
			r={view.start.size / 2}
			fill={view.start.armed ? '#2f528f' : '#ffffff'}
			stroke="#2f528f"
			stroke-width={view.strokeWidth}
			pointer-events="none"
			data-pptx-freeform-start={view.start.armed ? 'armed' : 'idle'}
		/>
	{/if}
</svg>

<style>
	.pptx-svelte-freeform-tool-overlay {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 60;
		overflow: visible;
		pointer-events: auto;
		cursor: crosshair;
		touch-action: none;
	}
</style>
