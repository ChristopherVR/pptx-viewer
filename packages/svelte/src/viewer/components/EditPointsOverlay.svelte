<script lang="ts">
	/**
	 * EditPointsOverlay: PowerPoint's Edit Points mode for one shape (Svelte
	 * port of React's `canvas/EditPointsOverlay.tsx`).
	 *
	 * Everything that decides behaviour lives in the shared `EditPointsSession`
	 * (hit targets, drags, the vertex / segment menu, keyboard, the element
	 * patch): this component only draws its view descriptor as SVG in unscaled
	 * slide pixels and forwards pointer events. It is mounted inside
	 * `OutlineAuthoringLayer`, which applies the stage's `scale` transform and
	 * re-creates it (`{#key}`) per shape, so one instance owns one session.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import type { EditPointsCommandId, EditPointsElementPatch } from 'pptx-viewer-shared';
	import {
		attachOverlayKeyboard,
		EDIT_POINTS_STYLE,
		EDIT_POINTS_TARGET_ATTR,
		EditPointsSession,
		overlayPointerInput,
	} from 'pptx-viewer-shared';
	import { untrack } from 'svelte';

	import { useTranslator } from '../../i18n/context';
	import EditPointsMenu from './EditPointsMenu.svelte';

	const {
		element,
		canvasSize,
		scale,
		hiddenCommands,
		oncommit,
		onexit,
	}: {
		element: PptxElement;
		canvasSize: { width: number; height: number };
		scale: number;
		hiddenCommands?: ReadonlySet<EditPointsCommandId>;
		oncommit: (elementId: string, patch: EditPointsElementPatch) => void;
		onexit: () => void;
	} = $props();

	const t = useTranslator();
	let version = $state(0);
	// eslint-disable-next-line prefer-const
	let svgEl = $state<SVGSVGElement | null>(null);

	const elementId = untrack(() => element.id);
	const session = new EditPointsSession(
		untrack(() => element),
		{
			onCommit: (patch) => oncommit(elementId, patch),
			onExit: () => onexit(),
			onChange: () => {
				version += 1;
			},
			hiddenCommands: untrack(() => hiddenCommands),
		},
	);

	$effect(() => {
		session.reconcile(element);
	});
	$effect(() => attachOverlayKeyboard(session));

	const view = $derived.by(() => {
		void version;
		return session.view(scale);
	});

	function input(event: PointerEvent | MouseEvent) {
		return overlayPointerInput(
			event,
			svgEl ?? (event.currentTarget as Element),
			canvasSize.width,
			canvasSize.height,
		);
	}

	function onPointerDown(event: PointerEvent): void {
		event.stopPropagation();
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		(event.currentTarget as SVGSVGElement).setPointerCapture?.(event.pointerId);
		session.pointerDown(input(event));
	}

	function onPointerUp(event: PointerEvent): void {
		(event.currentTarget as SVGSVGElement).releasePointerCapture?.(event.pointerId);
		session.pointerUp(input(event));
	}

	function onContextMenu(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		session.contextMenu(input(event));
	}

	function stop(event: Event): void {
		event.stopPropagation();
	}

	const targetAttr = (id: string): Record<string, string> => ({ [EDIT_POINTS_TARGET_ATTR]: id });
</script>

<!-- The keyboard is routed through attachOverlayKeyboard (window capture), not onkeydown here. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
	bind:this={svgEl}
	class="pptx-svelte-edit-points-overlay"
	width={canvasSize.width}
	height={canvasSize.height}
	role="application"
	aria-label={t('pptx.editPoints.overlay')}
	data-pptx-edit-points-overlay="true"
	data-pptx-edit-points-element={elementId}
	onpointerdown={onPointerDown}
	onpointermove={(event) => session.pointerMove(input(event))}
	onpointerup={onPointerUp}
	oncontextmenu={onContextMenu}
	onmousedown={stop}
	onclick={stop}
	ondblclick={stop}
>
	<rect width={canvasSize.width} height={canvasSize.height} fill="transparent" />
	{#each view.segments as seg (seg.target)}
		<path
			d={seg.d}
			fill="none"
			stroke="transparent"
			stroke-width={view.hitStrokeWidth}
			pointer-events="stroke"
			style="cursor: copy"
			{...targetAttr(seg.target)}
		/>
	{/each}
	<path
		d={view.outlineD}
		fill="none"
		stroke={EDIT_POINTS_STYLE.outlineColor}
		stroke-width={view.outlineWidth}
		pointer-events="none"
	/>
	{#each view.handles as h (h.target)}
		<g>
			<line
				x1={h.anchorX}
				y1={h.anchorY}
				x2={h.x}
				y2={h.y}
				stroke={EDIT_POINTS_STYLE.handleLineColor}
				stroke-width={view.outlineWidth}
				pointer-events="none"
			/>
			<rect
				x={h.x - h.size / 2}
				y={h.y - h.size / 2}
				width={h.size}
				height={h.size}
				fill={EDIT_POINTS_STYLE.handleFill}
				stroke={EDIT_POINTS_STYLE.handleStroke}
				stroke-width={view.outlineWidth}
				style="cursor: move"
				{...targetAttr(h.target)}
			/>
		</g>
	{/each}
	{#each view.nodes as n (n.target)}
		<rect
			x={n.x - n.size / 2}
			y={n.y - n.size / 2}
			width={n.size}
			height={n.size}
			fill={n.selected ? EDIT_POINTS_STYLE.selectedNodeFill : EDIT_POINTS_STYLE.nodeFill}
			stroke={n.selected ? EDIT_POINTS_STYLE.selectedNodeStroke : EDIT_POINTS_STYLE.nodeStroke}
			stroke-width={view.outlineWidth}
			style="cursor: move"
			data-pptx-edit-points-node-type={n.type}
			data-selected={n.selected ? 'true' : undefined}
			{...targetAttr(n.target)}
		/>
	{/each}
</svg>
{#if view.menu}
	<EditPointsMenu menu={view.menu} onrun={(id) => session.runCommand(id)} />
{/if}

<style>
	.pptx-svelte-edit-points-overlay {
		position: absolute;
		top: 0;
		left: 0;
		z-index: 60;
		overflow: visible;
		pointer-events: auto;
		touch-action: none;
	}
</style>
