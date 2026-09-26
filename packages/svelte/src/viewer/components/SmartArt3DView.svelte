<script lang="ts">
	/**
	 * SmartArt3DView: the Svelte 3D SmartArt view on the shared
	 * `<pptx-three-view>`. The spec (`resolveSmartArtThreeViewSpec`) and the
	 * whole scene live in `pptx-viewer-shared`; this component only slots the
	 * SVG `SmartArtView` in as the element's fallback (shown while the scene
	 * loads, and kept when `three` is missing or the scene fails), in the
	 * container's own frame. A diagram with nothing to draw renders the plain
	 * `SmartArtView`. Mirrors React's `SmartArt3DView.tsx` and Vue's
	 * `SmartArt3DRenderer.vue`.
	 *
	 * A font-style emphasis effect (Bold Flash, Bold Reveal, Underline, Change
	 * Font Style/Size) reaches the scene's canvas-texture captions through the
	 * element's `textStyle`; a DOM CSS override cannot.
	 *
	 * Inline node editing: while the diagram is editable, a second
	 * `SmartArtView` sits over the scene in the element's local frame with its
	 * SVG paint hidden. Its node groups stay hit-testable, so a double-click on
	 * a node opens the same textarea editor the 2D view uses, committing through
	 * `onsmartartnodecommit` (as React and Vue do over their 3D scenes).
	 */
	import {
		EDIT_LAYER_MARKER_ATTRS,
		elementInLocalFrame,
		resolveSmartArtThreeViewSpec,
		shouldRenderHitTarget,
		stripEditLayerMarkers,
	} from 'pptx-viewer-shared';

	import { useRendering3DFlags } from '../state/rendering-3d-flags-context';
	import { getContainerStyle, getElementHitTargetStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';
	import SmartArtView from './SmartArtView.svelte';
	import ThreeView from './ThreeView.svelte';

	const {
		element,
		mediaDataUrls,
		zIndex,
		animationState,
		interactive = false,
		marked = false,
		editable = false,
		presenting = false,
		onsmartartnodecommit,
	}: ElementRendererProps = $props();

	const getRendering3DFlags = useRendering3DFlags();
	const spec = $derived(resolveSmartArtThreeViewSpec(element, getRendering3DFlags().smartArt3D));
	const localElement = $derived(elementInLocalFrame(element));
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
	/**
	 * Interaction-only hit target for a degenerate (sub-MIN_ELEMENT_SIZE)
	 * SmartArt diagram; see `ElementRenderer`'s identical `hitTarget` doc
	 * (issue #285).
	 */
	const hitTarget = $derived(
		shouldRenderHitTarget(editable, presenting) ? getElementHitTargetStyle(element) : undefined,
	);

	/**
	 * The edit layer is an input surface, not a second copy of the diagram:
	 * keep the element markers its `SmartArtView` renders (and re-renders)
	 * stripped, so tests and assistive tech see the element once.
	 */
	function editLayerOnly(node: HTMLElement) {
		const strip = (): void => stripEditLayerMarkers(node);
		strip();
		const observer = new MutationObserver(strip);
		observer.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: [...EDIT_LAYER_MARKER_ATTRS] });
		return { destroy: () => observer.disconnect() };
	}
</script>

{#if spec}
	<div
		class="pptx-svelte-element pptx-svelte-smartart-3d"
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive || marked ? 'true' : undefined}
		data-testid={`smartart-${element.type === 'smartArt' ? element.smartArtData?.layout ?? 'diagram' : 'diagram'}`}
	>
		<!-- Interaction-only hit target for a degenerate SmartArt; see `hitTarget`. -->
		{#if hitTarget}
			<div aria-hidden="true" data-pptx-hit-target="true" style={styleToString(hitTarget)}></div>
		{/if}
		<ThreeView {spec} interactive={editable && !presenting} textStyle={animationState?.textStyle}>
			<SmartArtView element={localElement} {mediaDataUrls} zIndex={0} />
		</ThreeView>
		{#if editable && !presenting && onsmartartnodecommit}
			<div class="pptx-svelte-smartart-3d-edit-layer" data-smartart-3d-edit-layer="true" aria-hidden="true" use:editLayerOnly>
				<SmartArtView element={localElement} {mediaDataUrls} zIndex={0} {editable} {onsmartartnodecommit} />
			</div>
		{/if}
	</div>
{:else}
	<SmartArtView {element} {mediaDataUrls} {zIndex} {interactive} {editable} {presenting} />
{/if}

<style>
	/* The edit layer's diagram is invisible but its node groups still take the
	   double-click; the textarea editor it opens is not SVG, so it shows. */
	.pptx-svelte-smartart-3d-edit-layer {
		position: absolute;
		inset: 0;
		z-index: 1;
	}
	.pptx-svelte-smartart-3d-edit-layer :global(svg) {
		opacity: 0;
	}
</style>
