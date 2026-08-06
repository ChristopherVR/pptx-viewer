<script lang="ts">
	/**
	 * ElementRenderer: a thin dispatcher over the `PptxElement` discriminated
	 * union (Svelte port of Vue's `ElementRenderer`). Real renderers: group
	 * (recursive), image/picture, connector, text/shape, table, chart,
	 * smartArt, media, ink, ole, contentPart, zoom, and model3d. Only
	 * `unknown` still falls through to the typed placeholder.
	 */
	import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
	import { build3DExtrusionData, buildParagraphs, getGroupChildParentFill, getOverflowSegments, hasTextWarp, isElementHidden, isTemplateElement } from 'pptx-viewer-shared';

	import { getContainerStyle, getShapeBoxStyle, getTextBlockStyle, styleToString } from '../style';
	import { getFieldContextGetter } from '../state/field-context';
	import { getSlideElementsGetter } from '../state/slide-elements';
	import { useSmartArt3D } from '../state/smart-art-3d-context';
	import {
		getPresentationElementStatesGetter,
		usePresentationElementState,
	} from '../state/presentation-element-states-context';
	// Self-import: groups recurse into this same component (Svelte 5 pattern).
	// eslint-disable-next-line import/no-self-import
	import ElementRenderer from './ElementRenderer.svelte';
	import ChartView from './ChartView.svelte';
	import ConnectorView from './ConnectorView.svelte';
	import DuotoneFilterDefs from './DuotoneFilterDefs.svelte';
	import ShapeEffectOverlay from './ShapeEffectOverlay.svelte';
	import EquationView from './EquationView.svelte';
	import Extrusion3D from './Extrusion3D.svelte';
	import ContentPartView from './ContentPartView.svelte';
	import ImageBox from './ImageBox.svelte';
	import InkView from './InkView.svelte';
	import MediaBox from './MediaBox.svelte';
	import Model3dView from './Model3dView.svelte';
	import OleView from './OleView.svelte';
	import PlaceholderElement from './PlaceholderElement.svelte';
	import SmartArt3DView from './SmartArt3DView.svelte';
	import SmartArtView from './SmartArtView.svelte';
	import TableView from './TableView.svelte';
	import TextBlock from './TextBlock.svelte';
	import ZoomView from './ZoomView.svelte';
	import WordArtText from './WordArtText.svelte';
	import type { ElementRendererProps } from './props';

	const { element, mediaDataUrls, zIndex, presenting = false, interactive = false, marked = false, editTemplateMode = false, parentGroupFill, ontablecellcommit, onsmartartnodecommit, onsmartartnodefill }: ElementRendererProps =
		$props();
	/**
	 * Whether THIS element takes part in the neutral element contract
	 * (`data-pptx-element="true"`) and in pointer interaction.
	 *
	 * Forwarded to every delegated view, not just the branches that render their
	 * own box here: Svelte has no attribute fallthrough, so a view that is not
	 * handed this flag cannot mark its root, and its element type drops out of
	 * the contract entirely (charts and tables painted correctly while being
	 * invisible to anything that enumerates or hit-tests elements by the marker).
	 */
	const elementInteractive = $derived(interactive && (!isTemplateElement(element) || editTemplateMode));
	/**
	 * Whether THIS element's root carries `data-pptx-element="true"`. Wider than
	 * `elementInteractive`: an interaction-locked template (master/layout)
	 * element on the main canvas keeps the marker (it is still a rendered slide
	 * element carrying the contract), it only loses pointer interactivity.
	 */
	const elementMarked = $derived(interactive || marked);
	/** This group's own fill, handed to `a:grpFill` children (undefined for non-groups). */
	const childParentGroupFill = $derived(getGroupChildParentFill(element));

	/**
	 * Native-animation playback state for this element (present only during a
	 * running presentation). Drives the staged chart / SmartArt build reveal and
	 * the `p:animClr` fill / stroke relinquish; read from the element-states
	 * context so editor / read-only rendering (context absent) is unaffected.
	 */
	const animationState = $derived(usePresentationElementState(element.id));
	// Captured at init: `getContext` only resolves during component
	// initialisation, so reading it inside the `$derived` below returned nothing
	// and the text-build split never ran.
	const getAllAnimStates = getPresentationElementStatesGetter();
	/** Whole map, so a staged text build can find its `::c` / `::w` sub-states. */
	const allAnimStates = $derived(getAllAnimStates?.());

	/** Host opt-in to the Three.js SmartArt renderer (provided by PowerPointViewer). */
	const smartArt3D = useSmartArt3D();

	const isShapeLike = $derived(element.type === 'text' || element.type === 'shape');
	const isImageLike = $derived(element.type === 'picture' || element.type === 'image');

	// Captured at init for the same reason as the animation states above:
	// `getContext` only resolves during component initialisation, so the getter
	// is taken here and invoked inside the `$derived` to stay reactive.
	const getFieldContext = getFieldContextGetter();
	/**
	 * OOXML field-substitution context (slide number, date/time, header/footer,
	 * slide title, document properties), provided by the viewer root and
	 * re-pointed per slide by `SlideStage`. Without it a slide-number run renders
	 * its authored placeholder ("Slide #") instead of the resolved "Slide 1".
	 */
	const fieldContext = $derived(getFieldContext?.());

	// Captured at init for the same reason as the field context above.
	const getSlideElements = getSlideElementsGetter();
	/**
	 * The slice of an `a:linkedTxbx` chain's text this box renders, or
	 * `undefined` when the element is not in a chain (the overwhelmingly common
	 * case, resolved by a single field check inside the shared helper).
	 */
	const linkedSegments = $derived(getOverflowSegments(element, getSlideElements?.()));

	/** Rendered paragraphs (runs + bullet/indent), built by shared logic. */
	const paragraphs = $derived(buildParagraphs(element, fieldContext, linkedSegments));
	const hasText = $derived(
		paragraphs.some((p) => p.runs.length > 0 || p.bulletMarker !== undefined),
	);
	const hasEquation = $derived(
		hasTextProperties(element) && (element.textSegments ?? []).some((segment) => segment.equationXml),
	);
	const warpedText = $derived(hasTextWarp(element));
	/** Selection Pane visibility; see the leading branch of the markup below. */
	const isHidden = $derived(isElementHidden(element));
	const extrusion = $derived.by(() => {
		const style = hasShapeProperties(element) ? element.shapeStyle : undefined;
		return build3DExtrusionData(
			style?.shape3d,
			style?.scene3d,
			style?.fillColor,
			element.width,
			element.height,
		);
	});
