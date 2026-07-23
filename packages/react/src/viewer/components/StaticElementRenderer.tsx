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

	return (
		<div
			data-static-element-type={element.type}
			className={`${positioned ? 'absolute' : 'relative'} overflow-hidden pointer-events-none`}
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
