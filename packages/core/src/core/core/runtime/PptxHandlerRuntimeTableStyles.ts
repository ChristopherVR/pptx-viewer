import { PptxSlide, XmlObject } from '../../types';
import type {
	ParsedTableBackground,
	ParsedTableStyleBorders,
	ParsedTableStyleFill,
	ParsedTableStyleText,
	PptxExportOptions,
	ParsedTableStyleEntry,
	ParsedTableStyleMap,
} from '../../types';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeState';
import { parseTableStyleBorders } from './table-style-border-parse';
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
		const trimmed = guid.trim().toUpperCase();
		if (trimmed.startsWith('{')) {
			return trimmed;
		}
		return `{${trimmed}}`;
	}

	/**
	 * Derive the dominant accent key from a set of table style fills.
	 */
	protected deriveTableStyleAccentKey(
		...fills: (ParsedTableStyleFill | undefined)[]
	): string | undefined {
		for (const fill of fills) {
			if (fill?.schemeColor?.startsWith('accent')) {
				return fill.schemeColor;
			}
		}
		return undefined;
	}

	/**
	 * Extract `<a:tblBg>` children: an inline fill (best-effort scheme-fill
	 * resolution) plus a flag for `<a:effectLst>` so the save path can
	 * round-trip the original effect XML.
	 */
	protected extractTableBackground(
		tblBg: XmlObject | undefined,
	): ParsedTableBackground | undefined {
		if (!tblBg) {
			return undefined;
		}
		const fillNode = tblBg['a:fill'] as XmlObject | undefined;
		const solidFill = (fillNode?.['a:solidFill'] ?? tblBg['a:solidFill']) as XmlObject | undefined;
		const schemeClr = solidFill?.['a:schemeClr'] as XmlObject | undefined;
		const schemeColor = schemeClr
			? String(schemeClr['@_val'] || '').trim() || undefined
			: undefined;
		const fill = schemeColor ? { schemeColor } : undefined;
		const hasEffectLst = Boolean(tblBg['a:effectLst']);
		if (!fill && !hasEffectLst) {
			return undefined;
		}
		return {
			...(fill ? { fill } : {}),
			...(hasEffectLst ? { hasEffectLst } : {}),
		};
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
			const styleLst = parsed['a:tblStyleLst'] as XmlObject | undefined;
			if (!styleLst) {
				return undefined;
			}

			const styles = this.ensureArray(styleLst['a:tblStyle']);
			if (styles.length === 0) {
				return undefined;
			}

			const map: Record<string, ParsedTableStyleEntry> = {};
			for (const style of styles) {
				const rawId = String((style as XmlObject)['@_styleId'] || '').trim();
				if (!rawId) {
					continue;
				}

				const styleId = this.normalizeTableStyleGuid(rawId);
				const styleName = String((style as XmlObject)['@_styleName'] || '').trim() || undefined;

				const wholeTblFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:wholeTbl'] as XmlObject | undefined,
				);
				const band1HFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:band1H'] as XmlObject | undefined,
				);
				const band2HFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:band2H'] as XmlObject | undefined,
				);
				const band1VFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:band1V'] as XmlObject | undefined,
				);
				const band2VFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:band2V'] as XmlObject | undefined,
				);
				const firstRowFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:firstRow'] as XmlObject | undefined,
				);
				const lastRowFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:lastRow'] as XmlObject | undefined,
				);
				const firstColFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:firstCol'] as XmlObject | undefined,
				);
				const lastColFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:lastCol'] as XmlObject | undefined,
				);
				// Corner cells (CT_TableStyle §21.1.3.16): each corner overrides
				// the intersection of firstRow/lastRow × firstCol/lastCol.
				const seCellFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:seCell'] as XmlObject | undefined,
				);
				const swCellFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:swCell'] as XmlObject | undefined,
				);
				const neCellFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:neCell'] as XmlObject | undefined,
				);
				const nwCellFill = this.extractTableStyleSectionFill(
					(style as XmlObject)['a:nwCell'] as XmlObject | undefined,
				);

				const tableBackground = this.extractTableBackground(
					(style as XmlObject)['a:tblBg'] as XmlObject | undefined,
				);

				const accentKey = this.deriveTableStyleAccentKey(
					wholeTblFill,
					band1HFill,
					band1VFill,
					firstRowFill,
				);

				// Extract per-role text styling (a:tcTxStyle)
				const sectionNames = [
					'wholeTbl',
					'firstRow',
					'lastRow',
					'firstCol',
					'lastCol',
					'band1H',
					'band2H',
					'band1V',
					'band2V',
					'seCell',
					'swCell',
					'neCell',
					'nwCell',
				] as const;
				const textProps: Partial<
					Record<`${(typeof sectionNames)[number]}Text`, ParsedTableStyleText>
				> = {};
				for (const name of sectionNames) {
					const text = this.extractTableStyleSectionText(
						(style as XmlObject)[`a:${name}`] as XmlObject | undefined,
					);
					if (text) {
						textProps[`${name}Text`] = text;
					}
				}

				// Extract per-role border styling (a:tcStyle/a:tcBdr)
				const borderProps: Partial<
					Record<`${(typeof sectionNames)[number]}Borders`, ParsedTableStyleBorders>
				> = {};
				for (const name of sectionNames) {
					const borders = this.extractTableStyleSectionBorders(
						(style as XmlObject)[`a:${name}`] as XmlObject | undefined,
					);
					if (borders) {
						borderProps[`${name}Borders`] = borders;
					}
				}

				const entry: ParsedTableStyleEntry = {
					styleId,
					styleName,
					accentKey,
					...(tableBackground ? { tableBackground } : {}),
					wholeTblFill,
					band1HFill,
					band2HFill,
					band1VFill,
					band2VFill,
					firstRowFill,
					lastRowFill,
					firstColFill,
					lastColFill,
					...(seCellFill ? { seCellFill } : {}),
					...(swCellFill ? { swCellFill } : {}),
					...(neCellFill ? { neCellFill } : {}),
					...(nwCellFill ? { nwCellFill } : {}),
					...textProps,
					...borderProps,
				};
				map[styleId] = entry;
			}

			return Object.keys(map).length > 0 ? map : undefined;
		} catch (e) {
			console.warn('Failed to parse ppt/tableStyles.xml:', e);
			return undefined;
		}
	}
}
