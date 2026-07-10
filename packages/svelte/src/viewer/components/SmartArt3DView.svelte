<script lang="ts">
	/**
	 * SmartArt3DView: Svelte port of Vue's `SmartArt3DRenderer.vue`.
	 *
	 * Builds the pure 3D model from the shared layout engine (no `three`
	 * import, see `render/smart-art-3d-view.ts`), then lazily imports the
	 * vanilla scene runtime from `pptx-viewer-shared/smartart-3d` and mounts it
	 * on a canvas once, on init (this renderer is only reached when the host
	 * has explicitly opted in via `smartArt3D`, so unlike `Model3dView` there
	 * is no click-to-mount affordance). `three` is an optional peer
	 * dependency: while the dynamic import is pending, and whenever it fails
	 * (missing `three`, an empty diagram, or a mount error), this component
	 * renders the SVG `SmartArtView` instead.
	 *
	 * Element-data changes after the initial mount do not re-build the WebGL
	 * scene (matching Vue); only the element's width/height are tracked live
	 * to keep the renderer/camera in sync, mirroring `Model3dView`'s resize
	 * wiring for the interactive `model3d` scene.
	 */
	import type { SmartArt3DHandle } from 'pptx-viewer-shared/smartart-3d';
	import { onDestroy, onMount, tick } from 'svelte';

	import { getContainerStyle, styleToString } from '../style';
	import { buildSmartArt3DViewModel } from '../render';
	import type { ElementRendererProps } from './props';
	import SmartArtView from './SmartArtView.svelte';

	const { element, mediaDataUrls, zIndex }: ElementRendererProps = $props();

	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));

	/** `true` once the WebGL scene has mounted; otherwise render the SVG fallback. */
	let mounted = $state(false);
	// The conditionally-rendered template's bind:this writes this (invisible
	// to the linter); it must be `$state` so Svelte re-binds it as the canvas
	// enters the DOM once `mounted` flips true.
	// eslint-disable-next-line prefer-const
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let handle: SmartArt3DHandle | undefined;

	async function mountScene(): Promise<void> {
		const model = buildSmartArt3DViewModel(element);
		if (!model || model.meshes.length === 0) {
			return;
		}
		try {
			const { mountSmartArt3D } = await import('pptx-viewer-shared/smartart-3d');
			mounted = true;
			// Wait for the canvas ({#if mounted} branch) to render now that the
			// fallback is off.
			await tick();
			if (!canvasEl) {
				mounted = false;
				return;
			}
			handle = mountSmartArt3D(canvasEl, model, element.width, element.height, {});
		} catch {
			mounted = false;
		}
	}

	onMount(() => {
		void mountScene();
	});

	$effect(() => {
		handle?.resize(element.width, element.height);
	});

	onDestroy(() => {
		handle?.dispose();
		handle = undefined;
	});
</script>

{#if mounted}
	<div
		class="pptx-svelte-element pptx-svelte-smartart-3d"
		style={containerStyle}
		data-element-id={element.id}
	>
		<canvas bind:this={canvasEl} class="pptx-svelte-smartart-3d-canvas"></canvas>
	</div>
{:else}
	<SmartArtView {element} {mediaDataUrls} {zIndex} />
{/if}

<style>
	.pptx-svelte-smartart-3d-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
