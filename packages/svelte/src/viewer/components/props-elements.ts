import type { PptxChartData, PptxElement, ShapeStyle } from 'pptx-viewer-core';
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
	/**
	 * Emit the `data-pptx-element` marker even though `interactive` is off.
	 * The dispatcher sets this for interaction-locked template (master/layout)
	 * elements on the main canvas: they are still rendered slide elements as far
	 * as the contract is concerned (the marker means "carries the element
	 * contract", not "editable right now"), matching the other four bindings.
	 * Defaults to `false`.
	 */
	marked?: boolean;
	/** Whether inherited layout/master nodes participate in pointer editing. */
	editTemplateMode?: boolean;
	/**
	 * True only on the main editing canvas (never presenting, exporting, or a
	 * thumbnail/preview surface). Gates an empty inherited placeholder's
	 * greyed-out hint text ("Click to add title") via the shared
	 * `placeholderPromptDescriptor`: PowerPoint never prints, presents, or
	 * thumbnails that authoring hint, only the editor shows it. Defaults to
	 * `false`, so a surface that omits this prop never leaks the hint.
	 */
	editable?: boolean;
	/**
	 * The element currently open in the element-level inline text editor
	 * (`InlineTextEditor.svelte`, rendered separately by `EditorLayer`), or
	 * `null`/`undefined` when nothing is being edited.
	 *
	 * Mirrors React's `ElementBody.renderBody`, which swaps its static text
	 * render out for the inline editor while `isEditing` is true rather than
	 * layering the two: without this, this renderer kept painting the
	 * element's normal text UNDERNEATH the editor overlay (issue #182 in the
	 * other bindings; the fully-opaque editor background here happens to mask
	 * it visually, but the duplicate render is the same structural gap).
	 */
	editingElementId?: string | null;
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
	/**
	 * Commit a chart data point dragged on the canvas, with the whole updated
	 * `chartData`. Fired ONCE on pointer release (the drag is a local preview),
	 * so one drag is one undo step. Absent outside the editable canvas, which
	 * is what makes the chart marks inert on thumbnails and in presentation.
	 */
	onchartpointcommit?: (elementId: string, chartData: PptxChartData) => void;
	/**
	 * Commit a table's whole column-width array after a column-boundary drag,
	 * fired once on pointer release. Absent outside the editable canvas, which
	 * is what makes the resize handles inert on thumbnails and in presentation.
	 */
	ontableresizecolumns?: (elementId: string, widths: number[]) => void;
	/** Commit one row's new pixel height after a row-boundary drag. */
	ontableresizerow?: (elementId: string, rowIndex: number, height: number) => void;
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
