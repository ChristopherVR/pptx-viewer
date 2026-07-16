/**
 * Headless SVG exporter — converts parsed {@link PptxSlide} data to
 * SVG XML strings without requiring a browser DOM.
 *
 * All output is generated via string concatenation so the exporter
 * works in any JavaScript runtime (Node, Bun, Deno, Workers, etc.).
 *
 * @module converter/SvgExporter
 */

import type { PptxElement } from '../core/types/elements';
import type { PptxSlide, PptxData } from '../core/types/presentation';
import { buildImageEffectsFilter } from './svg-image-effects';
import {
	renderChartSvg,
	renderContentPartSvg,
	renderMediaPreviewSvg,
	renderModel3DPreviewSvg,
	renderOlePreviewSvg,
	renderSmartArtSvg,
	renderZoomPreviewSvg,
} from './svg-rich-elements';

// ────────────────────────────────────────────────────────────────────
// Public options
// ────────────────────────────────────────────────────────────────────

/**
 * Options controlling SVG export behaviour.
 */
export interface SvgExportOptions {
	/** Include hidden slides when exporting all. Default `false`. */
	includeHidden?: boolean;
	/** Slide indices to export (0-based). If omitted, all slides are exported. */
	slideIndices?: number[];
	/** Default font family when the element does not specify one. */
	defaultFontFamily?: string;
	/** Default font size in points when the element does not specify one. */
	defaultFontSize?: number;
}

// ────────────────────────────────────────────────────────────────────
// XML helpers
// ────────────────────────────────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** Escape the five XML-reserved characters. */
function escXml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Build an XML attribute string from a record. Values are escaped. */
function attrs(map: Record<string, string | number | undefined>): string {
	let out = '';
	for (const [k, v] of Object.entries(map)) {
		if (v !== undefined && v !== '') {
			out += ` ${k}="${escXml(String(v))}"`;
		}
	}
	return out;
}

// ────────────────────────────────────────────────────────────────────
// Resolved defaults
// ────────────────────────────────────────────────────────────────────

function resolveDefaults(opts?: SvgExportOptions) {
	return {
		defaultFontFamily: opts?.defaultFontFamily ?? 'Arial',
		defaultFontSize: opts?.defaultFontSize ?? 18,
	};
}

// ────────────────────────────────────────────────────────────────────
// Per-export render context (markers, defs, counters)
// ────────────────────────────────────────────────────────────────────

interface RenderContext {
	defs: string[];
	/** color → markerId, so duplicate-colored arrows reuse one <marker> def. */
	markerCache: Map<string, string>;
	markerIdCounter: number;
	/** Slide index used to namespace generated filter ids across slides. */
	slideIndex: number;
	/** Counter for image-effects filter ids within a slide. */
	filterCounter: number;
}

function createRenderContext(slideIndex = 0): RenderContext {
	return {
		defs: [],
		markerCache: new Map(),
		markerIdCounter: 0,
		slideIndex,
		filterCounter: 0,
	};
}

/**
 * Get or create an arrow marker for `color`. Markers are memoized in the
 * render context so that decks with hundreds of identically-colored
 * connectors only emit one `<marker>` def per color.
 */
function getOrCreateArrowMarker(ctx: RenderContext, color: string): string {
	const key = color;
	const cached = ctx.markerCache.get(key);
	if (cached) {
		return cached;
	}
	const id = `arrow_${++ctx.markerIdCounter}`;
	const svg =
		`<marker id="${id}" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">` +
		`<polygon points="0 0, 10 3.5, 0 7" fill="${escXml(color)}" />` +
		`</marker>`;
	ctx.defs.push(svg);
	ctx.markerCache.set(key, id);
	return id;
}

// ────────────────────────────────────────────────────────────────────
// Element renderers
// ────────────────────────────────────────────────────────────────────

function renderTransform(el: PptxElement): string {
	const parts: string[] = [];
	parts.push(`translate(${el.x},${el.y})`);
	if (el.rotation) {
		parts.push(`rotate(${el.rotation},${el.width / 2},${el.height / 2})`);
	}
	const flipX = 'flipHorizontal' in el && el.flipHorizontal;
	const flipY = 'flipVertical' in el && el.flipVertical;
	if (flipX || flipY) {
		parts.push(`translate(${flipX ? el.width : 0},${flipY ? el.height : 0})`);
		parts.push(`scale(${flipX ? -1 : 1},${flipY ? -1 : 1})`);
	}
	return parts.join(' ');
}

