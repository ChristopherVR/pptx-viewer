import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import type { ElementAnimationState, RenderParagraph } from 'pptx-viewer-shared';

/**
 * Prop contracts for the element-level renderers (the per-`PptxElement` views
 * and the shared text block). Split out of `props.ts` to keep every source
 * file within the repo's file-size budget; import them from `./props`, which
 * re-exports this module.
 */

/** Props shared by every element-level renderer. */
export interface ElementRendererProps {
	element: PptxElement;
	mediaDataUrls: Map<string, string>;
	zIndex: number;
	/**
	 * True only on the live presentation stage (the viewer's fullscreen
	 * surface): media elements should then autoplay, as PowerPoint does when a
	 * slide with media becomes active, rather than waiting for a manual click.
	 * Defaults to `false` (the main windowed canvas and thumbnail rail never
	 * autoplay).
	 */
	presenting?: boolean;
	/**
	 * True only on the main (interactive) canvas, never the thumbnail rail.
	 * Marks the rendered root node with `data-pptx-element="true"` (the
	 * framework-neutral contract React/Vue/Angular/Vanilla also emit). EVERY
	 * element renderer honours it, not only the ones the dispatcher boxes
	 * itself: Svelte has no attribute fallthrough, so a view that ignores this
	 * flag silently leaves its element type out of the contract.
	 * Defaults to `false`.
	 */
	interactive?: boolean;
	/** Whether inherited layout/master nodes participate in pointer editing. */
	editTemplateMode?: boolean;
	/**
	 * The enclosing group's fill (`GroupPptxElement.groupFill`), passed down by a
	 * group's render branch so a child painted with `a:grpFill`
	 * (`fillMode === 'group'`) inherits the group's resolved fill.
	 */
	parentGroupFill?: ShapeStyle;
	/**
	 * Native-animation playback state for this element, present only during a
	 * running presentation. Drives the staged chart / SmartArt build reveal and
	 * the `p:animClr` fill / stroke relinquish; mirrors React's / Vue's
	 * per-element `animationState`. Absent (undefined) in editor / read-only
	 * rendering (element renderers read it from the element-states context, so it
	 * is optional here and defaulted per renderer).
	 */
	animationState?: ElementAnimationState;
	ontablecellcommit?: (
		elementId: string,
		rowIndex: number,
		cellIndex: number,
		text: string,
	) => void;
	onsmartartnodecommit?: (elementId: string, nodeId: string, text: string) => void;
	onsmartartnodefill?: (elementId: string, nodeId: string, fill: string) => void;
}

export interface TextBlockProps {
	paragraphs: RenderParagraph[];
	/** Inline `style` string for the text block wrapper. */
	textStyle: string;
	/** Owning element id, needed to key this element's text-build sub-animations. */
	elementId?: string;
	/**
	 * Live per-sub-element animation states. Present only while a staged text
	 * build (by paragraph / word / letter) is playing.
	 */
	subElementAnimStates?: ReadonlyMap<string, ElementAnimationState>;
}
