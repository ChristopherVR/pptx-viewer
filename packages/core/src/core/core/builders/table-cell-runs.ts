/**
 * table-cell-runs.ts - parse a table cell's `a:txBody` into styled runs.
 *
 * `PptxTableCell.text` flattens a cell to one `\n`-joined string and
 * `PptxTableCell.style` captures only the first paragraph's first `a:rPr`, so a
 * cell that mixes bold, colour, size or typeface across runs used to render
 * uniformly in the first run's style. This module produces the per-run model
 * (`PptxTableCell.textRuns`) that every binding's table renderer already knows
 * how to draw.
 *
 * The flat `text` is deliberately left alone: the save path detects an edited
 * cell by comparing that exact flattening against the source `a:txBody` (#68),
 * and an unedited rich cell is round-tripped verbatim on the strength of that
 * comparison. Adding runs alongside the string composes with that check rather
 * than defeating it.
 *
 * Sibling order (`a:r` interleaved with `a:br` / `a:fld`) is recovered from the
 * source XML by `paragraphContentEntries`, the same helper the shape text path
 * uses, so a soft break lands between the right runs instead of being appended.
 *
 * @module table-cell-runs
 */
import type { PptxTableCellTextRun, XmlObject } from '../../types';
import { paragraphContentEntries } from '../runtime/paragraph-sibling-order';

/** Content children of an `a:p` that contribute to a cell's rendered text. */
const CELL_CONTENT_TAGS: ReadonlySet<string> = new Set(['a:r', 'a:br', 'a:fld']);

export interface TableCellRunsContext {
	ensureArray: (value: unknown) => unknown[];
	parseColor: (colorNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

/** Read `a:latin` / `a:ea` / `a:cs` typeface from a run's properties. */
function runFontFamily(runProperties: XmlObject | undefined): string | undefined {
	for (const key of ['a:latin', 'a:ea', 'a:cs'] as const) {
		const typeface = (runProperties?.[key] as XmlObject | undefined)?.['@_typeface'];
		const name = String(typeface ?? '').trim();
		if (name) {
			return name;
		}
	}
	return undefined;
}

/** Map one `a:rPr` onto the run-level formatting fields. */
function applyRunProperties(
	run: PptxTableCellTextRun,
	runProperties: XmlObject | undefined,
	context: TableCellRunsContext,
): void {
	if (!runProperties) {
		return;
	}
	if (runProperties['@_b'] === '1') {
		run.bold = true;
	}
	if (runProperties['@_i'] === '1') {
		run.italic = true;
	}
	const underline = runProperties['@_u'];
	if (underline !== undefined && underline !== null && String(underline) !== 'none') {
		run.underline = true;
	}
	if (runProperties['@_strike'] && String(runProperties['@_strike']) !== 'noStrike') {
		run.strikethrough = true;
	}
	const size = parseInt(String(runProperties['@_sz'] ?? ''), 10);
	if (Number.isFinite(size) && size > 0) {
		run.fontSize = Math.round(size / 100);
	}
	if (runProperties['a:solidFill']) {
		const color = context.parseColor(runProperties['a:solidFill'] as XmlObject);
		if (color) {
			run.color = color;
		}
	}
	const fontFamily = runFontFamily(runProperties);
	if (fontFamily) {
		run.fontFamily = fontFamily;
	}
}

/**
 * Parse a cell's `a:txBody` into an ordered run list.
 *
 * @returns The runs, or `undefined` when the cell has no text-bearing runs at
 *   all (so the renderer keeps using the plain string and no memory is spent on
 *   an array of one trivial entry).
 */
export function extractTableCellTextRuns(
	tableCell: XmlObject | undefined,
	context: TableCellRunsContext,
): PptxTableCellTextRun[] | undefined {
	const paragraphs = context.ensureArray(
		(tableCell?.['a:txBody'] as XmlObject | undefined)?.['a:p'],
	) as XmlObject[];
	if (paragraphs.length === 0) {
		return undefined;
	}

	const runs: PptxTableCellTextRun[] = [];
	let textRunCount = 0;
	paragraphs.forEach((paragraph, paragraphIndex) => {
		if (paragraphIndex > 0) {
			runs.push({ text: '', isParagraphBreak: true });
		}
		const { entries } = paragraphContentEntries(paragraph, CELL_CONTENT_TAGS, (value) =>
			context.ensureArray(value),
		);
		for (const [tag, item] of entries) {
			if (tag === 'a:br') {
				runs.push({ text: '', isLineBreak: true });
				continue;
			}
			const node = item as XmlObject | undefined;
			const run: PptxTableCellTextRun = { text: String(node?.['a:t'] ?? '') };
			applyRunProperties(run, node?.['a:rPr'] as XmlObject | undefined, context);
			runs.push(run);
			textRunCount++;
		}
	});

	return textRunCount > 0 ? runs : undefined;
}
