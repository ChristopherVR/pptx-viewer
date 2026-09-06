import type { TextSegment, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import type { EnvelopeSegmentInput, WarpParagraph } from 'pptx-viewer-shared';
import {
	buildGlyphEnvelope,
	buildWarpPath,
	DEFAULT_FONT_FAMILY,
	getWarpCssTransform,
	groupIntoParagraphs,
	hasGlyphEnvelope,
	shouldUseSvgWarp,
} from 'pptx-viewer-shared';

import { createEl, createSvgEl } from '../dom';
import type { ElementRenderContext } from '../types';

/** Render WordArt path warps and CSS approximations for envelope/simple presets. */
export function renderWarpedText(
	element: Parameters<typeof hasTextProperties>[0],
	context: ElementRenderContext,
): HTMLElement | SVGSVGElement | null {
	if (!hasTextProperties(element)) {
		return null;
	}
	const style = element.textStyle;
	const preset = style?.textWarpPreset;
	if (!preset || preset === 'textNoShape' || preset === 'textPlain') {
		return null;
	}
	const paragraphs = groupIntoParagraphs(element);
	if (paragraphs.length === 0) {
		return null;
	}
	if (!shouldUseSvgWarp(preset)) {
		const transform = getWarpCssTransform(preset, style?.textWarpAdj, style?.textWarpAdj2);
		if (!transform) {
			return null;
		}
		const text = createEl(context.document, 'div', 'pptxv-wordart', {
			width: '100%',
			height: '100%',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			transform: transform.transform,
			transformOrigin: transform.transformOrigin,
		});
		if (style?.color) {
			text.style.color = style.color;
		}
		if (style?.fontFamily) {
			text.style.fontFamily = style.fontFamily;
		}
		if (style?.fontSize) {
			text.style.fontSize = `${style.fontSize}px`;
		}
		if (style?.bold) {
			text.style.fontWeight = 'bold';
		}
		text.textContent = paragraphs.map((p) => p.segments.map((s) => s.text).join('')).join('\n');
		return text;
	}
	// Envelope presets (inflate/deflate/can) get a true per-glyph height warp
	// instead of a shared-baseline `<textPath>`, across every paragraph: line
	// `i` of `lineCount` occupies its own `[i/n, (i+1)/n]` vertical slice of
	// the envelope curve's local band (see `buildGlyphEnvelope` in
	// pptx-viewer-shared), so a multi-paragraph block bends within the same
	// overall envelope shape instead of falling back to the shared-baseline
	// `<textPath>` renderer.
	if (hasGlyphEnvelope(preset)) {
		return renderGlyphWarp(element, paragraphs, context);
	}
	return renderPathWarp(element, paragraphs, context);
}

/** Resolve one segment's plain (measurement-ready) font, falling back to the element's. */
function segmentFont(segment: TextSegment, elementStyle: TextStyle): EnvelopeSegmentInput['font'] {
	const s = segment.style ?? {};
	const family = s.fontFamily || elementStyle.fontFamily || DEFAULT_FONT_FAMILY;
	return {
		fontFamily: family,
		fontSizePx: s.fontSize ?? elementStyle.fontSize ?? 18,
		bold: s.bold ?? elementStyle.bold,
		italic: s.italic ?? elementStyle.italic,
	};
}

function renderGlyphWarp(
	element: Extract<Parameters<typeof hasTextProperties>[0], { textStyle?: unknown }>,
	paragraphs: WarpParagraph[],
	context: ElementRenderContext,
): SVGSVGElement {
	const style = element.textStyle!;
	const preset = style.textWarpPreset!;
	const width = Math.max(element.width, 1);
	const height = Math.max(element.height, 1);
	const svg = createSvgEl(context.document, 'svg', {
		viewBox: `0 0 ${width} ${height}`,
		'aria-hidden': 'true',
	});
	svg.setAttribute('class', 'pptxv-wordart');
	svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;overflow:visible');
	const lineCount = paragraphs.length;
	paragraphs.forEach((paragraph, lineIndex) => {
		const segments = paragraph.segments;
		const segsInput: EnvelopeSegmentInput[] = segments.map((seg, i) => ({
			text: seg.text,
			font: segmentFont(seg, style),
			segmentIndex: i,
		}));
		const glyphs = buildGlyphEnvelope(
			preset,
			segsInput,
			width,
			height,
			style.align,
			style.textWarpAdj,
			style.textWarpAdj2,
			lineIndex,
			lineCount,
		);
		glyphs.forEach((g, glyphIndex) => {
			const s = segments[g.segmentIndex]?.style ?? {};
			const textAttrs = {
				fill: s.color ?? style.color ?? '#000000',
				'font-family': s.fontFamily ?? style.fontFamily ?? DEFAULT_FONT_FAMILY,
				'font-size': s.fontSize ?? style.fontSize ?? 18,
				'font-weight': (s.bold ?? style.bold) ? 'bold' : undefined,
				'font-style': (s.italic ?? style.italic) ? 'italic' : undefined,
			};
			if (!g.slices || g.slices.length <= 1) {
				// Ordinary glyph (no slices needed): a bare <text>, unchanged from
				// before per-glyph slicing existed.
				const text = createSvgEl(context.document, 'text', {
					x: g.x,
					y: g.y,
					transform: g.transform,
					...textAttrs,
				});
				text.textContent = g.char;
				svg.appendChild(text);
				return;
			}
			// A very wide glyph on a strongly-curved envelope: rendered as
			// `slices.length` clipped copies, each with its own affine (see
			// `chooseGlyphSliceCount` in pptx-viewer-shared), so the pieces tile
			// across the glyph. Wrapped in a real <g> so it never matches an
			// "svg > text" selector the single-slice case does.
			const group = createSvgEl(context.document, 'g', {
				'data-glyph-slices': g.slices.length,
			});
			g.slices.forEach((slice, sliceIndex) => {
				const clipId = `${element.id.replace(/[^a-zA-Z0-9_-]/gu, '_')}-warp-l${lineIndex}-g${glyphIndex}-s${sliceIndex}`;
				const clipPath = createSvgEl(context.document, 'clipPath', {
					id: clipId,
					clipPathUnits: 'userSpaceOnUse',
				});
				clipPath.appendChild(
					createSvgEl(context.document, 'rect', {
						x: slice.clipX0,
						y: -100000,
						width: slice.clipX1 - slice.clipX0,
						height: 200000,
					}),
				);
				group.appendChild(clipPath);
				const text = createSvgEl(context.document, 'text', {
					x: g.x,
					y: g.y,
					transform: slice.transform,
					'clip-path': `url(#${clipId})`,
					...textAttrs,
				});
				text.textContent = g.char;
				group.appendChild(text);
			});
			svg.appendChild(group);
		});
	});
	return svg;
}

function renderPathWarp(
	element: Extract<Parameters<typeof hasTextProperties>[0], { textStyle?: unknown }>,
	paragraphs: ReturnType<typeof groupIntoParagraphs>,
	context: ElementRenderContext,
): SVGSVGElement {
	const style = element.textStyle!;
	const preset = style.textWarpPreset!;
	const svg = createSvgEl(context.document, 'svg', {
		viewBox: `0 0 ${Math.max(element.width, 1)} ${Math.max(element.height, 1)}`,
		preserveAspectRatio: 'none',
		'aria-hidden': 'true',
	});
	svg.setAttribute('class', 'pptxv-wordart');
	svg.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;overflow:visible');
	const defs = createSvgEl(context.document, 'defs');
	paragraphs.forEach((paragraph, index) => {
		const id = `${element.id.replace(/[^a-zA-Z0-9_-]/gu, '_')}-warp-${index}`;
		defs.appendChild(
			createSvgEl(context.document, 'path', {
				id,
				d: buildWarpPath(
					preset,
					element.width,
					element.height,
					index,
					paragraphs.length,
					style.textWarpAdj,
					style.textWarpAdj2,
				),
			}),
		);
		const text = createSvgEl(context.document, 'text', {
			fill: style.color ?? '#000000',
			'font-family': style.fontFamily ?? DEFAULT_FONT_FAMILY,
			'font-size': style.fontSize ?? 18,
			'font-weight': style.bold ? 'bold' : undefined,
			'font-style': style.italic ? 'italic' : undefined,
		});
		const textPath = createSvgEl(context.document, 'textPath', {
			href: `#${id}`,
			startOffset: '50%',
			'text-anchor': 'middle',
		});
		textPath.textContent = paragraph.segments.map((segment) => segment.text).join('');
		text.appendChild(textPath);
		svg.appendChild(text);
	});
	svg.insertBefore(defs, svg.firstChild);
	return svg;
}
