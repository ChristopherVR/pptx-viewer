import type {
	ChartPptxElement,
	PptxElement,
	SmartArtPptxElement,
	TablePptxElement,
	XmlObject,
} from 'pptx-viewer-core';
import React from 'react';

import { EMU_PER_PX } from '../constants';
import {
	parseTableElementData,
	extractCellText,
	extractTableCellStyle,
	ensureArrayValue,
	renderChartElement,
} from '../utils';
import { getTableCellBandStyle } from '../utils/table-band-style';
import { cellStyleToCss } from '../utils/table-render-helpers';
import { SmartArtRenderer } from './elements/SmartArtRenderer';

function ThumbnailFallbackLabel({ label }: { label: string }): React.ReactElement {
	return (
		<div className='w-full h-full flex items-center justify-center text-[10px] text-muted-foreground pointer-events-none'>
			{label}
		</div>
	);
}

/* ------------------------------------------------------------------ */
/*  Lightweight read-only table for thumbnails                         */
/* ------------------------------------------------------------------ */

export function ThumbnailTable({
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
	return <ThumbnailFallbackLabel label='Table' />;
}

/* ------------------------------------------------------------------ */
/*  Lightweight read-only SmartArt for thumbnails                      */
/* ------------------------------------------------------------------ */

export function ThumbnailSmartArt({
	element,
}: {
	element: SmartArtPptxElement;
}): React.ReactElement {
	const data = element.smartArtData;
	if (!data || data.nodes.length === 0) {
		return <ThumbnailFallbackLabel label='SmartArt' />;
	}

	// Reuse the real canvas renderer (static, non-editable) so the thumbnail
	// shows the same layout geometry as the slide instead of an approximation.
	return <SmartArtRenderer element={element} className='pointer-events-none' />;
}

/* ------------------------------------------------------------------ */
/*  Lightweight read-only chart for thumbnails                         */
/* ------------------------------------------------------------------ */

export function ThumbnailChart({ element }: { element: ChartPptxElement }): React.ReactElement {
	const chartData = element.chartData;
	if (!chartData || chartData.series.length === 0) {
		return <ThumbnailFallbackLabel label='Chart' />;
	}

	// Reuse the real canvas renderer (static SVG) so the thumbnail shows the
	// actual chart instead of a text placeholder.
	return <div className='w-full h-full pointer-events-none'>{renderChartElement(element)}</div>;
}
