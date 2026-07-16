/**
 * @fileoverview Chart color style parsing for Office 2013+ chart parts.
 *
 * This mixin adds methods for reading and resolving the
 * `chartColorStyle*.xml` part that defines the ordered color palette
 * and cycling method for modern charts.
 *
 * Mixin chain position:
 *   `PptxHandlerRuntimeChartExternalData` → **this** → `PptxHandlerRuntimeChartParsing`
 */

import { XmlObject } from '../../types';
import type { PptxChartData } from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeChartExternalData';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Parse the Office 2013+ chart color style part (`chartColorStyle*.xml`)
	 * referenced from the chart's relationships.
	 *
	 * The color style XML contains `<cs:colorStyle meth="cycle" id="10">` with
	 * child `<a:schemeClr val="accent1"/>` elements that define the ordered
	 * color palette.
	 *
	 * Returns `{ palette, method }` where `palette` is an array of resolved hex
	 * colors, or `undefined` when no color style is found.
	 */
	protected async parseChartColorStyle(chartPartPath: string): Promise<
		| {
				palette: string[];
				method: PptxChartData['colorMethod'];
				partPath: string;
		  }
		| undefined
	> {
		try {
			const rels = await this.readChartRels(chartPartPath);

			// Find the chartColorStyle relationship
			// Type URIs seen in the wild:
			//   http://schemas.microsoft.com/office/2014/relationships/chartColorStyle
			//   http://schemas.microsoft.com/office/2011/relationships/chartColorStyle
			const colorStyleRel = rels.find(
				(r) => r.type.includes('chartColorStyle') || r.type.includes('chartColor'),
			);
			if (!colorStyleRel) {
				return undefined;
			}

			// Resolve the color style XML path relative to the chart part
			const colorStylePath = this.resolveImagePath(chartPartPath, colorStyleRel.target);
			const colorStyleXml = await this.zip.file(colorStylePath)?.async('string');
			if (!colorStyleXml) {
				return undefined;
			}

			const parsed = this.parser.parse(colorStyleXml) as XmlObject;

			// The root element is <cs:colorStyle> (may appear with or without
			// namespace prefix)
			const colorStyle = this.xmlLookupService.getChildByLocalName(parsed, 'colorStyle') ?? parsed;

			// Read the method attribute: "cycle" | "withinLinear" | "acrossLinear"
			const methodStr = String(
				colorStyle['@_meth'] || 'cycle',
			).trim() as PptxChartData['colorMethod'];
			const method: PptxChartData['colorMethod'] =
				methodStr === 'withinLinear' || methodStr === 'acrossLinear' ? methodStr : 'cycle';

			// Collect all scheme color and explicit color children
			const palette: string[] = [];
			this.collectColorStylePalette(colorStyle, palette);

			if (palette.length === 0) {
				return undefined;
			}

			return { palette, method, partPath: colorStylePath };
		} catch {
			return undefined;
		}
	}

	/**
	 * Traverse a `<cs:colorStyle>` element and extract ordered palette colors.
	 *
	 * Child elements can be:
	 * - `<a:schemeClr val="accent1"/>` — resolved via theme color map
	 * - `<a:srgbClr val="4472C4"/>` — explicit RGB
	 */
	private collectColorStylePalette(node: XmlObject | undefined, output: string[]): void {
		if (!node) {
			return;
		}

		for (const [key, value] of Object.entries(node)) {
			if (key.startsWith('@_')) {
				continue;
			}
			const localName = this.compatibilityService.getXmlLocalName(key);

			if (localName === 'schemeClr') {
				const items = Array.isArray(value) ? value : [value];
				for (const item of items) {
					const resolved = this.resolveChartSchemeColor(item);
					if (resolved) {
						output.push(resolved);
					}
				}
			} else if (localName === 'srgbClr') {
				const items = Array.isArray(value) ? value : [value];
				for (const item of items) {
					const hex = String(
						typeof item === 'object' && item !== null ? (item as XmlObject)['@_val'] : (item ?? ''),
					).trim();
					if (hex.length > 0) {
						output.push(hex.startsWith('#') ? hex : `#${hex}`);
					}
				}
			}
		}
	}

	/**
	 * Resolve a scheme color reference (`<a:schemeClr val="accent1"/>`) to a
	 * concrete hex color using the presentation theme color map.
	 */
	private resolveChartSchemeColor(schemeClrNode: unknown): string | undefined {
		if (!schemeClrNode) {
			return undefined;
		}

		let val: string;
		if (typeof schemeClrNode === 'string') {
			val = schemeClrNode;
		} else if (typeof schemeClrNode === 'object' && schemeClrNode !== null) {
			val = String((schemeClrNode as XmlObject)['@_val'] || '').trim();
		} else {
			return undefined;
		}

		if (val.length === 0) {
			return undefined;
		}

		// Look up in theme color map (same mechanism as SmartArt color resolution)
		const mapped = this.themeColorMap[val];
		if (mapped) {
			return mapped.startsWith('#') ? mapped : `#${mapped}`;
		}

		return undefined;
	}
}
