import { PptxSlide, XmlObject } from '../../types';
import type {
	ParsedTableBackground,
	ParsedTableStyleFill,
	ParsedTableStyleText,
	PptxExportOptions,
	ParsedTableStyleMap,
} from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeState';
import { parseTableStyleBorders } from './table-style-border-parse';
import {
	deriveTableStyleAccentKey,
	normalizeTableStyleGuid,
	parseTableBackground,
	parseTableStyleList,
} from './table-style-entry-parse';
import { parseTableStyleSectionFill, parseTableStyleSectionText } from './table-style-fill-parse';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Export slides to a raster/vector format. This is a stub that signals
	 * export intent; actual rendering requires a platform-specific canvas or
	 * PDF backend that host applications wire in by overriding this method.
	 */
	async exportSlides(
		slides: PptxSlide[],
		options: PptxExportOptions,
	): Promise<Map<number, Uint8Array>> {
		this.compatibilityService.reportWarning({
			code: 'EXPORT_BACKEND_UNAVAILABLE',
			message:
				`Export to "${options.format}" requires a platform-specific rendering backend. ` +
				'No export backend is configured in this runtime.',
			severity: 'warning',
			scope: 'presentation',
		});

		const targetIndices =
			options.slideIndices && options.slideIndices.length > 0
				? options.slideIndices
				: slides.map((_, index) => index);

		const result = new Map<number, Uint8Array>();
		for (const index of targetIndices) {
			if (!Number.isInteger(index) || index < 0 || index >= slides.length) {
				continue;
			}
			result.set(index, new Uint8Array());
		}
		return result;
	}

	/**
	 * Normalize a table style GUID to uppercase with braces.
	 */
	protected normalizeTableStyleGuid(guid: string): string {
		return normalizeTableStyleGuid(guid);
	}

	/**
	 * Derive the dominant accent key from a set of table style fills.
	 */
	protected deriveTableStyleAccentKey(
		...fills: (ParsedTableStyleFill | undefined)[]
	): string | undefined {
		return deriveTableStyleAccentKey(...fills);
	}

	/**
	 * Extract `<a:tblBg>` children: an inline fill (best-effort scheme-fill
	 * resolution) plus a flag for `<a:effectLst>` so the save path can
	 * round-trip the original effect XML.
	 */
	protected extractTableBackground(
		tblBg: XmlObject | undefined,
	): ParsedTableBackground | undefined {
		return parseTableBackground(tblBg);
	}

	/**
	 * Extract fill information from a table style section element
	 * (e.g. `a:wholeTbl`, `a:band1H`, `a:firstRow`). Handles scheme + sRGB
	 * solids, gradients, preset patterns, and `a:noFill` (issue #95).
	 */
	protected extractTableStyleSectionFill(
		section: XmlObject | undefined,
	): ParsedTableStyleFill | undefined {
		return parseTableStyleSectionFill(section);
	}

	/**
	 * Extract border styling from a table style section's
	 * `a:tcStyle/a:tcBdr` (per-side line width, dash, and colour).
	 */
	protected extractTableStyleSectionBorders(section: XmlObject | undefined) {
		return parseTableStyleBorders(section?.['a:tcStyle'] as XmlObject | undefined);
	}

	/**
	 * Extract text properties from `a:tcTxStyle` in a table style section.
	 * Captures bold/italic/underline, typeface, font-collection index, and the
	 * font colour (scheme or sRGB) (issue #95).
	 */
	protected extractTableStyleSectionText(
		section: XmlObject | undefined,
	): ParsedTableStyleText | undefined {
		return parseTableStyleSectionText(section);
	}

	protected ensureArray(val: unknown): XmlObject[] {
		if (!val) {
			return [];
		}
		const arr = Array.isArray(val) ? val : [val];
		return arr as XmlObject[];
	}

	/**
	 * Parse `ppt/tableStyles.xml` into a map of style GUID → style entry.
	 */
	protected async parseTableStyles(): Promise<ParsedTableStyleMap | undefined> {
		const xmlStr = await this.zip.file('ppt/tableStyles.xml')?.async('string');
		if (!xmlStr) {
			return undefined;
		}

		try {
			const parsed = this.parser.parse(xmlStr) as XmlObject;
			const result = parseTableStyleList(parsed, (value) => this.ensureArray(value));
			if (!result || Object.keys(result.map).length === 0) {
				return undefined;
			}
			return result.map;
		} catch (e) {
			console.warn('Failed to parse ppt/tableStyles.xml:', e);
			return undefined;
		}
	}
}
