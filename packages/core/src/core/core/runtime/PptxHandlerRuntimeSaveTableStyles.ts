import { XmlObject, type PptxTableCellStyle } from '../../types';

import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeLayoutSwitching';
import {
	writeCellFill,
	writeDiagonalBorders,
	writeCellTextFormatting,
} from './table-cell-save-helpers';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Write plain text into a table cell's txBody, preserving
	 * existing run properties where possible.
	 */
	protected writeTableCellText(xmlCell: XmlObject, text: string): void {
		if (!xmlCell['a:txBody']) {
			xmlCell['a:txBody'] = { 'a:bodyPr': {}, 'a:p': {} };
		}
		const txBody = xmlCell['a:txBody'] as XmlObject;

		// Preserve bodyPr
		if (!txBody['a:bodyPr']) txBody['a:bodyPr'] = {};

		// Preserve first run properties for style continuity
		const existingParagraphs = this.ensureArray(txBody['a:p']);
		const firstRPr = this.ensureArray(existingParagraphs[0]?.['a:r'])[0]?.[
			'a:rPr'
		];
		const firstPPr = existingParagraphs[0]?.['a:pPr'];

		const lines = text.split('\n');
		const paragraphs = lines.map((line) => {
			const paragraph: XmlObject = {};
			if (firstPPr) paragraph['a:pPr'] = firstPPr;
			paragraph['a:r'] = {
				...(firstRPr ? { 'a:rPr': firstRPr } : {}),
				'a:t': line,
			};
			return paragraph;
		});

		txBody['a:p'] = paragraphs.length === 1 ? paragraphs[0] : paragraphs;
	}

	/**
	 * Write cell styling back into XML (fill, alignment, font props).
	 */
	protected writeTableCellStyle(
		xmlCell: XmlObject,
		style: PptxTableCellStyle,
	): void {
		if (!xmlCell['a:tcPr']) xmlCell['a:tcPr'] = {};
		const tcPr = xmlCell['a:tcPr'] as XmlObject;

		// Background fill
		writeCellFill(tcPr, style);

		// Vertical alignment
		if (style.vAlign) {
			const vAlignMap: Record<string, string> = {
				top: 't',
				middle: 'ctr',
				bottom: 'b',
			};
			tcPr['@_anchor'] = vAlignMap[style.vAlign] || 't';
		}

		// Text direction (vertical text)
		if (style.textDirection) {
			const vertMap: Record<string, string> = {
				vertical: 'vert',
				vertical270: 'vert270',
				eaVert: 'eaVert',
				wordArtVert: 'wordArtVert',
				wordArtVertRtl: 'wordArtVertRtl',
				mongolianVert: 'mongolianVert',
			};
			tcPr['@_vert'] = vertMap[style.textDirection] || 'vert';
		}

		// Text alignment — set in first paragraph's pPr
		if (style.align) {
			const firstP = this.ensureArray(xmlCell['a:txBody']?.['a:p'])[0];
			if (firstP) {
				if (!firstP['a:pPr']) firstP['a:pPr'] = {};
				const alignMap: Record<string, string> = {
					left: 'l',
					center: 'ctr',
					right: 'r',
					justify: 'just',
				};
				firstP['a:pPr']['@_algn'] = alignMap[style.align] || 'l';
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
			if (
				edge.width !== undefined ||
				edge.color !== undefined ||
				edge.dash !== undefined
			) {
				if (!tcPr[edge.xmlKey]) tcPr[edge.xmlKey] = {};
				const ln = tcPr[edge.xmlKey] as XmlObject;
				if (edge.width !== undefined) {
					ln['@_w'] = String(
						Math.round(edge.width * PptxHandlerRuntime.EMU_PER_PX),
					);
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

		// Cell margins
		if (
			style.marginLeft !== undefined ||
			style.marginRight !== undefined ||
			style.marginTop !== undefined ||
			style.marginBottom !== undefined
		) {
			const emuPerPx = PptxHandlerRuntime.EMU_PER_PX;
			if (!tcPr['a:tcMar']) tcPr['a:tcMar'] = {};
			const tcMar = tcPr['a:tcMar'] as XmlObject;
			if (style.marginLeft !== undefined) {
				tcMar['a:marL'] = {
					'@_w': String(Math.round(style.marginLeft * emuPerPx)),
				};
			}
			if (style.marginRight !== undefined) {
				tcMar['a:marR'] = {
					'@_w': String(Math.round(style.marginRight * emuPerPx)),
				};
			}
			if (style.marginTop !== undefined) {
				tcMar['a:marT'] = {
					'@_w': String(Math.round(style.marginTop * emuPerPx)),
				};
			}
			if (style.marginBottom !== undefined) {
				tcMar['a:marB'] = {
					'@_w': String(Math.round(style.marginBottom * emuPerPx)),
				};
			}
		}

		// Diagonal borders
		writeDiagonalBorders(tcPr, style, PptxHandlerRuntime.EMU_PER_PX);

		// Font properties — update all runs across all paragraphs
		writeCellTextFormatting(xmlCell, style, this.ensureArray.bind(this));
	}
}
