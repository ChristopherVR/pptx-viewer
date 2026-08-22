/**
 * Shared writer for a ChartML shape-properties node (`c:spPr`, CT_ShapeProperties)
 * built from a flat {@link PptxChartShapeProps} (fill colour, stroke colour,
 * stroke width, stroke dash style).
 *
 * `c:upDownBars/c:upBars(downBars)/c:spPr` and `c:dTable/c:spPr` both reduce to
 * exactly this shape, so the DrawingML-order bookkeeping (`a:xfrm`, `a:noFill`
 * vs `a:solidFill`, `a:ln` internals) lives here once instead of being
 * hand-rolled at each call site.
 *
 * @module utils/chart-shape-props-writer
 */
import type { PptxChartShapeProps, XmlObject } from '../types';
import type { ResolveChartColor } from './chart-color-choice';
import { chartColorChoiceValue } from './chart-color-choice';

type LocalName = (key: string) => string;

const SP_PR_ORDER = [
	'xfrm',
	'prstGeom',
	'custGeom',
	'noFill',
	'solidFill',
	'gradFill',
	'pattFill',
	'ln',
	'effectLst',
	'effectDag',
	'scene3d',
	'sp3d',
	'extLst',
] as const;
const LN_ORDER = [
	'noFill',
	'solidFill',
	'gradFill',
	'pattFill',
	'prstDash',
	'custDash',
	'round',
	'bevel',
	'miter',
	'headEnd',
	'tailEnd',
	'extLst',
] as const;

function findChildKey(node: XmlObject, name: string, localName: LocalName): string | undefined {
	return Object.keys(node).find((key) => localName(key) === name);
}

function setDrawingChild(
	node: XmlObject,
	name: string,
	value: XmlObject,
	order: readonly string[],
	localName: LocalName,
): void {
	const key = findChildKey(node, name, localName);
	if (key) {
		node[key] = value;
		return;
	}
	const entries = Object.entries(node);
	const rank = order.indexOf(name);
	const index = entries.findIndex(([candidate]) => {
		const candidateRank = order.indexOf(localName(candidate));
		return candidateRank >= 0 && candidateRank > rank;
	});
	entries.splice(index < 0 ? entries.length : index, 0, [`a:${name}`, value]);
	for (const candidate of Object.keys(node)) {
		delete node[candidate];
	}
	for (const [candidate, child] of entries) {
		node[candidate] = child;
	}
}

/**
 * Merge `style` into `existing` (an already-authored `c:spPr`, if any) and
 * return the updated node. Only the fields present on `style` are touched;
 * unmodelled children (xfrm, effects, 3D) pass through untouched.
 */
export function writeChartShapeProps(
	existing: XmlObject | undefined,
	style: PptxChartShapeProps,
	localName: LocalName,
	resolveColor?: ResolveChartColor,
): XmlObject {
	const spPr: XmlObject = { ...(existing ?? {}) };
	if (style.fillColor) {
		const noFill = findChildKey(spPr, 'noFill', localName);
		if (noFill) {
			delete spPr[noFill];
		}
		setDrawingChild(
			spPr,
			'solidFill',
			chartColorChoiceValue(
				spPr[findChildKey(spPr, 'solidFill', localName) ?? ''] as XmlObject | undefined,
				style.fillColor,
				resolveColor,
			),
			SP_PR_ORDER,
			localName,
		);
	}
	const hasLine = style.strokeColor || style.strokeWidth !== undefined || style.strokeDashStyle;
	if (hasLine) {
		const key = findChildKey(spPr, 'ln', localName) ?? 'a:ln';
		const line: XmlObject = { ...((spPr[key] as XmlObject | undefined) ?? {}) };
		if (style.strokeWidth !== undefined) {
			line['@_w'] = String(Math.round(style.strokeWidth * 12700));
		}
		if (style.strokeColor) {
			const noFill = findChildKey(line, 'noFill', localName);
			if (noFill) {
				delete line[noFill];
			}
			setDrawingChild(
				line,
				'solidFill',
				chartColorChoiceValue(
					line[findChildKey(line, 'solidFill', localName) ?? ''] as XmlObject | undefined,
					style.strokeColor,
					resolveColor,
				),
				LN_ORDER,
				localName,
			);
		}
		if (style.strokeDashStyle) {
			setDrawingChild(line, 'prstDash', { '@_val': style.strokeDashStyle }, LN_ORDER, localName);
		}
		setDrawingChild(spPr, 'ln', line, SP_PR_ORDER, localName);
	}
	return spPr;
}
