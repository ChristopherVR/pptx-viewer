import type { OleNestedDeckSlideDetail, OleSheetGrid } from 'pptx-viewer-core';
import React from 'react';

/** Extracted from `OleEditorDialog.tsx` (300 LOC file-size limit): the three content-tab bodies it switches on. */
export type Translate = (key: string) => string;

/** Editable spreadsheet grid for the "sheet" tab. */
export function OleSheetGridEditor({
	grid,
	onCellEdit,
	t,
}: {
	grid: OleSheetGrid | undefined;
	onCellEdit: (row: number, col: number, value: string) => void;
	t: Translate;
}): React.ReactElement {
	if (!grid || grid.rows.length === 0) {
		return <p className='text-muted-foreground text-xs'>{t('pptx.ole.editDialog.emptySheet')}</p>;
	}
	return (
		<div className='overflow-auto max-h-[50vh] border border-border rounded'>
			<table className='w-full text-xs border-collapse'>
				<tbody>
					{grid.rows.map((row, rowIndex) => (
						// oxlint-disable-next-line no-array-index-key -- grid rows have no stable id
						<tr key={rowIndex}>
							{row.cells.map((cell, colIndex) => (
								<td
									// oxlint-disable-next-line no-array-index-key -- grid cells have no stable id
									key={colIndex}
									className='border border-border p-0'
								>
									<input
										type='text'
										defaultValue={cell.value}
										aria-label={t('pptx.ole.editDialog.cellEditLabel')}
										className='w-full px-1.5 py-1 bg-transparent focus:bg-accent/40 focus:outline-none'
										onBlur={(e) => {
											if (e.target.value !== cell.value) {
												onCellEdit(rowIndex, colIndex, e.target.value);
											}
										}}
									/>
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** Editable paragraph list for the "document" tab. */
export function OleDocumentEditor({
	paragraphs,
	onEdit,
	t,
}: {
	paragraphs: string[] | undefined;
	onEdit: (index: number, text: string) => void;
	t: Translate;
}): React.ReactElement {
	if (!paragraphs || paragraphs.length === 0) {
		return (
			<p className='text-muted-foreground text-xs'>{t('pptx.ole.editDialog.emptyDocument')}</p>
		);
	}
	return (
		<div className='space-y-2'>
			{paragraphs.map((paragraph, index) => (
				<textarea
					// oxlint-disable-next-line no-array-index-key -- paragraphs have no stable id
					key={index}
					defaultValue={paragraph}
					rows={2}
					className='w-full px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs resize-y focus:outline-none focus:ring-2 focus:ring-primary/50'
					onBlur={(e) => {
						if (e.target.value !== paragraph) {
							onEdit(index, e.target.value);
						}
					}}
				/>
			))}
		</div>
	);
}

/** Editable full text-element list for the "deck" (nested presentation) tab: every slide, every text-bearing shape. */
export function OleDeckEditor({
	slides,
	onEdit,
	t,
}: {
	slides: OleNestedDeckSlideDetail[] | undefined;
	onEdit: (slideIndex: number, elementId: string, text: string) => void;
	t: Translate;
}): React.ReactElement {
	if (!slides || slides.length === 0) {
		return <p className='text-muted-foreground text-xs'>{t('pptx.ole.editDialog.deckEmpty')}</p>;
	}
	return (
		<div className='space-y-3'>
			{slides.map((slide) => (
				<div key={slide.index} className='space-y-1.5'>
					<span className='text-muted-foreground text-xs font-medium'>
						{t('pptx.ole.editDialog.deckSlideLabel').replace('{{number}}', String(slide.index + 1))}
					</span>
					{slide.elements.length === 0 ? (
						<p className='text-muted-foreground text-xs italic'>
							{t('pptx.ole.editDialog.deckEmpty')}
						</p>
					) : (
						slide.elements.map((element) => (
							<input
								key={element.elementId}
								type='text'
								defaultValue={element.text}
								className='w-full px-2 py-1.5 rounded border border-border bg-muted text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/50'
								onBlur={(e) => {
									if (e.target.value !== element.text) {
										onEdit(slide.index, element.elementId, e.target.value);
									}
								}}
							/>
						))
					)}
				</div>
			))}
		</div>
	);
}
