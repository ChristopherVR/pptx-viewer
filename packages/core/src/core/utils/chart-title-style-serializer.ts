/**
 * Pure serialization helper for a chart's own title FORMATTING (`c:title/c:spPr`
 * fill/border, `c:title/c:txPr` font), as opposed to `chart-title-serializer.ts`
 * which owns the title's TEXT and visibility.
 *
 * Split into its own module (rather than grown inside `chart-title-serializer.ts`,
 * which was approaching the repo's 300-line guidance) mirroring how
 * `chart-axis-title-serializer.ts` carries the equivalent axis-title styling
 * function; the two share the same `a:bodyPr`/`a:lstStyle`/`a:p`/`a:pPr`/`a:defRPr`
 * txPr shape by design.
 *
 * @module utils/chart-title-style-serializer
 */
import type { PptxChartShapeProps, XmlObject } from '../types';
import type { ResolveChartColor } from './chart-color-choice';
import { writeChartColorChoice } from './chart-color-choice';
import { writeChartShapeProps } from './chart-shape-props-writer';
import type { ChartTitleOptions } from './chart-title-serializer';

type GetLocalName = (key: string) => string;

function findKey(
	node: XmlObject,
	localName: string,
	getLocalName: GetLocalName,
): string | undefined {
	return Object.keys(node).find((key) => getLocalName(key) === localName);
}

/** Font and shape styling applied to the chart's own title (`c:title`). */
export interface ChartTitleStyle {
	fontFamily?: string;
	fontSize?: number;
	fontBold?: boolean;
	fontColor?: string;
	/** Title text-box fill/border (`c:title/c:spPr`). `null` removes it. */
	spPr?: PptxChartShapeProps | null;
}

/** CT_Title children (2006 model) that follow `c:spPr`/`c:txPr` in schema order. */
const AFTER_SP_PR: Record<'spPr' | 'txPr', readonly string[]> = {
	spPr: ['txPr', 'extLst'],
	txPr: ['extLst'],
};

/**
 * Set `key: value` on `node`. When `key` already names a child (reassignment
 * preserves its existing position), this is a plain write; when it is new,
 * insert it immediately before the first child in `laterNames`, or at the end.
 */
function setChildOrdered(
	node: XmlObject,
	key: string,
	existingKey: string | undefined,
	value: XmlObject,
	laterNames: readonly string[],
	getLocalName: GetLocalName,
): void {
	if (existingKey) {
		node[existingKey] = value;
		return;
	}
	const keys = Object.keys(node);
	const beforeIdx = keys.findIndex((k) => laterNames.includes(getLocalName(k)));
	const entries = keys.map((k) => [k, node[k]] as const);
	entries.splice(beforeIdx === -1 ? entries.length : beforeIdx, 0, [key, value] as const);
	for (const k of keys) {
		delete node[k];
	}
	for (const [k, v] of entries) {
		node[k] = v;
	}
}

function buildTitleDefRPr(
	style: ChartTitleStyle,
	existing: XmlObject,
	resolveColor?: ResolveChartColor,
): XmlObject {
	const rPr: XmlObject = {};
	if (style.fontSize !== undefined) {
		rPr['@_sz'] = String(Math.round(style.fontSize * 100));
	}
	if (style.fontBold !== undefined) {
		rPr['@_b'] = style.fontBold ? '1' : '0';
	}
	if (style.fontColor) {
		rPr['a:solidFill'] = existing['a:solidFill'];
		writeChartColorChoice(rPr, 'a:solidFill', style.fontColor, resolveColor);
	}
	if (style.fontFamily) {
		rPr['a:latin'] = { '@_typeface': style.fontFamily };
	}
	return rPr;
}

