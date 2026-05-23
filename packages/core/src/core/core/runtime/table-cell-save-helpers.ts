import type { PptxTableCellStyle, XmlObject } from '../../types';
import { serializeColorChoice } from '../../utils/color-xml-preservation';

/**
 * Optional callback to resolve a preserved colour-choice XML node back to a
 * hex string (so the writer can compare against the in-memory colour and
 * decide whether to re-emit the original or fall back to canonical srgb).
 */
export type ColorXmlResolver = (colorXml: XmlObject) => string | undefined;

/** Write fill mode (solid, gradient, pattern, none) into tcPr. */
export function writeCellFill(
	tcPr: XmlObject,
	style: PptxTableCellStyle,
	resolveColorXml?: ColorXmlResolver,
): void {
	if (
		style.fillMode === 'gradient' &&
		style.gradientFillStops &&
		style.gradientFillStops.length > 0
	) {
		delete tcPr['a:solidFill'];
		delete tcPr['a:pattFill'];
		const stops = style.gradientFillStops.map((stop) => {
			const posRaw = typeof stop.position === 'number' ? stop.position : 0;
			const position = Math.round(Math.max(0, Math.min(1, posRaw / 100)) * 100000);
			const stopXml: XmlObject = {
				'@_pos': String(position),
				'a:srgbClr': {
					'@_val': (stop.color || '000000').replace('#', ''),
				},
			};
			if (typeof stop.opacity === 'number') {
				(stopXml['a:srgbClr'] as XmlObject)['a:alpha'] = {
					'@_val': String(Math.round(Math.max(0, Math.min(1, stop.opacity)) * 100000)),
				};
			}
			return stopXml;
		});
		const gradientXml: XmlObject = { 'a:gsLst': { 'a:gs': stops } };
		const gradType = style.gradientFillType || 'linear';
		if (gradType === 'radial') {
			const pathType = style.gradientFillPathType || 'circle';
			const pathXml: XmlObject = { '@_path': pathType };
			if (style.gradientFillFillToRect) {
				const ftr = style.gradientFillFillToRect;
				pathXml['a:fillToRect'] = {
					'@_l': String(Math.round(ftr.l * 100000)),
					'@_t': String(Math.round(ftr.t * 100000)),
					'@_r': String(Math.round(ftr.r * 100000)),
					'@_b': String(Math.round(ftr.b * 100000)),
				};
			} else if (style.gradientFillFocalPoint) {
				const fp = style.gradientFillFocalPoint;
				pathXml['a:fillToRect'] = {
					'@_l': String(Math.round(fp.x * 100000)),
					'@_t': String(Math.round(fp.y * 100000)),
					'@_r': String(Math.round((1 - fp.x) * 100000)),
					'@_b': String(Math.round((1 - fp.y) * 100000)),
				};
			}
			gradientXml['a:path'] = pathXml;
		} else {
			const angle = typeof style.gradientFillAngle === 'number' ? style.gradientFillAngle : 90;
			gradientXml['a:lin'] = {
				'@_ang': String(Math.round(angle * 60000)),
				'@_scaled': '1',
			};
		}
		tcPr['a:gradFill'] = gradientXml;
	} else if (style.fillMode === 'pattern' && style.patternFillPreset) {
		delete tcPr['a:solidFill'];
		delete tcPr['a:gradFill'];
		const pattXml: XmlObject = {
			'@_prst': style.patternFillPreset,
		};
		if (style.patternFillForeground) {
			pattXml['a:fgClr'] = {
				'a:srgbClr': {
					'@_val': style.patternFillForeground.replace('#', ''),
				},
			};
		}
		if (style.patternFillBackground) {
			pattXml['a:bgClr'] = {
				'a:srgbClr': {
					'@_val': style.patternFillBackground.replace('#', ''),
				},
			};
		}
		tcPr['a:pattFill'] = pattXml;
	} else if (style.fillMode === 'none') {
		delete tcPr['a:solidFill'];
		delete tcPr['a:gradFill'];
		delete tcPr['a:pattFill'];
	} else if (style.backgroundColor) {
		delete tcPr['a:gradFill'];
		delete tcPr['a:pattFill'];
		const resolvedOriginal =
			style.backgroundColorXml && resolveColorXml
				? resolveColorXml(style.backgroundColorXml)
				: undefined;
		tcPr['a:solidFill'] = serializeColorChoice(
			style.backgroundColorXml,
			resolvedOriginal,
			style.backgroundColor,
		);
	}
}

