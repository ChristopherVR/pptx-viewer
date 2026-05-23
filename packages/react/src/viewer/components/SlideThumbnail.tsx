import type { PptxElement, PptxSlide, TablePptxElement, XmlObject } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import React from 'react';

import {
	DEFAULT_TEXT_COLOR,
	DEFAULT_FILL_COLOR,
	DEFAULT_STROKE_COLOR,
	SLIDE_NAV_THUMBNAIL_WIDTH,
	EMU_PER_PX,
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
	parseTableElementData,
	extractCellText,
	extractTableCellStyle,
	ensureArrayValue,
} from '../utils';
import { getTableCellBandStyle } from '../utils/table-band-style';
import { cellStyleToCss } from '../utils/table-render-helpers';

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
							className='absolute top-0.5 right-0.5 z-10 px-1 py-px rounded bg-primary/80 text-[7px] text-primary-foreground leading-tight pointer-events-none'
							title={`Transition: ${SLIDE_TRANSITION_OPTIONS.find((o) => o.value === slide.transition?.type)?.label ?? slide.transition.type}`}
						>
							{SLIDE_TRANSITION_OPTIONS.find((o) => o.value === slide.transition?.type)?.label ??
								slide.transition.type}
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
/*  Lightweight read-only table for thumbnails                         */
/* ------------------------------------------------------------------ */

function ThumbnailTable({
	element,
	textStyle,
}: {
	element: PptxElement;
	textStyle: React.CSSProperties;
}): React.ReactElement {
	// Try XML-based table first
	const parsedTable = parseTableElementData(element, textStyle);
	if (parsedTable) {
		return (
			<div className='w-full h-full overflow-hidden pointer-events-none'>
				<table className='w-full h-full border-collapse table-fixed'>
					{parsedTable.columnPercentages.length > 0 && (
						<colgroup>
							{parsedTable.columnPercentages.map((pct, ci) => (
								<col key={`${element.id}-tc-${ci}`} style={{ width: `${pct.toFixed(2)}%` }} />
							))}
						</colgroup>
					)}
					<tbody>
						{parsedTable.rows.map((row, ri) => {
							const cells = ensureArrayValue(row['a:tc'] as XmlObject | XmlObject[] | undefined);
							const rowHeightRaw = Number.parseInt(String(row['@_h'] || ''), 10);
							const rowHeight =
								Number.isFinite(rowHeightRaw) && rowHeightRaw > 0
									? Math.max(16, rowHeightRaw / EMU_PER_PX)
									: undefined;
							return (
								<tr
									key={`${element.id}-tr-${ri}`}
									style={rowHeight ? { height: rowHeight } : undefined}
								>
									{cells.map((cell, ci) => {
										const isHMerged = cell['@_hMerge'] === '1';
										const isVMerged = cell['@_vMerge'] === '1';
										if (isHMerged || isVMerged) {
											return null;
										}

										const gridSpanRaw = Number.parseInt(String(cell['@_gridSpan'] || ''), 10);
										const colSpan =
											Number.isFinite(gridSpanRaw) && gridSpanRaw > 1 ? gridSpanRaw : undefined;
										const rowSpanRaw = Number.parseInt(String(cell['@_rowSpan'] || ''), 10);
										const rSpan =
											Number.isFinite(rowSpanRaw) && rowSpanRaw > 1 ? rowSpanRaw : undefined;

										const bandStyle = getTableCellBandStyle(
											element,
											ri,
											ci,
											parsedTable.rowCount,
											parsedTable.columnCount,
										);

										return (
											<td
												key={`${element.id}-td-${ri}-${ci}`}
												className='border border-gray-300/50 px-1 py-0.5 align-top'
												colSpan={colSpan}
												rowSpan={rSpan}
												style={{
													...extractTableCellStyle(cell, textStyle),
													...bandStyle,
												}}
											>
												{extractCellText(cell) || '\u00a0'}
											</td>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		);
	}

	// Fall back to programmatic tableData
	const tableEl = element as TablePptxElement;
	if (tableEl.tableData && tableEl.tableData.rows.length > 0) {
		const td = tableEl.tableData;
		return (
			<div className='w-full h-full overflow-hidden pointer-events-none'>
				<table className='w-full h-full border-collapse table-fixed'>
					<tbody>
						{td.rows.map((row, ri) => (
							<tr
								key={`${element.id}-tdr-${ri}`}
								style={row.height ? { height: row.height } : undefined}
							>
								{row.cells.map((cell, ci) => {
									if (cell.hMerge || cell.vMerge) {
										return null;
									}
									const bandStyle = getTableCellBandStyle(
										element,
										ri,
										ci,
										td.rows.length,
										row.cells.length,
									);
									return (
										<td
											key={`${element.id}-tdd-${ri}-${ci}`}
											className='border border-gray-300/50 px-1 py-0.5 align-top'
											colSpan={cell.gridSpan && cell.gridSpan > 1 ? cell.gridSpan : undefined}
											rowSpan={cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined}
											style={{
												...cellStyleToCss(cell.style),
												...bandStyle,
											}}
										>
											{cell.text || '\u00a0'}
										</td>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		);
	}

	// No table data available
	return (
		<div className='w-full h-full flex items-center justify-center text-[10px] text-muted-foreground pointer-events-none'>
			Table
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