function renderText(el: PptxElement, defaults: ReturnType<typeof resolveDefaults>): string {
	if (el.type !== 'text' && el.type !== 'shape' && el.type !== 'connector') {
		return '';
	}
	const text = el.text;
	if (!text) {
		return '';
	}

	const segments = el.textSegments;
	const style = el.textStyle;
	const fontFamily = style?.fontFamily ?? defaults.defaultFontFamily;
	const fontSize = style?.fontSize ?? defaults.defaultFontSize;
	const color = style?.color ?? '#000000';
	const align = style?.align ?? 'left';

	// Determine x anchor based on alignment
	let textAnchor = 'start';
	let textX = 4; // small padding
	if (align === 'center') {
		textAnchor = 'middle';
		textX = el.width / 2;
	} else if (align === 'right') {
		textAnchor = 'end';
		textX = el.width - 4;
	}

	if (segments && segments.length > 0) {
		// Render rich text with tspan per segment
		const parts: string[] = [];
		parts.push(
			`<text${attrs({
				x: textX,
				'text-anchor': textAnchor,
				'font-family': fontFamily,
				'font-size': fontSize,
				fill: color,
			})}>`,
		);

		let dy = fontSize * 1.2; // initial line offset
		let isFirstSegment = true;

		for (const seg of segments) {
			if (seg.isParagraphBreak) {
				dy = fontSize * 1.2;
				isFirstSegment = true;
				continue;
			}
			if (!seg.text) {
				continue;
			}

			const segStyle = seg.style;
			const segAttrs: Record<string, string | number | undefined> = {};

			if (isFirstSegment) {
				segAttrs.x = textX;
				segAttrs.dy = dy;
				isFirstSegment = false;
			}

			if (segStyle.fontFamily && segStyle.fontFamily !== fontFamily) {
				segAttrs['font-family'] = segStyle.fontFamily;
			}
			if (segStyle.fontSize && segStyle.fontSize !== fontSize) {
				segAttrs['font-size'] = segStyle.fontSize;
			}
			if (segStyle.color && segStyle.color !== color) {
				segAttrs.fill = segStyle.color;
			}
			if (segStyle.bold) {
				segAttrs['font-weight'] = 'bold';
			}
			if (segStyle.italic) {
				segAttrs['font-style'] = 'italic';
			}
			if (segStyle.underline) {
				segAttrs['text-decoration'] = 'underline';
			}

			parts.push(`<tspan${attrs(segAttrs)}>${escXml(seg.text)}</tspan>`);
		}

		parts.push(`</text>`);
		return parts.join('');
	}

	// Simple text (no segments)
	const bold = style?.bold;
	const italic = style?.italic;
	const lines = text.split('\n');

	const parts: string[] = [];
	parts.push(
		`<text${attrs({
			x: textX,
			'text-anchor': textAnchor,
			'font-family': fontFamily,
			'font-size': fontSize,
			fill: color,
			'font-weight': bold ? 'bold' : undefined,
			'font-style': italic ? 'italic' : undefined,
		})}>`,
	);

	for (let i = 0; i < lines.length; i++) {
		parts.push(
			`<tspan${attrs({
				x: textX,
				dy: i === 0 ? fontSize * 1.2 : fontSize * 1.2,
			})}>${escXml(lines[i])}</tspan>`,
		);
	}

	parts.push(`</text>`);
	return parts.join('');
}

