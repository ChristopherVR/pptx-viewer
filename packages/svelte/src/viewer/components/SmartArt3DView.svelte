<script lang="ts">
	/**
	 * SmartArt3DView: Svelte port of Vue's `SmartArt3DRenderer.vue`.
	 *
	 * Builds the pure 3D model from the shared layout engine (no `three`
	 * import, see `render/smart-art-3d-view.ts`), then lazily imports the
	 * vanilla scene runtime from `pptx-viewer-shared/smartart-3d` and mounts it
	 * on a canvas (this renderer is only reached when the host
	 * has explicitly opted in via `smartArt3D`, so unlike `Model3dView` there
	 * is no click-to-mount affordance). `three` is an optional peer
	 * dependency: while the dynamic import is pending, and whenever it fails
	 * (missing `three`, an empty diagram, or a mount error), this component
	 * renders the SVG `SmartArtView` instead.
	 *
	 * Element-data changes dispose the previous scene and mount the updated
	 * model on the same single-canvas surface. This keeps inspector layout,
	 * colour, and text edits live without leaving orphaned WebGL contexts.
	 *
	 * A font-style emphasis effect (Bold Flash, Bold Reveal, Underline, Change
	 * Font Style/Size) active on this element applies to every node caption via
	 * `options.textStyle` at mount and `handle.setTextStyle` on change,
	 * matching the DOM `buildTextStyleOverrideCss` injection `ElementRenderer`
	 * uses for the SVG `SmartArtView`: a canvas-texture caption cannot be
	 * reached by a CSS override, so this scene needs the shared handle method
	 * as its own, real application path.
	 */
	import type { SmartArt3DHandle } from 'pptx-viewer-shared/smartart-3d';
	import type { SmartArt3DModel } from 'pptx-viewer-shared';
	import { onDestroy, tick } from 'svelte';

	import { getContainerStyle, styleToString } from '../style';
	import { buildSmartArt3DViewModel } from '../render';
	import type { ElementRendererProps } from './props';
	import SmartArtView from './SmartArtView.svelte';

	const { element, mediaDataUrls, zIndex, animationState, interactive = false, marked = false }: ElementRendererProps = $props();

	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
	/** Active font-style emphasis override for every node caption, if any. */
	const textStyle = $derived(animationState?.textStyle);

	/** `true` once the WebGL scene has mounted; otherwise render the SVG fallback. */
	let mounted = $state(false);
	// The conditionally-rendered template's bind:this writes this (invisible
	// to the linter); it must be `$state` so Svelte re-binds it as the canvas
	// enters the DOM once `mounted` flips true.
	// eslint-disable-next-line prefer-const
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let handle: SmartArt3DHandle | undefined;
	let generation = 0;

	async function mountScene(
		version: number,
		model: SmartArt3DModel,
		width: number,
		height: number,
	): Promise<void> {
		try {
			const { mountSmartArt3D } = await import('pptx-viewer-shared/smartart-3d');
			if (version !== generation) {
				return;
			}
			mounted = true;
			// Wait for the canvas ({#if mounted} branch) to render now that the
			// fallback is off.
			await tick();
			if (version !== generation || !canvasEl) {
				mounted = false;
				return;
			}
			handle = mountSmartArt3D(canvasEl, model, width, height, { textStyle });
		} catch {
			if (version === generation) {
				mounted = false;
			}
		}
	}

	$effect(() => {
		const model = buildSmartArt3DViewModel(element);
		const width = element.width;
		const height = element.height;
		const version = ++generation;
		handle?.dispose();
		handle = undefined;
		mounted = false;
		if (model && model.meshes.length > 0) {
			void mountScene(version, model, width, height);
		}
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
	<div
		class="pptx-svelte-element pptx-svelte-smartart-3d"
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive || marked ? 'true' : undefined}
		data-testid={`smartart-${element.type === 'smartArt' ? element.smartArtData?.layout ?? 'diagram' : 'diagram'}`}
	>
		<canvas bind:this={canvasEl} class="pptx-svelte-smartart-3d-canvas"></canvas>
	</div>
{:else}
	<SmartArtView {element} {mediaDataUrls} {zIndex} {interactive} />
{/if}

<style>
	.pptx-svelte-smartart-3d-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
