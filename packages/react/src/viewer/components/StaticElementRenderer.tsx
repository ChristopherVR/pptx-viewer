import type { GroupPptxElement, PptxElement, PptxSlide, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import {
	getAriaLabel,
	getAriaRole,
	getAriaRoleDescription,
	getGroupChildParentFill,
	isElementActionable,
	isElementRendered,
	resolveGroupChildFill,
} from 'pptx-viewer-shared';
import React from 'react';

import { DEFAULT_FILL_COLOR, DEFAULT_STROKE_COLOR, DEFAULT_TEXT_COLOR } from '../constants';
import {
	buildCssGradientFromShapeStyle,
	getElementTransform,
	getImageEffectsFilter,
	getImageEffectsOpacity,
	getImageRenderStyle,
	getShapeVisualStyle,
	getTextStyleForElement,
	isEditableTextElement,
	normalizeHexColor,
	renderVectorShape,
} from '../utils';
import type { TableStyleContext } from '../utils/table-band-style';
import type { FieldSubstitutionContext } from '../utils/text-field-substitution';
import { renderBody } from './elements/ElementBody';
import { ShapeEffectOverlay } from './elements/ShapeEffectOverlay';

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
}

const noop = (): void => {};
const EMPTY_MEDIA_DATA_URLS = new Map<string, string>();

