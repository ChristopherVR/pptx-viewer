import { hasTextProperties } from 'pptx-viewer-core';
import {
	buildWarpPath,
	getWarpCssTransform,
	groupIntoParagraphs,
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
	return renderPathWarp(element, paragraphs, context);
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
			'font-family': style.fontFamily,
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