function renderShapeBody(el: PptxElement): string {
	if (el.type !== 'shape' && el.type !== 'text') {
		return '';
	}

	const shapeStyle = 'shapeStyle' in el ? el.shapeStyle : undefined;
	const shapeType = 'shapeType' in el ? el.shapeType : undefined;
	const fillColor = shapeStyle?.fillColor ?? 'none';
	const strokeColor = shapeStyle?.strokeColor ?? 'none';
	const strokeWidth = shapeStyle?.strokeWidth ?? (strokeColor !== 'none' ? 1 : 0);
	const fillMode = shapeStyle?.fillMode;

	// Determine fill value
	let fill = fillColor;
	if (fillMode === 'none') {
		fill = 'none';
	} else if (fillMode === 'gradient' && shapeStyle?.fillGradient) {
		// Fallback to first gradient stop or the gradient CSS (best effort)
		fill = shapeStyle.fillGradientStops?.[0]?.color ?? fillColor;
	}

	const fillOpacity = shapeStyle?.fillOpacity;
	const strokeOpacity = shapeStyle?.strokeOpacity;

	const commonAttrs: Record<string, string | number | undefined> = {
		fill,
		stroke: strokeColor,
		'stroke-width': strokeWidth || undefined,
		'fill-opacity': fillOpacity !== undefined ? fillOpacity : undefined,
		'stroke-opacity': strokeOpacity !== undefined ? strokeOpacity : undefined,
	};

	// Check for custom path data
	const pathData = 'pathData' in el ? (el as { pathData?: string }).pathData : undefined;
	if (pathData) {
		return `<path${attrs({ ...commonAttrs, d: pathData })} />`;
	}

	switch (shapeType) {
		case 'ellipse':
		case 'oval':
			return `<ellipse${attrs({
				...commonAttrs,
				cx: el.width / 2,
				cy: el.height / 2,
				rx: el.width / 2,
				ry: el.height / 2,
			})} />`;

		case 'triangle':
		case 'isoTriangle':
			return `<polygon${attrs({
				...commonAttrs,
				points: `${el.width / 2},0 ${el.width},${el.height} 0,${el.height}`,
			})} />`;

		case 'diamond':
			return `<polygon${attrs({
				...commonAttrs,
				points: `${el.width / 2},0 ${el.width},${el.height / 2} ${el.width / 2},${el.height} 0,${el.height / 2}`,
			})} />`;

		default:
			// Default to rect (covers rect, roundRect, and any other shapes)
			return `<rect${attrs({
				...commonAttrs,
				width: el.width,
				height: el.height,
				rx: shapeType === 'roundRect' ? Math.min(el.width, el.height) * 0.1 : undefined,
			})} />`;
	}
}

function renderImageElement(el: PptxElement, ctx: RenderContext): string {
	if (el.type !== 'image' && el.type !== 'picture') {
		return '';
	}

	const imageData = el.imageData;
	if (!imageData) {
		// No image data — render placeholder
		return (
			`<rect${attrs({ width: el.width, height: el.height, fill: '#E0E0E0', stroke: '#999', 'stroke-width': 1 })} />` +
			`<text${attrs({ x: el.width / 2, y: el.height / 2, 'text-anchor': 'middle', 'font-size': 12, fill: '#666' })}>image</text>`
		);
	}

	// Translate any blip-side image effects into an SVG <filter> so the
	// renderer matches what's parsed in PptxImageEffects (alpha primitives,
	// duotone, hsl/lum, brightness/contrast, blur, etc.).
	const filter = el.imageEffects
		? buildImageEffectsFilter(el.imageEffects, registerFilter(ctx, el))
		: null;
	const filterAttr = filter ? ` filter="url(#${filter.filterId})"` : '';
	if (filter) {
		ctx.defs.push(filter.defsXml);
	}

	return `<image${attrs({
		width: el.width,
		height: el.height,
		preserveAspectRatio: 'none',
	})} href="${escXml(imageData)}"${filterAttr} />`;
}

function registerFilter(ctx: RenderContext, el: PptxElement): string {
	// Stable id derived from the slide-local element index so filters dedupe
	// across re-renders without colliding across slides.
	const i = ctx.filterCounter++;
	void el;
	return `${ctx.slideIndex}-${i}`;
}

function renderConnector(el: PptxElement, ctx: RenderContext): string {
	if (el.type !== 'connector') {
		return '';
	}

	const shapeStyle = el.shapeStyle;
	const strokeColor = shapeStyle?.strokeColor ?? '#000000';
	const strokeWidth = shapeStyle?.strokeWidth ?? 1;

	let markerStart: string | undefined;
	let markerEnd: string | undefined;

	if (shapeStyle?.connectorStartArrow && shapeStyle.connectorStartArrow !== 'none') {
		const id = getOrCreateArrowMarker(ctx, strokeColor);
		markerStart = `url(#${id})`;
	}
	if (shapeStyle?.connectorEndArrow && shapeStyle.connectorEndArrow !== 'none') {
		const id = getOrCreateArrowMarker(ctx, strokeColor);
		markerEnd = `url(#${id})`;
	}

	return `<line${attrs({
		x1: 0,
		y1: 0,
		x2: el.width,
		y2: el.height,
		stroke: strokeColor,
		'stroke-width': strokeWidth,
		'marker-start': markerStart,
		'marker-end': markerEnd,
	})} />`;
}

