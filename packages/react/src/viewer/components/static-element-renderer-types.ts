import type { PptxElement, PptxSlide, ShapeStyle } from 'pptx-viewer-core';

import type { TableStyleContext } from '../utils/table-band-style';
import type { FieldSubstitutionContext } from '../utils/text-field-substitution';

export interface StaticElementRendererProps {
	element: PptxElement;
	activeSlide?: PptxSlide;
	allSlides?: readonly PptxSlide[];
	mediaDataUrls?: Map<string, string>;
	sourceSlideIndex?: number;
	zIndex?: number;
	positioned?: boolean;
	/** Text-field substitution context (slide number, date/header/footer). */
	fieldContext?: FieldSubstitutionContext;
	/** Theme + table style map for resolving table band/header colours. */
	tableStyleContext?: TableStyleContext;
	/**
	 * The enclosing group's fill (`GroupPptxElement.groupFill`), passed down by
	 * the group branch below so a child painted with `a:grpFill`
	 * (`fillMode === 'group'`) inherits the group's resolved fill.
	 */
	parentGroupFill?: ShapeStyle;
	/**
	 * Invoked when a descendant carrying its own `actionClick` is clicked.
	 *
	 * A shape inside an `p:grpSp` keeps its own `a:hlinkClick`, and PowerPoint
	 * honours it: the group is one object to drag, but its children are still
	 * individually clickable targets. Without this the whole subtree stayed
	 * `pointer-events-none` and every in-group navigation button was dead.
	 */
	onActionClick?: (elementId: string, action: NonNullable<PptxElement['actionClick']>) => void;
	/**
	 * When true (editing), a child action only fires on Ctrl/Cmd+click, so a
	 * plain click still selects the enclosing group. Mirrors the top-level
	 * element behaviour in `getElementInteractionProps`.
	 */
	actionRequiresModifier?: boolean;
	/**
	 * CSS `animation` shorthand applied to the element's own positioned
	 * container. Morph ghost keyframes are ELEMENT-LOCAL (they restate the
	 * static transform and pivot on the element centre), so they must ride the
	 * node that carries that transform - putting them on a slide-sized wrapper
	 * pivots them around the slide centre instead.
	 */
	animation?: string;
	/**
	 * CSS `animation` shorthand applied to the picture's `<img>` instead of its
	 * container.
	 *
	 * A source crop (`a:srcRect`) is painted by transforming the img inside an
	 * unchanged frame, so morphing PowerPoint's "Scale Height"/"Scale Width"
	 * animates that node (issue #148). The other four bindings reach it with a
	 * descendant CSS rule; overlay copies here expose no `data-element-id` to
	 * select on, so it is passed down instead.
	 */
	imageAnimation?: string;
	/**
	 * Stamp `data-element-id` on the rendered node.
	 *
	 * Off by default: the transition overlay paints copies of the OUTGOING
	 * slide's elements, and exposing their ids there would put two nodes with
	 * the same id in the document for the length of a transition. It is turned
	 * on for group children rendered inside the live stage, which every other
	 * binding already exposes, so a morph that pairs a `!!`-named shape across
	 * a grouping boundary can be asserted on the same DOM contract everywhere.
	 */
	exposeElementId?: boolean;
	/**
	 * Suppress THIS element's OWN `a:reflection` mirror while rendering it.
	 *
	 * `ShapeEffectOverlay` mounts a `StaticElementRenderer` clone of the
	 * reflected element to paint the mirror's full content (fill, outline, text
	 * body, and - for a group - its children), rather than just the resolved
	 * fill. Without this flag that clone's own `ShapeEffectOverlay` call would
	 * see the SAME reflection style and recurse into building another mirror of
	 * the mirror.
	 *
	 * Deliberately NOT propagated to recursive group-child calls: a child
	 * rendered inside a reflected group's mirror is not itself being mirrored
	 * (only the top-level element passed to this prop is), so a child that
	 * carries its OWN `a:reflection` must keep it. PowerPoint composites a
	 * group's own reflection from the group's fully-rendered content, which
	 * already includes each child's own reflection where one is set, so a
	 * child's mirror has to appear a second time (once normally, once inside
	 * the parent group's mirror) for the two to match - see
	 * `reflection-content-parity.spec.ts`'s nested-reflection case.
	 */
	suppressReflection?: boolean;
}