function StaticElementRendererImpl({
	element,
	activeSlide,
	allSlides,
	mediaDataUrls = EMPTY_MEDIA_DATA_URLS,
	sourceSlideIndex,
	zIndex,
	positioned = true,
	fieldContext,
	tableStyleContext,
	parentGroupFill,
	onActionClick,
	actionRequiresModifier = false,
	animation,
	exposeElementId = false,
}: StaticElementRendererProps): React.ReactElement | null {
	// Selection-Pane-hidden elements are not drawn on any surface, so the static
	// path (thumbnails, presenter previews, transition ghosts, export rasters)
	// skips them too. This function holds no hooks, so the guard can lead.
	if (!isElementRendered(element)) {
		return null;
	}
	const style = hasShapeProperties(element) ? element.shapeStyle : undefined;
	const hasFill =
		(style?.fillColor !== undefined && style.fillColor !== 'transparent') ||
		Boolean(buildCssGradientFromShapeStyle(style) || style?.fillGradient) ||
		(style?.fillMode === 'pattern' && Boolean(style.fillPatternPreset));
	const fill = normalizeHexColor(style?.fillColor, DEFAULT_FILL_COLOR);
	const strokeWidth = Math.max(0, style?.strokeWidth || 0);
	const stroke = normalizeHexColor(style?.strokeColor, DEFAULT_STROKE_COLOR);
	const baseVisualStyle = getShapeVisualStyle(element, hasFill, fill, strokeWidth, stroke);
	// `a:grpFill`: a child with fillMode 'group' inherits the enclosing group's
	// fill. `getShapeVisualStyle` has no group branch, so override the resolved
	// background here from the shared resolver (no-op for non-grpFill children).
	const inheritedFill = resolveGroupChildFill(element, parentGroupFill);
	const visualStyle: React.CSSProperties = inheritedFill
		? {
				...baseVisualStyle,
				backgroundColor: inheritedFill.backgroundColor,
				backgroundImage: inheritedFill.backgroundImage,
				backgroundRepeat: inheritedFill.backgroundRepeat,
				backgroundSize: inheritedFill.backgroundSize,
				backgroundPosition: inheritedFill.backgroundPosition,
			}
		: baseVisualStyle;
	const textStyle = getTextStyleForElement(
		element,
		element.type === 'shape' && hasFill ? '#ffffff' : DEFAULT_TEXT_COLOR,
	);
	const isImage = element.type === 'picture' || element.type === 'image';
	const action = element.actionClick;
	const isActionable = Boolean(action && onActionClick);
	// A node that exposes the element contract is a slide element in its own
	// right (a live-stage group child), so it carries the same shared role /
	// name model the other four bindings apply when they walk the flattened
	// element tree - otherwise a grouped shape is addressable but anonymous.
	// Overlay copies expose no id and stay on the plain actionable-only role.
	const contractRole = exposeElementId
		? getAriaRole(element, { actionable: isElementActionable(element) })
		: isActionable
			? 'button'
			: undefined;

	return (
		<div
			data-static-element-type={element.type}
			data-element-id={exposeElementId ? element.id : undefined}
			// The neutral element marker belongs on the same nodes as the rest of
			// the contract. A live-stage group child already carries the id, the
			// role, the accessible name and `data-pptx-action`, so withholding just
			// this attribute made React advertise 28 elements on a slide where the
			// other four bindings advertised 33 - the same DOM, counted differently.
			// It is not a selection key (a click on a child resolves UP to the group
			// via `resolveTopLevelElementId`, which walks `data-element-id`), so
			// marking children cannot change what a click selects.
			data-pptx-element={exposeElementId ? 'true' : undefined}
			data-pptx-action={isActionable ? 'click' : undefined}
			className={`${positioned ? 'absolute' : 'relative'} overflow-hidden ${
				isActionable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
			}`}
			role={contractRole}
			aria-label={exposeElementId ? getAriaLabel(element) : undefined}
			aria-roledescription={exposeElementId ? getAriaRoleDescription(element) : undefined}
			tabIndex={isActionable ? 0 : undefined}
			title={isActionable ? action?.tooltip || action?.url || undefined : undefined}
			onClick={
				isActionable
					? (event) => {
							if (actionRequiresModifier && !event.ctrlKey && !event.metaKey) {
								return;
							}
							event.stopPropagation();
							event.preventDefault();
							onActionClick?.(element.id, action!);
						}
					: undefined
			}
			onKeyDown={
				isActionable
					? (event) => {
							if (event.key !== 'Enter' && event.key !== ' ') {
								return;
							}
							event.preventDefault();
							event.stopPropagation();
							onActionClick?.(element.id, action!);
						}
					: undefined
			}
			style={{
				left: positioned ? element.x : undefined,
				top: positioned ? element.y : undefined,
				width: positioned ? Math.max(element.width, 1) : '100%',
				height: positioned ? Math.max(element.height, 1) : '100%',
				transform: positioned ? getElementTransform(element) : undefined,
				transformOrigin: 'center',
				zIndex,
				...visualStyle,
				animation,
			}}
		>
			{/* Soft-edge <filter> defs + DAG fill-overlay tint layer. */}
			<ShapeEffectOverlay element={element} />
			{element.type === 'group' ? (
				<div className='relative w-full h-full'>
					{((element as GroupPptxElement).children ?? []).map((child, index) => (
						<StaticElementRenderer
							key={child.id}
							element={child}
							activeSlide={activeSlide}
							allSlides={allSlides}
							mediaDataUrls={mediaDataUrls}
							sourceSlideIndex={sourceSlideIndex}
							zIndex={index}
							fieldContext={fieldContext}
							tableStyleContext={tableStyleContext}
							parentGroupFill={getGroupChildParentFill(element)}
							onActionClick={onActionClick}
							actionRequiresModifier={actionRequiresModifier}
							exposeElementId={exposeElementId}
						/>
					))}
				</div>
			) : (
				renderBody({
					el: element,
					isImg: isImage,
					isEditing: false,
					editText: '',
					spellCheck: false,
					txtSE: hasTextProperties(element) ? element.textStyle : undefined,
					txtS: textStyle,
					vecShape: renderVectorShape(element, hasFill, fill, strokeWidth, stroke),
					imgStyle: getImageRenderStyle(element),
					imgFilter: getImageEffectsFilter(element),
					imgOpacity: getImageEffectsOpacity(element),
					imgAlt: '',
					isTxtEl: isEditableTextElement(element),
					media: mediaDataUrls,
					tableSt: null,
					isSel: false,
					doInk: true,
					doGrp: false,
					onEditChange: noop,
					onCommit: noop,
					onCancel: noop,
					isPresentationPassive: false,
					slideElements: activeSlide?.elements,
					allSlides,
					sourceSlideIndex,
					fieldContext,
					tableStyleContext,
					canEditSmartArt: false,
					canEditChart: false,
				})
			)}
		</div>
	);
}

/**
 * Read-only element dispatcher shared by previews, thumbnails, and groups.
 *
 * Memoized: a themed background group can hold dozens of static freeform
 * shapes (per slide and per thumbnail), and every element is a stable parsed
 * object, so re-renders driven by zoom, slide navigation, or presentation
 * state must not re-render the whole subtree. The recursion above references
 * this memoized export so nested group children stay memoized too.
 */
export const StaticElementRenderer = React.memo(StaticElementRendererImpl);
StaticElementRenderer.displayName = 'StaticElementRenderer';
