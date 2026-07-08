import type { PptxElement, PptxSlide, SmartArtPptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
/**
 * ScaledSlidePreview: renders a slide at any size by scaling the native
 * canvas dimensions into a container-determined bounding box.
 *
 * Used by PresenterView for current-slide and next-slide previews.
 */
import React, { useEffect, useRef, useState } from 'react';

import { DEFAULT_TEXT_COLOR, DEFAULT_FILL_COLOR, DEFAULT_STROKE_COLOR } from '../constants';
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
import { colour, resolvePalette } from '../utils/smartart-helpers';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ScaledSlidePreviewProps {
	slide: PptxSlide;
	templateElements: PptxElement[];
	canvasSize: CanvasSize;
	className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function ScaledSlidePreviewImpl({
	slide,
	templateElements,
	canvasSize,
	className,
}: ScaledSlidePreviewProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(0);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) {
				setContainerWidth(entry.contentRect.width);
			}
		});
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const safeCanvasWidth = Math.max(canvasSize.width, 1);
	const safeCanvasHeight = Math.max(canvasSize.height, 1);
	const scale = containerWidth > 0 ? containerWidth / safeCanvasWidth : 0.2;
	const previewHeight = Math.max(40, Math.round(safeCanvasHeight * scale));
	const previewElements = [...templateElements, ...slide.elements].slice(0, 80);

	return (
		<div
			ref={containerRef}
			className={`relative w-full overflow-hidden rounded border border-border bg-white ${className ?? ''}`}
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
			{slide.backgroundImage && (
				<img
					src={slide.backgroundImage}
					alt=''
					className='absolute inset-0 w-full h-full object-cover pointer-events-none'
					draggable={false}
				/>
			)}
			{slide.backgroundGradient && (
				<div className='absolute inset-0' style={{ backgroundImage: slide.backgroundGradient }} />
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
							) : element.type === 'smartArt' ? (
								<PreviewSmartArt element={element as SmartArtPptxElement} />
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

/* ------------------------------------------------------------------ */
/*  Lightweight read-only SmartArt for scaled previews                  */
/* ------------------------------------------------------------------ */

function PreviewSmartArt({ element }: { element: SmartArtPptxElement }): React.ReactElement {
	const data = element.smartArtData;
	if (!data || data.nodes.length === 0) {
		return (
			<div className='w-full h-full flex items-center justify-center text-[10px] text-muted-foreground pointer-events-none'>
				SmartArt
			</div>
		);
	}

	const palette = resolvePalette(element);
	const shapes = data.drawingShapes;

	if (shapes && shapes.length > 0) {
		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		for (const s of shapes) {
			if (s.x < minX) {
				minX = s.x;
			}
			if (s.y < minY) {
				minY = s.y;
			}
			if (s.x + s.width > maxX) {
				maxX = s.x + s.width;
			}
			if (s.y + s.height > maxY) {
				maxY = s.y + s.height;
			}
		}
		const drawingW = maxX - minX || 1;
		const drawingH = maxY - minY || 1;

		return (
			<svg
				viewBox={`0 0 ${drawingW} ${drawingH}`}
				className='w-full h-full pointer-events-none'
				preserveAspectRatio='xMidYMid meet'
			>
				{shapes.map((shape, i) => {
					const fill = shape.fillColor ?? colour(i, palette);
					const relX = shape.x - minX;
					const relY = shape.y - minY;
					const isEllipse = shape.shapeType === 'ellipse';
					const isChevron = shape.shapeType === 'chevron' || shape.shapeType === 'homePlate';

					if (isEllipse) {
						return (
							<ellipse
								key={`${element.id}-ps-${i}`}
								cx={relX + shape.width / 2}
								cy={relY + shape.height / 2}
								rx={shape.width / 2}
								ry={shape.height / 2}
								fill={fill}
							/>
						);
					}
					if (isChevron) {
						const x0 = relX;
						const y0 = relY;
						const w = shape.width;
						const h = shape.height;
						const notch = w * 0.2;
						const points = `${x0},${y0} ${x0 + w - notch},${y0} ${x0 + w},${y0 + h / 2} ${x0 + w - notch},${y0 + h} ${x0},${y0 + h} ${x0 + notch},${y0 + h / 2}`;
						return <polygon key={`${element.id}-ps-${i}`} points={points} fill={fill} />;
					}
					const rx =
						shape.shapeType === 'roundRect' ? Math.min(shape.width, shape.height) * 0.1 : 0;
					return (
						<rect
							key={`${element.id}-ps-${i}`}
							x={relX}
							y={relY}
							width={shape.width}
							height={shape.height}
							rx={rx}
							fill={fill}
						/>
					);
				})}
			</svg>
		);
	}

	// Fallback: coloured rectangles for each node
	const nodes = data.nodes;
	const count = nodes.length;
	const gap = 2;
	return (
		<svg
			viewBox='0 0 100 60'
			className='w-full h-full pointer-events-none'
			preserveAspectRatio='xMidYMid meet'
		>
			{nodes.map((node, i) => {
				const w = (100 - gap * (count - 1)) / count;
				return (
					<rect
						key={node.id}
						x={i * (w + gap)}
						y={10}
						width={w}
						height={40}
						rx={3}
						fill={colour(i, palette)}
					/>
				);
			})}
		</svg>
	);
}

/**
 * Memo comparator: re-render only when slide identity, dirty/hidden state,
 * elements, template elements, canvas size, or className change.
 */
function arePropsEqual(prev: ScaledSlidePreviewProps, next: ScaledSlidePreviewProps): boolean {
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
	if (prev.className !== next.className) {
		return false;
	}
	return true;
}

export const ScaledSlidePreview = React.memo(ScaledSlidePreviewImpl, arePropsEqual);
