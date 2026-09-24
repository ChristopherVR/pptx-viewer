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
	 */
	import {
		elementInLocalFrame,
		resolveSmartArtThreeViewSpec,
		shouldRenderHitTarget,
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
	</div>
{:else}
	<SmartArtView {element} {mediaDataUrls} {zIndex} {interactive} {editable} {presenting} />
{/if}
