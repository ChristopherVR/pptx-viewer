import type {
	ChartPptxElement,
	PptxElement,
	PptxSlide,
	SmartArtPptxElement,
} from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
	DEFAULT_TEXT_COLOR,
	DEFAULT_FILL_COLOR,
	DEFAULT_STROKE_COLOR,
	SLIDE_NAV_THUMBNAIL_WIDTH,
	SLIDE_TRANSITION_OPTIONS,
} from '../constants';
import type { CanvasSize } from '../types';
import {
	normalizeHexColor,
	buildCssGradientFromShapeStyle,
	getShapeVisualStyle,
	renderVectorShape,
	getTextStyleForElement,
	getImageRenderStyle,
	isEditableTextElement,
	shouldRenderFallbackLabel,
	getElementLabel,
	getElementTransform,
	getTextCompensationTransform,
	getTextLayoutStyle,
	renderTextSegments,
	isImageTiled,
	getImageTilingStyle,
} from '../utils';
import { ThumbnailChart, ThumbnailSmartArt, ThumbnailTable } from './thumbnail-element-renderers';

interface SlideThumbnailProps {
	slide: PptxSlide;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
}

function SlideThumbnailImpl({
	slide,
	templateElements,
	canvasSize,
}: SlideThumbnailProps): React.ReactElement {
	const safeCanvasWidth = Math.max(canvasSize.width, 1);
	const safeCanvasHeight = Math.max(canvasSize.height, 1);
	const scale = SLIDE_NAV_THUMBNAIL_WIDTH / safeCanvasWidth;
	const previewHeight = Math.max(56, Math.round(safeCanvasHeight * scale));
	const previewElements = [...templateElements, ...slide.elements].slice(0, 60);
	const { t } = useTranslation();
	const transitionLabel = slide.transition
		? (() => {
				const opt = SLIDE_TRANSITION_OPTIONS.find((o) => o.value === slide.transition?.type);
				return opt ? t(opt.i18nKey) : slide.transition.type;
			})()
		: undefined;

	return (
		<div
			className='relative w-full overflow-hidden rounded border border-border bg-white'
			style={{ height: previewHeight }}
		>
			{slide.backgroundColor && slide.backgroundColor !== 'transparent' && (
				<div
					className='absolute inset-0'
					style={{
						backgroundColor: normalizeHexColor(slide.backgroundColor, '#ffffff'),
					}}
				/>
			)}
			{slide.backgroundGradient && (
				<div
					className='absolute inset-0 pointer-events-none'
					style={{ background: slide.backgroundGradient }}
				/>
			)}
			{slide.backgroundImage && (
				<img
					src={slide.backgroundImage}
					alt=''
					className='absolute inset-0 w-full h-full object-cover pointer-events-none'
					draggable={false}
				/>
			)}
			<div
				className='absolute top-0 left-0 origin-top-left'
				style={{
					width: safeCanvasWidth,
					height: safeCanvasHeight,
					transform: `scale(${scale})`,
					transformOrigin: 'top left',
				}}
			>
				{/* Transition indicator badge */}
				{slide.transition &&
					slide.transition.type !== 'none' &&
					slide.transition.type !== 'cut' && (
						<div
							className='absolute top-0.5 right-0.5 z-10 px-1 py-px rounded bg-primary/80 text-[7px] text-white leading-tight pointer-events-none'
							title={t('pptx.slideThumbnail.transitionTooltip', { name: transitionLabel })}
						>
							{transitionLabel}
						</div>
					)}
				{previewElements.map((element) => {
					const elementWidth = Math.max(element.width, 1);
					const elementHeight = Math.max(element.height, 1);
					const elShapeStyle = hasShapeProperties(element) ? element.shapeStyle : undefined;
					const hasFill =
						(elShapeStyle?.fillColor !== undefined && elShapeStyle?.fillColor !== 'transparent') ||
						Boolean(buildCssGradientFromShapeStyle(elShapeStyle) || elShapeStyle?.fillGradient) ||
						(elShapeStyle?.fillMode === 'pattern' && Boolean(elShapeStyle.fillPatternPreset));
					const fillColor = normalizeHexColor(elShapeStyle?.fillColor, DEFAULT_FILL_COLOR);
					const strokeWidth = Math.max(0, elShapeStyle?.strokeWidth || 0);
					const strokeColor = normalizeHexColor(elShapeStyle?.strokeColor, DEFAULT_STROKE_COLOR);
					const shapeVisualStyle = getShapeVisualStyle(
						element,
						hasFill,
						fillColor,
						strokeWidth,
						strokeColor,
					);
					const vectorShape = renderVectorShape(
						element,
						hasFill,
						fillColor,
						strokeWidth,
						strokeColor,
					);
					const fallbackTextColor =
						element.type === 'shape' && hasFill ? '#ffffff' : DEFAULT_TEXT_COLOR;
					const textStyle = getTextStyleForElement(element, fallbackTextColor);
					const imageRenderStyle = getImageRenderStyle(element);
					const canRenderText = isEditableTextElement(element);
					const elText = hasTextProperties(element) ? element.text : undefined;
					const elTextSegments = hasTextProperties(element) ? element.textSegments : undefined;
					const hasText =
						(typeof elText === 'string' && elText.trim().length > 0) ||
						(elTextSegments?.length ?? 0) > 0;
					const fallbackLabel = shouldRenderFallbackLabel(element, canRenderText)
						? getElementLabel(element)
						: '';

					return (
						<div
							key={element.id}
							className='absolute overflow-hidden'
							style={{
								left: element.x,
								top: element.y,
								width: elementWidth,
								height: elementHeight,
								transform: getElementTransform(element),
								transformOrigin: 'center',
							}}
						>
							{(element.type === 'picture' || element.type === 'image') &&
							(element.svgData || element.imageData) ? (
								isImageTiled(element) ? (
									<div
										className='pointer-events-none w-full h-full'
										style={getImageTilingStyle(element)}
									/>
								) : (
									<img
										src={element.svgData || element.imageData}
										alt=''
										className='pointer-events-none'
										style={imageRenderStyle}
										draggable={false}
									/>
								)
							) : element.type === 'table' ? (
								<ThumbnailTable element={element} textStyle={textStyle} />
							) : element.type === 'smartArt' ? (
								<ThumbnailSmartArt element={element as SmartArtPptxElement} />
							) : element.type === 'chart' ? (
								<ThumbnailChart element={element as ChartPptxElement} />
							) : (
								<div className='relative w-full h-full overflow-hidden' style={shapeVisualStyle}>
									{vectorShape}
									{canRenderText && hasText && (
										<div
											className='w-full h-full whitespace-pre-wrap break-words px-1 py-0.5 leading-[1.3]'
											style={{
												...getTextLayoutStyle(element),
												...textStyle,
												transform: getTextCompensationTransform(element),
												transformOrigin: 'center',
											}}
										>
											{renderTextSegments(element, fallbackTextColor)}
										</div>
									)}
									{!hasText && fallbackLabel.length > 0 && (
										<div className='absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground'>
											{fallbackLabel}
										</div>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

/**
 * Memo comparator: re-render only when the slide identity, dirty/hidden flags,
 * underlying elements reference, template elements reference, or canvas size
 * changes. Avoids burning frames on parent re-renders that don't change props.
 */
function arePropsEqual(prev: SlideThumbnailProps, next: SlideThumbnailProps): boolean {
	if (prev.slide.id !== next.slide.id) {
		return false;
	}
	if (prev.slide.isDirty !== next.slide.isDirty) {
		return false;
	}
	if (prev.slide.hidden !== next.slide.hidden) {
		return false;
	}
	if (prev.slide.elements !== next.slide.elements) {
		return false;
	}
	if (prev.slide.backgroundColor !== next.slide.backgroundColor) {
		return false;
	}
	if (prev.slide.backgroundImage !== next.slide.backgroundImage) {
		return false;
	}
	if (prev.slide.backgroundGradient !== next.slide.backgroundGradient) {
		return false;
	}
	if (prev.templateElements !== next.templateElements) {
		return false;
	}
	if (
		prev.canvasSize.width !== next.canvasSize.width ||
		prev.canvasSize.height !== next.canvasSize.height
	) {
		return false;
	}
	return true;
}

export const SlideThumbnail = React.memo(SlideThumbnailImpl, arePropsEqual);