</script>

{#if isHidden}
	<!--
		Hidden via the Selection Pane: draw nothing, exactly as PowerPoint does.
		This leads the chain so one empty branch suppresses every element type at
		once. Rendering nothing (rather than an invisible box) is what keeps the
		element out of hit-testing, the tab order and the export raster; it stays
		listed in and selectable from the Selection Pane, which reads the slide
		model rather than the DOM.
	-->
{:else if element.type === 'group'}
	<!-- Group: recurse into children. -->
	<div
		class="pptx-svelte-element pptx-svelte-group"
		style={styleToString({ ...getContainerStyle(element, zIndex), pointerEvents: elementInteractive ? 'auto' : 'none' })}
		data-element-id={element.id}
		data-pptx-element={elementMarked ? 'true' : undefined}
	>
		{#each element.children ?? [] as child, i (child.id)}
			<ElementRenderer element={child} {mediaDataUrls} zIndex={i} {presenting} {interactive} {marked} {editTemplateMode} parentGroupFill={childParentGroupFill} {ontablecellcommit} {onsmartartnodecommit} {onsmartartnodefill} />
		{/each}
	</div>
{:else if isImageLike}
	<ImageBox {element} {mediaDataUrls} {zIndex} interactive={elementInteractive} marked={elementMarked} />
{:else if element.type === 'connector'}
	<ConnectorView {element} {mediaDataUrls} {zIndex} {animationState} interactive={elementInteractive} marked={elementMarked} />
{:else if element.type === 'table'}
	<TableView {element} {mediaDataUrls} {zIndex} interactive={elementInteractive} marked={elementMarked} {ontablecellcommit} />
{:else if element.type === 'chart'}
	<ChartView {element} {mediaDataUrls} {zIndex} {animationState} interactive={elementInteractive} marked={elementMarked} />
{:else if element.type === 'smartArt' && smartArt3D}
	<SmartArt3DView {element} {mediaDataUrls} {zIndex} interactive={elementInteractive} marked={elementMarked} />
{:else if element.type === 'smartArt'}
	<SmartArtView {element} {mediaDataUrls} {zIndex} interactive={elementInteractive} marked={elementMarked} {animationState} {onsmartartnodecommit} {onsmartartnodefill} />
{:else if element.type === 'media'}
	<MediaBox {element} {mediaDataUrls} {zIndex} {presenting} interactive={elementInteractive} marked={elementMarked} />
{:else if element.type === 'ink'}
	<InkView {element} {mediaDataUrls} {zIndex} {presenting} interactive={elementInteractive} marked={elementMarked} />
{:else if element.type === 'ole'}
	<OleView {element} {mediaDataUrls} {zIndex} interactive={elementInteractive} marked={elementMarked} />
{:else if element.type === 'contentPart'}
	<ContentPartView {element} {mediaDataUrls} {zIndex} {presenting} interactive={elementInteractive} marked={elementMarked} />
{:else if element.type === 'zoom'}
	<ZoomView {element} {mediaDataUrls} {zIndex} {presenting} interactive={elementInteractive} marked={elementMarked} />
{:else if element.type === 'model3d'}
	<Model3dView {element} {mediaDataUrls} {zIndex} interactive={elementInteractive} marked={elementMarked} />
{:else if hasEquation}
	<EquationView {element} {mediaDataUrls} {zIndex} interactive={elementInteractive} marked={elementMarked} />
{:else if isShapeLike}
	<!-- Text / shape: shared fill/stroke/effects/geometry + rich text block. -->
	<div
		class="pptx-svelte-element pptx-svelte-shape"
		style={styleToString({ ...getShapeBoxStyle(element, zIndex, parentGroupFill, animationState?.animatesFill, animationState?.animatesStroke), pointerEvents: elementInteractive ? 'auto' : 'none' })}
		data-element-id={element.id}
		data-pptx-element={elementMarked ? 'true' : undefined}
	>
		<DuotoneFilterDefs {element} {mediaDataUrls} {zIndex} />
		<ShapeEffectOverlay {element} {mediaDataUrls} {zIndex} />
		{#if extrusion.hasExtrusion}<Extrusion3D data={extrusion} />{/if}
		{#if warpedText}
			<WordArtText {element} {mediaDataUrls} {zIndex} />
		{:else if hasText}
			<TextBlock
				{paragraphs}
				textStyle={styleToString(getTextBlockStyle(element))}
				elementId={element.id}
				subElementAnimStates={allAnimStates}
			/>
		{/if}
	</div>
{:else}
	<PlaceholderElement {element} {mediaDataUrls} {zIndex} interactive={elementInteractive} marked={elementMarked} />
{/if}