/** Write diagonal border lines (a:lnTlToBr, a:lnBlToTr). */
export function writeDiagonalBorders(
	tcPr: XmlObject,
	style: PptxTableCellStyle,
	emuPerPx: number,
): void {
	if (style.borderDiagDownWidth !== undefined || style.borderDiagDownColor !== undefined) {
		if (!tcPr['a:lnTlToBr']) {
			tcPr['a:lnTlToBr'] = {};
		}
		const diagDown = tcPr['a:lnTlToBr'] as XmlObject;
		if (style.borderDiagDownWidth !== undefined) {
			diagDown['@_w'] = String(Math.round(style.borderDiagDownWidth * emuPerPx));
		}
		if (style.borderDiagDownColor) {
			diagDown['a:solidFill'] = {
				'a:srgbClr': {
					'@_val': style.borderDiagDownColor.replace('#', ''),
				},
			};
		}
	}
	if (style.borderDiagUpWidth !== undefined || style.borderDiagUpColor !== undefined) {
		if (!tcPr['a:lnBlToTr']) {
			tcPr['a:lnBlToTr'] = {};
		}
		const diagUp = tcPr['a:lnBlToTr'] as XmlObject;
		if (style.borderDiagUpWidth !== undefined) {
			diagUp['@_w'] = String(Math.round(style.borderDiagUpWidth * emuPerPx));
		}
		if (style.borderDiagUpColor) {
			diagUp['a:solidFill'] = {
				'a:srgbClr': {
					'@_val': style.borderDiagUpColor.replace('#', ''),
				},
			};
		}
	}
}

/** Write font properties into all runs across all paragraphs. */
export function writeCellTextFormatting(
	xmlCell: XmlObject,
	style: PptxTableCellStyle,
	ensureArray: (val: unknown) => XmlObject[],
): void {
	if (
		style.bold === undefined &&
		style.italic === undefined &&
		style.underline === undefined &&
		style.fontSize === undefined &&
		style.color === undefined
	) {
		return;
	}

	const paragraphs = ensureArray(
		(xmlCell['a:txBody'] as XmlObject | undefined)?.['a:p'],
	) as XmlObject[];
	for (const paragraph of paragraphs) {
		const runs = ensureArray(paragraph?.['a:r']);
		const rebuiltRuns: XmlObject[] = [];
		let runsChanged = false;
		for (const run of runs) {
			if (!run) {
				rebuiltRuns.push(run);
				continue;
			}
			// OOXML CT_RegularTextRun schema order is `rPr?, t`. fast-xml-parser
			// emits keys in insertion order, so if the run already has `a:t`
			// but no `a:rPr`, simply assigning `run['a:rPr'] = {}` appends it
			// *after* `a:t` and produces schema-invalid output. Rebuild the
			// run object so `a:rPr` is always the first key.
			const existingRPr = (run['a:rPr'] as XmlObject | undefined) ?? {};
			const rPr: XmlObject = { ...existingRPr };
			if (style.bold !== undefined) {
				rPr['@_b'] = style.bold ? '1' : '0';
			}
			if (style.italic !== undefined) {
				rPr['@_i'] = style.italic ? '1' : '0';
			}
			if (style.underline !== undefined) {
				rPr['@_u'] = style.underline ? 'sng' : 'none';
			}
			if (style.fontSize !== undefined) {
				rPr['@_sz'] = String(style.fontSize * 100);
			}
			if (style.color) {
				rPr['a:solidFill'] = {
					'a:srgbClr': {
						'@_val': style.color.replace('#', ''),
					},
				};
			}
			// Preserve every other run child (a:t, a:rtl, etc.) in its
			// original relative order, but force a:rPr to come first.
			const rebuilt: XmlObject = { 'a:rPr': rPr };
			for (const key of Object.keys(run)) {
				if (key === 'a:rPr') {
					continue;
				}
				rebuilt[key] = run[key];
			}
			rebuiltRuns.push(rebuilt);
			runsChanged = true;
		}
		if (runsChanged && rebuiltRuns.length > 0) {
			paragraph['a:r'] = rebuiltRuns.length === 1 ? rebuiltRuns[0] : rebuiltRuns;
		}
	}
}
