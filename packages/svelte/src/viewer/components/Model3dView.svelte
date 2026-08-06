<script lang="ts">
	/**
	 * Model3dView: renders `model3d` (embedded GLB/GLTF) elements, Svelte port
	 * of Vue's `Model3DRenderer.vue` / React's `Model3DRenderer.tsx`:
	 *
	 * - Poster image (`posterImage`, then the raster `imageData`) renders by
	 *   default; without one, a labelled "3D Model" placeholder box (cube
	 *   icon) renders instead, exactly like the other bindings.
	 * - When the element carries the model binary (`modelData`), a "view in
	 *   3D" button mounts the shared framework-free vanilla-three controller
	 *   (`mountModel3D`, which dynamically imports the OPTIONAL `three` peer
	 *   dependency) on demand for interactive rotate/zoom, matching the
	 *   vanilla binding's click-to-mount behaviour rather than Vue/React's
	 *   eager reactive-lifecycle mount.
	 * - Graceful fallback: when `three` is unavailable or the model fails to
	 *   load (`handle.ok === false`), the poster/placeholder stays and the
	 *   affordance is removed.
	 *
	 * The `modelData` data URL becomes a blob (object) URL via core
	 * `parseDataUrlToBytes` (never hand-rolled base64, see `model3d-view.ts`),
	 * revoked once the mount attempt settles, and the scene handle is
	 * disposed when the component unmounts.
	 */
	import type { Model3DHandle } from 'pptx-viewer-shared';
	import { mountModel3D } from 'pptx-viewer-shared';
	import { onDestroy, tick } from 'svelte';

	import { useTranslator } from '../../i18n/context';
	import { modelDataToBlobUrl } from '../render';
	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	type ViewState = 'idle' | 'loading' | 'mounted' | 'failed';

	const { element, zIndex, interactive = false, marked = false }: ElementRendererProps = $props();
	const t = useTranslator();

	const model = $derived(element.type === 'model3d' ? element : undefined);
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
	const posterSrc = $derived(model?.posterImage ?? model?.imageData);
	const label = t('pptx.model3d.label');

	// The conditionally-rendered template's bind:this writes this (invisible
	// to the linter); it must be `$state` so Svelte re-binds it as the scene
	// host `<div>` enters/leaves the DOM across `viewState` transitions.
	// eslint-disable-next-line prefer-const
	let sceneHost: HTMLDivElement | undefined = $state();
	let viewState: ViewState = $state('idle');
	let handle: Model3DHandle | undefined;

	onDestroy(() => {
		handle?.dispose();
	});

	async function viewIn3d(): Promise<void> {
		if (!model?.modelData || viewState !== 'idle') {
			return;
		}
		const url = modelDataToBlobUrl(model.modelData, model.modelMimeType);
		if (!url) {
			viewState = 'failed';
			return;
		}

		// Render the (empty) scene host before mounting so `mountModel3D` has a
		// real container element to append its canvas into.
		viewState = 'loading';
		await tick();
		if (!sceneHost) {
			URL.revokeObjectURL(url);
			viewState = 'failed';
			return;
		}

		const result = await mountModel3D(sceneHost, url, {
			width: Math.max(1, model.width),
			height: Math.max(1, model.height),
			interactive: true,
		});
		URL.revokeObjectURL(url);
		if (result.ok) {
			handle = result;
			viewState = 'mounted';
		} else {
			viewState = 'failed';
		}
	}

	/**
	 * Swallow pointer interactions so the click never bubbles into host-level
	 * element selection / drag handlers (same pattern as the OLE action bar).
	 */
	function stop(event: Event): void {
		event.stopPropagation();
	}

	function handleViewClick(event: MouseEvent): void {
		stop(event);
		void viewIn3d();
	}
</script>

{#if model}
	<div
		class="pptx-svelte-element pptx-svelte-model3d"
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive || marked ? 'true' : undefined}
	>
		{#if viewState !== 'mounted'}
			{#if posterSrc}
				<img class="pptx-svelte-model3d-poster" src={posterSrc} alt={label} draggable="false" />
			{:else}
				<div class="pptx-svelte-model3d-placeholder">
					<svg
						class="pptx-svelte-model3d-icon"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path
							d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
						/>
						<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
						<line x1="12" y1="22.08" x2="12" y2="12" />
					</svg>
					<span class="pptx-svelte-model3d-label">{label}</span>
				</div>
			{/if}
		{/if}
		{#if viewState === 'loading' || viewState === 'mounted'}
			<div class="pptx-svelte-model3d-scene" bind:this={sceneHost}></div>
		{/if}
		{#if model.modelData && (viewState === 'idle' || viewState === 'loading')}
			<button
				type="button"
				class="pptx-svelte-model3d-view"
				disabled={viewState === 'loading'}
				aria-label={label}
				title={label}
				onpointerdown={stop}
				onmousedown={stop}
				onclick={handleViewClick}
			>{label}</button>
		{/if}
	</div>
{/if}

<style>
	.pptx-svelte-model3d-poster {
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
		user-select: none;
		display: block;
	}

	.pptx-svelte-model3d-placeholder {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		color: #9ca3af;
		background-color: #f9fafb;
		border: 1px dashed #e5e7eb;
		border-radius: 4px;
	}

	.pptx-svelte-model3d-icon {
		margin-bottom: 4px;
		color: #d1d5db;
	}

	.pptx-svelte-model3d-scene {
		position: absolute;
		inset: 0;
		will-change: transform;
	}

	.pptx-svelte-model3d-view {
		position: absolute;
		bottom: 4px;
		right: 4px;
		z-index: 10;
		padding: 2px 8px;
		border: 1px solid rgba(0, 0, 0, 0.18);
		border-radius: 4px;
		background: rgba(255, 255, 255, 0.9);
		color: #1a1a1a;
		font: inherit;
		font-size: 11px;
		line-height: 1.4;
		cursor: pointer;
		pointer-events: auto;
	}
</style>
