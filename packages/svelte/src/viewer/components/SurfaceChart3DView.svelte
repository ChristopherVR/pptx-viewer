<script lang="ts">
	/**
	 * SurfaceChart3DView: Svelte port of Vue's `SurfaceChart3DRenderer.vue` /
	 * React's `SurfaceChart3DRenderer.tsx`.
	 *
	 * Builds the pure grid data from the shared adapter (no `three` import, see
	 * `buildSurfaceChart3DDataForElement` in `pptx-viewer-shared`), then mounts
	 * the vanilla-three scene controller (`mountSurfaceChart3D`) into a
	 * container div for a camera-orbitable surface mesh (OrbitControls: drag to
	 * rotate, scroll to zoom). This renderer is only reached when the host has
	 * explicitly opted in via `surfaceChart3D` (mirrors `SmartArt3DView`: no
	 * click-to-mount affordance).
	 *
	 * `three` is an optional peer dependency: while the mount is pending, and
	 * whenever it fails (missing `three`, no plottable grid, or a mount error),
	 * this component renders the SVG `ChartView` instead - the SAME component
	 * used for every other chart kind, so drag/title editing keep working
	 * outside 3D mode.
	 *
	 * The mesh is click-selectable AND drag-to-value editable while the 3D
	 * scene is active: a click or a vertical drag on a grid vertex raycasts
	 * through the shared `mountSurfaceChart3D` `interaction` callbacks
	 * (`Chart3DInteractionController`, `chart-3d-interaction.svelte.ts`), which
	 * funnels a committed value drag through the SAME `onchartpointcommit` path
	 * 2D on-canvas dragging uses. The selected vertex is highlighted with a
	 * small marker mesh rather than a per-mark material tint, since the grid is
	 * one shared mesh with no per-cell material to isolate (see
	 * `surface-chart-3d-interaction-wiring.ts`'s module doc).
	 *
	 * Element-data changes dispose the previous scene and mount the updated
	 * grid on the same single-container surface, exactly like `SmartArt3DView`.
	 */
	import type { ChartPptxElement } from 'pptx-viewer-core';
	import type { SurfaceChart3DHandle } from 'pptx-viewer-shared';
	import { buildSurfaceChart3DDataForElement, canDrillDown, mountSurfaceChart3D } from 'pptx-viewer-shared';
	import { onDestroy, tick } from 'svelte';

	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';
	import { Chart3DInteractionController } from './chart-3d-interaction.svelte';
	import ChartView from './ChartView.svelte';

	const { element, mediaDataUrls, zIndex, animationState, interactive = false, marked = false, onchartpointcommit }: ElementRendererProps = $props();

	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
	/** Active font-style emphasis override for the axis labels, if any. */
	const textStyle = $derived(animationState?.textStyle);
	/** See `Bar3DChartView`'s `editable` doc; identical gate for a surface3D chart. */
	const editable = $derived(interactive && Boolean(onchartpointcommit) && canDrillDown(element));

	/** `true` once the WebGL scene has mounted; otherwise render the SVG fallback. */
	let mounted = $state(false);
	// The conditionally-rendered template's bind:this writes this (invisible
	// to the linter); it must be `$state` so Svelte re-binds it as the scene
	// host enters the DOM once `mounted` flips true.
	// eslint-disable-next-line prefer-const
	let sceneHost: HTMLDivElement | undefined = $state();
	let handle: SurfaceChart3DHandle | undefined;
	let generation = 0;

	const interactionController = new Chart3DInteractionController<SurfaceChart3DHandle>({
		element: () => element as ChartPptxElement,
		commit: (id, chartData) => onchartpointcommit?.(id, chartData),
		getHandle: () => handle,
	});

	async function mountScene(
		version: number,
		options: ReturnType<typeof buildSurfaceChart3DDataForElement>,
	): Promise<void> {
		if (!options) {
			return;
		}
		mounted = true;
		// Wait for the scene host ({#if mounted} branch) to render now that the
		// fallback is off.
		await tick();
		if (version !== generation || !sceneHost) {
			mounted = false;
			return;
		}
		const result = editable
			? await mountSurfaceChart3D(
					sceneHost,
					{ ...options, textStyle },
					{
						onSelect: interactionController.onSelect,
						onValueDragPreview: interactionController.onValueDragPreview,
						onValueDragCommit: interactionController.onValueDragCommit,
					},
				)
			: await mountSurfaceChart3D(sceneHost, { ...options, textStyle });
		if (version !== generation) {
			result.dispose();
			return;
		}
		if (result.ok) {
			handle = result;
			// The remount just dropped the previous scene's mesh highlight; put a
			// tracked selection back onto the new one.
			interactionController.syncSelection(handle);
		} else {
			mounted = false;
		}
	}

	$effect(() => {
		const options = buildSurfaceChart3DDataForElement(element, {
			width: element.width,
			height: element.height,
		});
		const version = ++generation;
		handle?.dispose();
		handle = undefined;
		mounted = false;
		void mountScene(version, options);
	});

	$effect(() => {
		handle?.resize(element.width, element.height);
	});

	// Applied without a remount: a text-style change alone should not tear
	// down and re-orbit the whole scene.
	$effect(() => {
		handle?.setTextStyle(textStyle);
	});

	onDestroy(() => {
		generation += 1;
		handle?.dispose();
		handle = undefined;
	});
</script>

{#if mounted}
	<!-- Armed (`pptx-chart-interactive`) while editable, exactly like ChartView's
	     2D marks: the shared 3D pointer wiring asks `isChartInteractionArmed` before
	     it owns a mark press (select / value drag) instead of letting it bubble. -->
	<div
		class={`pptx-svelte-element pptx-svelte-surface-chart-3d${editable ? ' pptx-chart-interactive' : ''}`}
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive || marked ? 'true' : undefined}
	>
		<div bind:this={sceneHost} class="pptx-svelte-surface-chart-3d-scene"></div>
		{#if interactionController.dragLabel !== null}
			<div class="pptx-svelte-surface-chart-3d-drag-badge">{interactionController.dragLabel}</div>
		{/if}
	</div>
{:else}
	<ChartView {element} {mediaDataUrls} {zIndex} {animationState} {interactive} {marked} {onchartpointcommit} />
{/if}

<style>
	.pptx-svelte-surface-chart-3d-scene {
		width: 100%;
		height: 100%;
		will-change: transform;
	}

	.pptx-svelte-surface-chart-3d-drag-badge {
		position: absolute;
		top: 4px;
		right: 4px;
		padding: 1px 6px;
		border-radius: 4px;
		background: #1e293b;
		color: #f8fafc;
		font-size: 10px;
		line-height: 1.5;
		pointer-events: none;
	}
</style>
