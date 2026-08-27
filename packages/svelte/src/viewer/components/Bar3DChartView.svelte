<script lang="ts">
	/**
	 * Bar3DChartView: Svelte port of Vue's `Bar3DChartRenderer.vue` / React's
	 * `Bar3DChartRenderer.tsx`.
	 *
	 * Builds the pure box-mesh layout from the shared adapter (no `three`
	 * import, see `buildBarChart3DDataForElement` in `pptx-viewer-shared`),
	 * then mounts the vanilla-three scene controller (`mountBarChart3D`) into a
	 * container div for a camera-orbitable set of real 3D box meshes
	 * (OrbitControls: drag to rotate, scroll to zoom). This renderer is only
	 * reached when the host has explicitly opted in via `barChart3D` (mirrors
	 * `SurfaceChart3DView`: no click-to-mount affordance).
	 *
	 * `three` is an optional peer dependency: while the mount is pending, and
	 * whenever it fails (missing `three`, no plottable grid, or a mount error),
	 * this component renders the SVG `ChartView` instead - the SAME component
	 * used for every other chart kind, so drag/title editing keep working
	 * outside 3D mode. Marks are not selectable/draggable while the 3D scene is
	 * active: a mesh facet has no 2D screen geometry to hit-test against.
	 *
	 * Element-data changes dispose the previous scene and mount the updated
	 * layout on the same single-container surface, exactly like
	 * `SurfaceChart3DView`.
	 */
	import type { BarChart3DHandle } from 'pptx-viewer-shared';
	import { buildBarChart3DDataForElement, mountBarChart3D } from 'pptx-viewer-shared';
	import { onDestroy, tick } from 'svelte';

	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';
	import ChartView from './ChartView.svelte';

	const { element, mediaDataUrls, zIndex, animationState, interactive = false, marked = false, onchartpointcommit }: ElementRendererProps = $props();

	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));

	/** `true` once the WebGL scene has mounted; otherwise render the SVG fallback. */
	let mounted = $state(false);
	// The conditionally-rendered template's bind:this writes this (invisible
	// to the linter); it must be `$state` so Svelte re-binds it as the scene
	// host enters the DOM once `mounted` flips true.
	// eslint-disable-next-line prefer-const
	let sceneHost: HTMLDivElement | undefined = $state();
	let handle: BarChart3DHandle | undefined;
	let generation = 0;

	async function mountScene(
		version: number,
		options: ReturnType<typeof buildBarChart3DDataForElement>,
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
		const result = await mountBarChart3D(sceneHost, options);
		if (version !== generation) {
			result.dispose();
			return;
		}
		if (result.ok) {
			handle = result;
		} else {
			mounted = false;
		}
	}

	$effect(() => {
		const options = buildBarChart3DDataForElement(element, {
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

	onDestroy(() => {
		generation += 1;
		handle?.dispose();
		handle = undefined;
	});
</script>

{#if mounted}
	<div
		class="pptx-svelte-element pptx-svelte-bar-chart-3d"
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive || marked ? 'true' : undefined}
	>
		<div bind:this={sceneHost} class="pptx-svelte-bar-chart-3d-scene"></div>
	</div>
{:else}
	<ChartView {element} {mediaDataUrls} {zIndex} {animationState} {interactive} {marked} {onchartpointcommit} />
{/if}

<style>
	.pptx-svelte-bar-chart-3d-scene {
		width: 100%;
		height: 100%;
		will-change: transform;
	}
</style>
