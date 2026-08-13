import type { PptxTableCell } from 'pptx-viewer-core';
import { cellRunStyle } from 'pptx-viewer-shared';
import React from 'react';

/**
 * Rich per-run table-cell content.
 *
 * A cell's `text` is a flat `\n`-joined string, so a cell mixing bold, colour,
 * size or typeface across runs rendered entirely in the first run's style.
 * `PptxTableCell.textRuns` (parsed by core) carries the real sequence; the
 * other four bindings already had this branch and nothing populated it.
 *
 * Paragraph boundaries become zero-height block `<div>`s (so the following
 * runs start on a new line without adding vertical space of their own) and
 * `a:br` soft breaks become `<br>`, matching the vanilla / svelte renderers.
 *
 * @param cell - The cell, or `undefined` for the raw-XML path when no parsed
 *   cell is available at this position.
 * @param fallbackText - Plain text rendered when the cell has no runs.
 */
export function renderTableCellContent(
	cell: PptxTableCell | undefined,
	fallbackText: string,
): React.ReactNode {
	const runs = cell?.textRuns;
	if (!runs || runs.length === 0) {
		return fallbackText || ' ';
	}
	return runs.map((run, index) => {
		if (run.isParagraphBreak) {
			return <div key={`p-${index}`} style={{ display: 'block', height: 0 }} />;
		}
		if (run.isLineBreak) {
			return <br key={`br-${index}`} />;
		}
		return (
			<span
				key={`r-${index}`}
				style={{ position: 'relative', ...(cellRunStyle(run) as React.CSSProperties) }}
			>
				{run.text}
			</span>
		);
	});
}
