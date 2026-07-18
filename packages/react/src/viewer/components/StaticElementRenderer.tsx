import type { GroupPptxElement, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
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
}

const noop = (): void => {};
const EMPTY_MEDIA_DATA_URLS = new Map<string, string>();

/** Read-only element dispatcher shared by previews, thumbnails, and groups. */
export function StaticElementRenderer({
	element,
	activeSlide,
	allSlides,
	mediaDataUrls = EMPTY_MEDIA_DATA_URLS,
	sourceSlideIndex,
	zIndex,
	positioned = true,
	fieldContext,
	tableStyleContext,
}: StaticElementRendererProps): React.ReactElement {
	const style = hasShapeProperties(element) ? element.shapeStyle : undefined;
	const hasFill =
		(style?.fillColor !== undefined && style.fillColor !== 'transparent') ||
		Boolean(buildCssGradientFromShapeStyle(style) || style?.fillGradient) ||
		(style?.fillMode === 'pattern' && Boolean(style.fillPatternPreset));
	const fill = normalizeHexColor(style?.fillColor, DEFAULT_FILL_COLOR);
	const strokeWidth = Math.max(0, style?.strokeWidth || 0);
	const stroke = normalizeHexColor(style?.strokeColor, DEFAULT_STROKE_COLOR);
	const visualStyle = getShapeVisualStyle(element, hasFill, fill, strokeWidth, stroke);
	// Match the canvas ElementRenderer default (DEFAULT_TEXT_COLOR) so inherited /
	// placeholder text resolves to the same colour in the thumbnail as on stage.
	const textStyle = getTextStyleForElement(element, DEFAULT_TEXT_COLOR);
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