function asArray(value: unknown): XmlObject[] {
	if (Array.isArray(value)) {
		return value as XmlObject[];
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
}

/**
 * A typed title is a rich text body (`c:tx/c:rich`), and PowerPoint renders
 * the run properties inside it, not `c:txPr` (which only governs automatic
 * and linked titles). So when a rich body exists, the font edit has to land on
 * every paragraph's `a:pPr/a:defRPr` AND every run's `a:rPr`, otherwise the
 * authored run overrides keep the old face/size.
 *
 * Returns the resolved `tx` key when a rich body was updated, `undefined`
 * when the title has none (the caller then writes `c:txPr`).
 */
function applyRichTitleFont(
	title: XmlObject,
	style: ChartTitleStyle,
	getLocalName: GetLocalName,
	resolveColor?: ResolveChartColor,
): string | undefined {
	const txKey = findKey(title, 'tx', getLocalName);
	const tx = txKey ? (title[txKey] as XmlObject | undefined) : undefined;
	const richKey = tx ? findKey(tx, 'rich', getLocalName) : undefined;
	const rich = richKey && tx ? (tx[richKey] as XmlObject | undefined) : undefined;
	if (!tx || !rich || !txKey || !richKey) {
		return undefined;
	}
	const hasFont =
		style.fontFamily !== undefined ||
		style.fontSize !== undefined ||
		style.fontBold !== undefined ||
		style.fontColor !== undefined;
	if (!hasFont) {
		return txKey;
	}
	const pKey = findKey(rich, 'p', getLocalName) ?? 'a:p';
	const paragraphs = asArray(rich[pKey]).map((para) => {
		const next: XmlObject = { ...para };
		const pPrKey = findKey(next, 'pPr', getLocalName) ?? 'a:pPr';
		const pPr: XmlObject = { ...((next[pPrKey] as XmlObject | undefined) ?? {}) };
		const defRPrKey = findKey(pPr, 'defRPr', getLocalName) ?? 'a:defRPr';
		const existingDefRPr = (pPr[defRPrKey] as XmlObject | undefined) ?? {};
		pPr[defRPrKey] = {
			...existingDefRPr,
			...buildTitleDefRPr(style, existingDefRPr, resolveColor),
		};
		next[pPrKey] = pPr;
		const rKey = findKey(next, 'r', getLocalName);
		if (rKey) {
			const runs = asArray(next[rKey]).map((run) => {
				const rPrKey = findKey(run, 'rPr', getLocalName) ?? 'a:rPr';
				const existingRPr = (run[rPrKey] as XmlObject | undefined) ?? {};
				const nextRun: XmlObject = { ...run };
				nextRun[rPrKey] = { ...existingRPr, ...buildTitleDefRPr(style, existingRPr, resolveColor) };
				return nextRun;
			});
			next[rKey] = Array.isArray(next[rKey]) ? runs : runs[0];
		}
		return next;
	});
	const nextRich: XmlObject = { ...rich };
	nextRich[pKey] = Array.isArray(rich[pKey]) ? paragraphs : paragraphs[0];
	const nextTx: XmlObject = { ...tx };
	nextTx[richKey] = nextRich;
	title[txKey] = nextTx;
	return txKey;
}

/**
 * Apply font styling and/or shape formatting onto the chart's own title,
 * mirroring `applyChartAxisTitleStyleToXml` (chart-axis-title-serializer.ts)
 * for an axis title. Requires a `c:title`/`cx:title` to be present already
 * (set via `applyChartTitleToXml` in chart-title-serializer.ts); no-ops
 * otherwise. Mutates `chartRoot` in place.
 */
export function applyChartTitleStyleToXml(
	chartRoot: XmlObject,
	style: ChartTitleStyle,
	getLocalName: GetLocalName,
	options: ChartTitleOptions = { prefix: 'c' },
	resolveColor?: ResolveChartColor,
): void {
	const hasFont =
		style.fontFamily !== undefined ||
		style.fontSize !== undefined ||
		style.fontBold !== undefined ||
		style.fontColor !== undefined;
	if (!hasFont && style.spPr === undefined) {
		return;
	}
	const { prefix } = options;
	const titleKey = findKey(chartRoot, 'title', getLocalName);
	if (!titleKey) {
		return;
	}
	const title: XmlObject = { ...((chartRoot[titleKey] as XmlObject | undefined) ?? {}) };

	if (style.spPr !== undefined) {
		const spPrKey = findKey(title, 'spPr', getLocalName);
		if (style.spPr === null) {
			if (spPrKey) {
				delete title[spPrKey];
			}
		} else {
			const spPr = writeChartShapeProps(
				spPrKey ? (title[spPrKey] as XmlObject) : undefined,
				style.spPr,
				getLocalName,
				resolveColor,
			);
			setChildOrdered(title, `${prefix}:spPr`, spPrKey, spPr, AFTER_SP_PR.spPr, getLocalName);
		}
	}

	const richKey = applyRichTitleFont(title, style, getLocalName, resolveColor);
	if (hasFont && richKey === undefined) {
		const existingTxPrKey = findKey(title, 'txPr', getLocalName);
		const txPrKey = existingTxPrKey ?? `${prefix}:txPr`;
		const txPr: XmlObject = { ...((title[txPrKey] as XmlObject | undefined) ?? {}) };
		// c:txPr := a:bodyPr, a:lstStyle, a:p (> a:pPr > a:defRPr), same shape as
		// an axis title's txPr (chart-axis-title-serializer.ts).
		if (!txPr[findKey(txPr, 'bodyPr', getLocalName) ?? 'a:bodyPr']) {
			txPr['a:bodyPr'] = {};
		}
		if (!txPr[findKey(txPr, 'lstStyle', getLocalName) ?? 'a:lstStyle']) {
			txPr['a:lstStyle'] = {};
		}
		const pKey = findKey(txPr, 'p', getLocalName) ?? 'a:p';
		const existingP = txPr[pKey];
		const para: XmlObject = {
			...((Array.isArray(existingP) ? existingP[0] : (existingP as XmlObject | undefined)) ?? {}),
		};
		const pPrKey = findKey(para, 'pPr', getLocalName) ?? 'a:pPr';
		const pPr: XmlObject = { ...((para[pPrKey] as XmlObject | undefined) ?? {}) };
		const defRPrKey = findKey(pPr, 'defRPr', getLocalName) ?? 'a:defRPr';
		const existingDefRPr = (pPr[defRPrKey] as XmlObject | undefined) ?? {};
		pPr[defRPrKey] = {
			...existingDefRPr,
			...buildTitleDefRPr(style, existingDefRPr, resolveColor),
		};
		para[pPrKey] = pPr;
		txPr[pKey] = para;
		setChildOrdered(title, txPrKey, existingTxPrKey, txPr, AFTER_SP_PR.txPr, getLocalName);
	}

	chartRoot[titleKey] = title;
}
