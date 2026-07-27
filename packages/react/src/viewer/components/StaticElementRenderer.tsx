import type { GroupPptxElement, PptxElement, PptxSlide, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import { getGroupChildParentFill, resolveGroupChildFill } from 'pptx-viewer-shared';
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
}: StaticElementRendererProps): React.ReactElement {
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

	return (
		<div
			data-static-element-type={element.type}
			data-pptx-action={isActionable ? 'click' : undefined}
			className={`${positioned ? 'absolute' : 'relative'} overflow-hidden ${
				isActionable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'
			}`}
			role={isActionable ? 'button' : undefined}
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
