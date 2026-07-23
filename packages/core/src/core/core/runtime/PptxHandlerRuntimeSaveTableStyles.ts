import { XmlObject } from '../../types';
import type { PptxTableCellStyle } from '../../types';
import { TC_PR_BORDERS_ORDER, reorderObjectKeys } from '../../utils/xml-reorder';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeLayoutSwitching';
import {
	writeCellFill,
	writeDiagonalBorders,
	writeCellTextFormatting,
} from './table-cell-save-helpers';

type EnsureArray = (value: unknown) => XmlObject[];

/**
 * Flatten a cell `a:txBody` to the same `\n`-joined plain string that
 * `PptxTableDataParser.extractTableCellText` produces at load time
 * (per-paragraph run text followed by field text). Used to detect whether a
 * cell's text was actually edited so an unedited cell can keep its rich
 * multi-run / multi-paragraph structure verbatim (#68).
 */
export function flattenCellTxBodyText(
	txBody: XmlObject | undefined,
	ensureArray: EnsureArray,
): string {
	if (!txBody) {
		return '';
	}
	const paragraphs = ensureArray(txBody['a:p']);
	const lines: string[] = [];
	for (const paragraph of paragraphs) {
		const runs = ensureArray((paragraph as XmlObject)?.['a:r']);
		const fields = ensureArray((paragraph as XmlObject)?.['a:fld']);
		let lineText = '';
		for (const run of runs) {
			lineText += String((run as XmlObject)?.['a:t'] ?? '');
		}
		for (const field of fields) {
			lineText += String((field as XmlObject)?.['a:t'] ?? '');
		}
		lines.push(lineText);
	}
	return lines.join('\n');
}

/**
 * Whether a cell `a:txBody` carries rich content that the single cell-level
 * {@link PptxTableCellStyle} cannot represent without loss: more than one run,
 * any field (`a:fld`), or any run hyperlink (`a:hlinkClick`). Such cells must
 * keep their per-run formatting rather than have the cell-level font style
 * stamped over every run (#68).
 */
