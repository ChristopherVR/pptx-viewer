import { SvgExporter } from '../../../converter/SvgExporter';
import { PptxSlide, XmlObject } from '../../types';
import type {
	ParsedTableBackground,
	ParsedTableStyleFill,
	ParsedTableStyleText,
	PptxExportOptions,
	ParsedTableStyleMap,
} from '../../types';
import { xmlChild } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeState';
import { parseTableStyleBorders } from './table-style-border-parse';
import {
	deriveTableStyleAccentKey,
	normalizeTableStyleGuid,
	parseTableBackground,
	parseTableStyleList,
} from './table-style-entry-parse';
import type { ResolveTableStyleImagePath } from './table-style-fill-parse';
import { parseTableStyleSectionFill, parseTableStyleSectionText } from './table-style-fill-parse';

const TABLE_STYLES_PART_PATH = 'ppt/tableStyles.xml';
const TABLE_STYLES_RELS_PATH = 'ppt/_rels/tableStyles.xml.rels';

/** 16:9 at 96dpi, the size a `PptxHandler` with no loaded deck falls back to. */
const DEFAULT_EXPORT_WIDTH_PX = 960;
const DEFAULT_EXPORT_HEIGHT_PX = 540;

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Export slides to a vector or raster format, keyed by slide index.
	 *
	 * ## `svg` is real; `png` and `pdf` throw
	 *
	 * This used to return a map of EMPTY `Uint8Array`s for every format and log
	 * an `EXPORT_BACKEND_UNAVAILABLE` warning. That is the worst of the
	 * available behaviours: a caller that does not read the compatibility log
	 * gets a `Map` of the right size, keyed correctly, whose values write to
	 * zero-byte files. Nothing about the return value says "this failed", so
	 * the failure surfaces later, as a corrupt artifact, somewhere else.
	 *
	 * `svg` needs no backend at all: {@link SvgExporter} is a headless string
	 * builder that already renders all 16 element types, so that format is now
	 * genuinely implemented here. `png` and `pdf` need a rasteriser this package
	 * deliberately does not carry (core must run in Node, Bun, Deno and
	 * Workers), so they throw an error that names the two real routes instead of
	 * pretending to succeed. The compatibility warning is still reported first,
	 * so a host inspecting the report sees the same signal it always did.
	 *
	 * Hosts with a rendering backend override this method, and an override
	 * replaces this body entirely, so they are unaffected by the throw.
	 *
	 * @throws {Error} when `options.format` is `png` or `pdf`.
	 */
	async exportSlides(
		slides: PptxSlide[],
		options: PptxExportOptions,
	): Promise<Map<number, Uint8Array>> {
		const targetIndices = this.resolveExportIndices(slides, options);

		if (options.format !== 'svg') {
			this.compatibilityService.reportWarning({
				code: 'EXPORT_BACKEND_UNAVAILABLE',
				message:
					`Export to "${options.format}" requires a platform-specific rendering backend. ` +
					'No export backend is configured in this runtime.',
				severity: 'warning',
				scope: 'presentation',
			});
			throw new Error(
				`exportSlides: "${options.format}" needs a rendering backend that pptx-viewer-core ` +
					'does not ship. Use format "svg" for headless output, a viewer binding\'s browser ' +
					'export pipeline for PNG/PDF, or override exportSlides with your own backend.',
			);
		}

		const { width, height } = this.resolveExportViewport(options);
		const encoder = new TextEncoder();
		const result = new Map<number, Uint8Array>();
		for (const index of targetIndices) {
			const slide = slides[index];
			if (slide.hidden && !options.includeHidden) {
				continue;
			}
			result.set(index, encoder.encode(SvgExporter.exportSlide(slide, width, height)));
		}
		return result;
	}

	/**
	 * The SVG viewport for an export: the loaded deck's slide size in CSS px,
	 * rescaled to `options.width` when the caller asked for one.
	 *
	 * `options.width` is documented as PNG-only, but honouring it for SVG costs
	 * nothing and keeps the two formats interchangeable for a caller that just
	 * wants "a slide this many pixels wide". The aspect ratio always comes from
	 * the deck, never from the caller, so a width alone cannot distort a slide.
	 */
	private resolveExportViewport(options: PptxExportOptions): { width: number; height: number } {
		const baseWidth = this.rawSlideWidthEmu / PptxHandlerRuntime.EMU_PER_PX;
		const baseHeight = this.rawSlideHeightEmu / PptxHandlerRuntime.EMU_PER_PX;
		// A handler that has not loaded a deck has no slide size. Falling back to
		// 16:9 keeps the output openable rather than emitting a 0x0 viewBox.
		const width = baseWidth > 0 ? baseWidth : DEFAULT_EXPORT_WIDTH_PX;
		const height = baseHeight > 0 ? baseHeight : DEFAULT_EXPORT_HEIGHT_PX;
		if (!options.width || options.width <= 0) {
			return { width, height };
		}
		return { width: options.width, height: (height * options.width) / width };
	}

	/**
	 * The slide indices an export request actually covers: the requested ones
	 * with out-of-range entries dropped, or every slide when none were named.
	 */
	private resolveExportIndices(slides: PptxSlide[], options: PptxExportOptions): number[] {
		const requested =
			options.slideIndices && options.slideIndices.length > 0
				? options.slideIndices
				: slides.map((_, index) => index);
		return requested.filter(
			(index) => Number.isInteger(index) && index >= 0 && index < slides.length,
		);
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
		const xmlStr = await this.zip.file(TABLE_STYLES_PART_PATH)?.async('string');
		if (!xmlStr) {
			return undefined;
		}

		try {
			const parsed = this.parser.parse(xmlStr) as XmlObject;
			const resolveImagePath = await this.buildTableStylesImageResolver();
			const result = parseTableStyleList(
				parsed,
				(value) => this.ensureArray(value),
				resolveImagePath,
			);
			if (!result || Object.keys(result.map).length === 0) {
				return undefined;
			}
			return result.map;
		} catch (e) {
			console.warn('Failed to parse ppt/tableStyles.xml:', e);
			return undefined;
		}
	}

	/**
	 * Build a `r:embed`/`r:link` -> archive-path resolver for a whole-table-
	 * style `a:blipFill` (issue: table STYLE image texture fills silently
	 * dropped the image). `ppt/tableStyles.xml` is a presentation-level part
	 * with no slide/rels context of its own, so its relationships are read
	 * from `ppt/_rels/tableStyles.xml.rels` here, once, the same way
	 * `presentation.xml`'s own rels are read elsewhere in this runtime.
	 */
	private async buildTableStylesImageResolver(): Promise<ResolveTableStyleImagePath | undefined> {
		const relsXml = await this.zip.file(TABLE_STYLES_RELS_PATH)?.async('string');
		if (!relsXml) {
			return undefined;
		}
		let relsMap: Map<string, string>;
		try {
			const relsData = this.parser.parse(relsXml) as XmlObject;
			const rels = this.ensureArray(
				xmlChild(relsData, 'Relationships')?.Relationship,
			) as XmlObject[];
			relsMap = new Map();
			for (const rel of rels) {
				const id = String(rel?.['@_Id'] || '');
				const target = String(rel?.['@_Target'] || '');
				if (!id || !target) {
					continue;
				}
				// An external/data target is used verbatim; only an archive-relative
				// target is resolved against `ppt/` (`tableStyles.xml`'s own directory).
				const isExternalOrData =
					target.startsWith('http://') ||
					target.startsWith('https://') ||
					target.startsWith('data:');
				relsMap.set(
					id,
					isExternalOrData
						? target
						: target.startsWith('/')
							? target.substring(1)
							: `ppt/${target}`,
				);
			}
		} catch (e) {
			console.warn('Failed to parse ppt/_rels/tableStyles.xml.rels:', e);
			return undefined;
		}
		if (relsMap.size === 0) {
			return undefined;
		}
		return (rEmbed, rLink) => {
			const relId = rEmbed || rLink;
			if (!relId) {
				return undefined;
			}
			const target = relsMap.get(relId);
			if (!target) {
				return undefined;
			}
			if (target.startsWith('http://') || target.startsWith('https://')) {
				return this.allowExternalImages === true ? target : undefined;
			}
			// A `data:` target or an archive-relative path are both already what
			// `ParsedTableStyleImage.path` expects: the former is displayable as-is,
			// the latter is resolved to a displayable URL by a load pipeline.
			return target;
		};
	}
}