function renderTable(el: PptxElement, defaults: ReturnType<typeof resolveDefaults>): string {
	if (el.type !== 'table') {
		return '';
	}

	const tableData = el.tableData;
	if (!tableData || !tableData.rows.length) {
		return `<rect${attrs({ width: el.width, height: el.height, fill: '#F0F0F0', stroke: '#CCC', 'stroke-width': 1 })} />`;
	}

	const cols = tableData.columnWidths;
	const numRows = tableData.rows.length;
	const rowHeight = el.height / numRows;

	const parts: string[] = [];
	let yOffset = 0;

	for (const row of tableData.rows) {
		const h = row.height ?? rowHeight;
		let xOffset = 0;

		for (let ci = 0; ci < row.cells.length; ci++) {
			const cell = row.cells[ci];
			if (cell.vMerge || cell.hMerge) {
				xOffset += (cols[ci] ?? 0) * el.width;
				continue;
			}

			const cellWidth = (cols[ci] ?? 1 / row.cells.length) * el.width * (cell.gridSpan ?? 1);
			const bgColor = cell.style?.backgroundColor ?? 'none';
			const borderColor = cell.style?.borderColor ?? '#CCCCCC';
			const textColor = cell.style?.color ?? '#000000';
			const fontSize = cell.style?.fontSize ?? defaults.defaultFontSize;
			const bold = cell.style?.bold;

			parts.push(
				`<rect${attrs({
					x: xOffset,
					y: yOffset,
					width: cellWidth,
					height: h,
					fill: bgColor,
					stroke: borderColor,
					'stroke-width': 0.5,
				})} />`,
			);

			if (cell.text) {
				parts.push(
					`<text${attrs({
						x: xOffset + 4,
						y: yOffset + h / 2,
						'dominant-baseline': 'central',
						'font-family': defaults.defaultFontFamily,
						'font-size': fontSize,
						fill: textColor,
						'font-weight': bold ? 'bold' : undefined,
					})}>${escXml(cell.text)}</text>`,
				);
			}

			xOffset += cellWidth;
		}

		yOffset += h;
	}

	return parts.join('');
}

function renderGroup(
	el: PptxElement,
	defaults: ReturnType<typeof resolveDefaults>,
	ctx: RenderContext,
): string {
	if (el.type !== 'group') {
		return '';
	}

	const parts: string[] = [];
	for (const child of el.children) {
		parts.push(renderElement(child, defaults, ctx));
	}
	return parts.join('');
}

function renderInk(el: PptxElement): string {
	if (el.type !== 'ink') {
		return '';
	}

	const parts: string[] = [];
	for (let i = 0; i < el.inkPaths.length; i++) {
		const path = el.inkPaths[i];
		const color = el.inkColors?.[i] ?? '#000000';
		const width = el.inkWidths?.[i] ?? 1;
		const opacity = el.inkOpacities?.[i];
		parts.push(
			`<path${attrs({
				d: path,
				fill: 'none',
				stroke: color,
				'stroke-width': width,
				'stroke-opacity': opacity,
				'stroke-linecap': 'round',
			})} />`,
		);
	}
	return parts.join('');
}

function renderPlaceholder(el: PptxElement): string {
	return (
		`<rect${attrs({
			width: el.width,
			height: el.height,
			fill: '#F5F5F5',
			stroke: '#CCCCCC',
			'stroke-width': 1,
			'stroke-dasharray': '4 2',
		})} />` +
		`<text${attrs({
			x: el.width / 2,
			y: el.height / 2,
			'text-anchor': 'middle',
			'dominant-baseline': 'central',
			'font-family': 'Arial',
			'font-size': 11,
			fill: '#999999',
		})}>${escXml(el.type)}</text>`
	);
}

// ────────────────────────────────────────────────────────────────────
// Core element dispatcher
// ────────────────────────────────────────────────────────────────────