export function isRichCellTxBody(txBody: XmlObject | undefined, ensureArray: EnsureArray): boolean {
	if (!txBody) {
		return false;
	}
	const paragraphs = ensureArray(txBody['a:p']);
	let totalRuns = 0;
	for (const paragraph of paragraphs) {
		const runs = ensureArray((paragraph as XmlObject)?.['a:r']);
		totalRuns += runs.length;
		if (totalRuns > 1) {
			return true;
		}
		if (ensureArray((paragraph as XmlObject)?.['a:fld']).length > 0) {
			return true;
		}
		for (const run of runs) {
			const rPr = (run as XmlObject)?.['a:rPr'] as XmlObject | undefined;
			if (rPr?.['a:hlinkClick'] !== undefined) {
				return true;
			}
		}
	}
	return false;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Write plain text into a table cell's txBody, preserving
	 * existing run properties where possible.
	 */
	protected writeTableCellText(xmlCell: XmlObject, text: string): void {
		// #68: When the cell text is unchanged from what was parsed, leave the
		// original `a:txBody` untouched so its rich structure (multiple runs
		// with per-run rPr, hyperlinks `a:hlinkClick`, fields `a:fld`, and soft
		// breaks `a:br`) survives the round-trip verbatim. Only a genuinely
		// edited cell (text differs) falls through to the lossy single-run
		// rebuild below, which is the best we can do from a flat string.
		const ensureArray = this.ensureArray.bind(this);
		const existingTxBody = xmlCell['a:txBody'] as XmlObject | undefined;
		if (existingTxBody && ensureArray(existingTxBody['a:p']).length > 0) {
			if (flattenCellTxBodyText(existingTxBody, ensureArray) === text) {
				return;
			}
		}

		if (!xmlCell['a:txBody']) {
			xmlCell['a:txBody'] = { 'a:bodyPr': {}, 'a:p': {} };
		}
		const txBody = xmlCell['a:txBody'] as XmlObject;

		// Preserve bodyPr
		if (!txBody['a:bodyPr']) {
			txBody['a:bodyPr'] = {};
		}

		// Preserve first run properties for style continuity
		const existingParagraphs = this.ensureArray(txBody['a:p']);
		const firstRPr = this.ensureArray(existingParagraphs[0]?.['a:r'])[0]?.['a:rPr'] as
			| XmlObject
			| undefined;
		const firstPPr = existingParagraphs[0]?.['a:pPr'] as XmlObject | undefined;
		const firstEndParaRPr = existingParagraphs[0]?.['a:endParaRPr'] as XmlObject | undefined;

		// PowerPoint's "Insert Table" UI always emits `lang="en-US" dirty="0"`
		// on the default run and paragraph-end run. Seed those defaults when
		// the source cell didn't carry its own.
		const rPrForRun: XmlObject = firstRPr ? { ...firstRPr } : { '@_lang': 'en-US', '@_dirty': '0' };
		const endParaRPr: XmlObject = firstEndParaRPr
			? { ...firstEndParaRPr }
			: { '@_lang': 'en-US', '@_dirty': '0' };

		const lines = text.split('\n');
		const paragraphs = lines.map((line) => {
			// OOXML CT_TextParagraph order: pPr?, (r|br|fld)*, endParaRPr?.
			// Build the object in that exact key order — fast-xml-parser
			// emits in insertion order, and PowerPoint is strict about it.
			const paragraph: XmlObject = {};
			if (firstPPr) {
				paragraph['a:pPr'] = firstPPr;
			}
			paragraph['a:r'] = {
				'a:rPr': rPrForRun,
				'a:t': line,
			};
			paragraph['a:endParaRPr'] = endParaRPr;
			return paragraph;
		});

		txBody['a:p'] = paragraphs.length === 1 ? paragraphs[0] : paragraphs;
	}

	/**
	 * Write cell styling back into XML (fill, alignment, font props).
	 */
	protected writeTableCellStyle(xmlCell: XmlObject, style: PptxTableCellStyle): void {
		if (!xmlCell['a:tcPr']) {
			xmlCell['a:tcPr'] = {};
		}
		const tcPr = xmlCell['a:tcPr'] as XmlObject;

		// Background fill — pass a resolver so preserved colour-choice XML
		// can be re-emitted verbatim when the resolved hex still matches.
		writeCellFill(tcPr, style, (colorXml) => this.parseColor(colorXml));

		// Vertical alignment
		if (style.vAlign) {
			const vAlignMap: Record<string, string> = {
				top: 't',
				middle: 'ctr',
				bottom: 'b',
			};
			tcPr['@_anchor'] = vAlignMap[style.vAlign] || 't';
		}

		// Text direction (vertical text). Values are CT_TextVerticalType
		// spec tokens (`vert`, `vert270`, `eaVert`, `wordArtVert`,
		// `wordArtVertRtl`, `mongolianVert`) and pass through verbatim.
		if (style.textDirection) {
			tcPr['@_vert'] = style.textDirection;
		}

		// Text alignment — set in first paragraph's pPr
		if (style.align) {
			const firstP = this.ensureArray(
				(xmlCell['a:txBody'] as XmlObject | undefined)?.['a:p'],
			)[0] as XmlObject | undefined;
			if (firstP) {
				if (!firstP['a:pPr']) {
					firstP['a:pPr'] = {};
				}
				const alignMap: Record<string, string> = {
					left: 'l',
					center: 'ctr',
					right: 'r',
					justify: 'just',
				};
				(firstP['a:pPr'] as XmlObject)['@_algn'] = alignMap[style.align] || 'l';
			}
		}

		// Per-edge borders (width, color, dash style)
		const borderEdges = [
			{
				xmlKey: 'a:lnT',
				width: style.borderTopWidth,
				color: style.borderTopColor,
				dash: style.borderTopDash,
			},
			{
				xmlKey: 'a:lnB',
				width: style.borderBottomWidth,
				color: style.borderBottomColor,
				dash: style.borderBottomDash,
			},
			{
				xmlKey: 'a:lnL',
				width: style.borderLeftWidth,
				color: style.borderLeftColor,
				dash: style.borderLeftDash,
			},
			{
				xmlKey: 'a:lnR',
				width: style.borderRightWidth,
				color: style.borderRightColor,
				dash: style.borderRightDash,
			},
		] as const;
		for (const edge of borderEdges) {
			if (edge.width !== undefined || edge.color !== undefined || edge.dash !== undefined) {
				if (!tcPr[edge.xmlKey]) {
					tcPr[edge.xmlKey] = {};
				}
				const ln = tcPr[edge.xmlKey] as XmlObject;
				if (edge.width !== undefined) {
					ln['@_w'] = String(Math.round(edge.width * PptxHandlerRuntime.EMU_PER_PX));
				}
				if (edge.color) {
					ln['a:solidFill'] = {
						'a:srgbClr': { '@_val': edge.color.replace('#', '') },
					};
				}
				if (edge.dash && edge.dash !== 'solid') {
					ln['a:prstDash'] = { '@_val': edge.dash };
				} else if (edge.dash === 'solid') {
					delete ln['a:prstDash'];
				}
			}
		}

		// Cell margins — direct attributes on a:tcPr (CT_TableCellProperties §21.1.4.2)
		const emuPerPx = PptxHandlerRuntime.EMU_PER_PX;
		if (style.marginLeft !== undefined) {
			tcPr['@_marL'] = String(Math.round(style.marginLeft * emuPerPx));
		}
		if (style.marginRight !== undefined) {
			tcPr['@_marR'] = String(Math.round(style.marginRight * emuPerPx));
		}
		if (style.marginTop !== undefined) {
			tcPr['@_marT'] = String(Math.round(style.marginTop * emuPerPx));
		}
		if (style.marginBottom !== undefined) {
			tcPr['@_marB'] = String(Math.round(style.marginBottom * emuPerPx));
		}
		// Strip any legacy `<a:tcMar>` wrapper (invented by an earlier writer
		// version) so we don't emit conflicting margin sources.
		delete tcPr['a:tcMar'];

		// Diagonal borders
		writeDiagonalBorders(tcPr, style, PptxHandlerRuntime.EMU_PER_PX);

		// Font properties — update all runs across all paragraphs.
		// #68: `writeCellTextFormatting` stamps the single cell-level
		// bold/italic/underline/size/colour onto every run, which flattens a
		// multi-run cell's per-run formatting. Skip it for a rich cell (more
		// than one run, or any field / hyperlink) so its preserved per-run
		// styling survives; an edited cell reduces to a single run and still
		// gets the cell-level formatting applied here.
		if (
			!isRichCellTxBody(xmlCell['a:txBody'] as XmlObject | undefined, this.ensureArray.bind(this))
		) {
			writeCellTextFormatting(xmlCell, style, this.ensureArray.bind(this));
		}

		// Reorder tcPr children per CT_TableCellProperties §21.1.4.2 — borders
		// must appear in lnL/lnR/lnT/lnB/lnTlToBr/lnBlToTr order before the
		// fill choice and other children. Attributes (keys starting with `@_`)
		// are unordered in XML and pass through unchanged.
		const reordered = reorderObjectKeys(tcPr, TC_PR_BORDERS_ORDER);
		for (const key of Object.keys(tcPr)) {
			delete tcPr[key];
		}
		for (const key of Object.keys(reordered)) {
			tcPr[key] = reordered[key];
		}
	}
}
