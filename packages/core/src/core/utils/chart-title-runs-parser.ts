/**
 * Parse a chart title's rich text (`c:title/c:tx/c:rich`) into per-run typed
 * text + bold/italic/size/color, for `PptxChartData.titleRuns`.
 *
 * The flat `title: string` field (`chart-title-serializer.ts`) only ever
 * captured the FIRST run's text and dropped every per-run formatting
 * attribute, so a two-run title (e.g. a bold word followed by plain text)
 * lost the second run's text entirely and both runs' formatting. Reuses
 * `parseDefRPrTextStyle` (`chart-def-rpr-style.ts`): a run's `a:rPr` is the
 * same `CT_TextCharacterProperties` shape a paragraph's `a:defRPr` is, just
 * scoped to one run instead of the paragraph default.
 *
 * @module utils/chart-title-runs-parser
 */
import type { PptxChartTitleRun, XmlObject } from '../types';
import { parseDefRPrTextStyle } from './chart-def-rpr-style';

interface XmlLookupLike {
	getChildByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject | undefined;
	getChildrenArrayByLocalName: (parent: XmlObject | undefined, name: string) => XmlObject[];
	getScalarChildByLocalName: (parent: XmlObject | undefined, name: string) => string | undefined;
}

interface ColorParserLike {
	parseColor: (fillNode: XmlObject | undefined, placeholderColor?: string) => string | undefined;
}

/**
 * Read one run's text (`a:t`). `a:t` is a plain OOXML text element with no
 * attributes, so fast-xml-parser hands back a bare string/number rather than
 * an object node - `getChildByLocalName` would (correctly, per its own
 * contract) return `undefined` for it, so this needs the scalar accessor.
 */
function readRunText(run: XmlObject, xmlLookup: XmlLookupLike): string {
	return xmlLookup.getScalarChildByLocalName(run, 't') ?? '';
}

/**
 * Parse `titleNode`'s rich text into an ordered list of typed runs.
 *
 * Returns `undefined` when the title has no `c:tx/c:rich` body at all (an
 * empty/auto title, or one authored as a linked-cell reference via
 * `c:tx/c:strRef` instead), or when every paragraph is run-less, so callers
 * can fall back to the flat `title` string the same way they always have.
 */
export function parseChartTitleRuns(
	titleNode: XmlObject | undefined,
	xmlLookup: XmlLookupLike,
	colorParser: ColorParserLike,
): PptxChartTitleRun[] | undefined {
	const rich = xmlLookup.getChildByLocalName(
		xmlLookup.getChildByLocalName(titleNode, 'tx'),
		'rich',
	);
	if (!rich) {
		return undefined;
	}

	const runs: PptxChartTitleRun[] = [];
	for (const paragraph of xmlLookup.getChildrenArrayByLocalName(rich, 'p')) {
		for (const run of xmlLookup.getChildrenArrayByLocalName(paragraph, 'r')) {
			const text = readRunText(run, xmlLookup);
			const rPr = xmlLookup.getChildByLocalName(run, 'rPr');
			const style = parseDefRPrTextStyle(rPr, xmlLookup, colorParser);
			runs.push({
				text,
				...(style?.bold !== undefined ? { bold: style.bold } : {}),
				...(style?.italic !== undefined ? { italic: style.italic } : {}),
				...(style?.fontSize !== undefined ? { fontSize: style.fontSize } : {}),
				...(style?.color !== undefined ? { color: style.color } : {}),
			});
		}
	}

	return runs.length > 0 ? runs : undefined;
}