function renderElement(
	el: PptxElement,
	defaults: ReturnType<typeof resolveDefaults>,
	ctx: RenderContext,
): string {
	if (el.hidden) {
		return '';
	}

	const transform = renderTransform(el);
	const opacity = el.opacity;
	let inner = '';

	switch (el.type) {
		case 'text':
			inner = renderShapeBody(el) + renderText(el, defaults);
			break;

		case 'shape':
			inner = renderShapeBody(el) + renderText(el, defaults);
			break;

		case 'connector':
			inner = renderConnector(el, ctx);
			break;

		case 'image':
		case 'picture':
			inner = renderImageElement(el, ctx);
			break;

		case 'table':
			inner = renderTable(el, defaults);
			break;

		case 'group':
			inner = renderGroup(el, defaults, ctx);
			break;

		case 'ink':
			inner = renderInk(el);
			break;

		case 'chart':
			inner = renderChartSvg(el) ?? renderPlaceholder(el);
			break;

		case 'smartArt':
			inner = renderSmartArtSvg(el) ?? renderPlaceholder(el);
			break;

		case 'ole':
			inner = renderOlePreviewSvg(el) ?? renderPlaceholder(el);
			break;

		case 'media':
			inner = renderMediaPreviewSvg(el) ?? renderPlaceholder(el);
			break;

		case 'model3d':
			inner = renderModel3DPreviewSvg(el) ?? renderPlaceholder(el);
			break;

		case 'contentPart':
			inner = renderContentPartSvg(el) ?? renderPlaceholder(el);
			break;

		case 'zoom':
			inner = renderZoomPreviewSvg(el) ?? renderPlaceholder(el);
			break;

		case 'unknown':
			inner = renderPlaceholder(el);
			break;
	}

	if (!inner) {
		return '';
	}

	return `<g${attrs({
		transform,
		opacity: opacity !== undefined && opacity < 1 ? opacity : undefined,
	})}>${inner}</g>`;
}

// ────────────────────────────────────────────────────────────────────
// Background
// ────────────────────────────────────────────────────────────────────

function renderBackground(slide: PptxSlide, width: number, height: number): string {
	if (slide.backgroundImage) {
		return (
			`<rect${attrs({ width, height, fill: '#FFFFFF' })} />` +
			`<image${attrs({
				width,
				height,
				preserveAspectRatio: 'xMidYMid slice',
			})} href="${escXml(slide.backgroundImage)}" />`
		);
	}

	const fill = slide.backgroundColor ?? '#FFFFFF';
	return `<rect${attrs({ width, height, fill })} />`;
}

// ────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────

/**
 * Pure-TypeScript SVG exporter for parsed PPTX data.
 *
 * Generates well-formed SVG XML strings without any DOM dependency.
 *
 * @example
 * ```ts
 * const svgs = SvgExporter.exportAll(pptxData);
 * for (const [i, svg] of svgs.entries()) {
 *   fs.writeFileSync(`slide_${i + 1}.svg`, svg);
 * }
 * ```
 */
export class SvgExporter {
	/**
	 * Export a single slide to an SVG XML string.
	 *
	 * @param slide  - The parsed slide.
	 * @param width  - SVG viewport width (pixels).
	 * @param height - SVG viewport height (pixels).
	 * @param options - Optional export settings.
	 * @returns A complete SVG document as a string.
	 */
	static exportSlide(
		slide: PptxSlide,
		width: number,
		height: number,
		options?: SvgExportOptions,
	): string {
		const defaults = resolveDefaults(options);
		// Slide.slideId / sequence-number not always present; use a hash of
		// elements length as a stable slide-local namespace for filter ids.
		const ctx = createRenderContext(slide.elements.length);

		const bodyParts: string[] = [];
		bodyParts.push(renderBackground(slide, width, height));

		for (const el of slide.elements) {
			bodyParts.push(renderElement(el, defaults, ctx));
		}

		const defsBlock = ctx.defs.length ? `<defs>${ctx.defs.join('')}</defs>` : '';

		return `<svg${attrs({
			xmlns: SVG_NS,
			'xmlns:xlink': XLINK_NS,
			viewBox: `0 0 ${width} ${height}`,
			width,
			height,
		})}>${defsBlock}${bodyParts.join('')}</svg>`;
	}

	/**
	 * Export all (or selected) slides to SVG XML strings.
	 *
	 * @param data    - The fully parsed PPTX data.
	 * @param options - Optional export settings.
	 * @returns An array of SVG strings (one per exported slide).
	 */
	static exportAll(data: PptxData, options?: SvgExportOptions): string[] {
		const results: string[] = [];
		const includeHidden = options?.includeHidden ?? false;

		for (let i = 0; i < data.slides.length; i++) {
			// Optionally filter to specific indices
			if (options?.slideIndices && !options.slideIndices.includes(i)) {
				continue;
			}

			const slide = data.slides[i];

			// Skip hidden unless asked
			if (slide.hidden && !includeHidden) {
				continue;
			}

			results.push(SvgExporter.exportSlide(slide, data.width, data.height, options));
		}

		return results;
	}
}
