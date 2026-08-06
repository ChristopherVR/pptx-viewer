import type { PptxSlide } from 'pptx-viewer-core';
import { buildSlideTemplateContent } from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import type { ElementRendererRegistry } from '../../../render';
import { createDefaultRegistry, createEl, renderSlideStage } from '../../../render';

/**
 * Live-rendered miniature of a slide template, mirroring React's
 * `SlideTemplatePreview`: build the exact elements insertion would produce
 * (shared `buildSlideTemplateContent`) at full canvas size, render them
 * through the real slide stage / element renderer registry, and scale the
 * stage down with a CSS transform so the preview is pixel-faithful.
 */

/** Full-size stage the template is built at (standard 16:9 canvas). */
const PREVIEW_CANVAS_WIDTH = 1280;
const PREVIEW_CANVAS_HEIGHT = 720;
/** Rendered tile width in px. */
const PREVIEW_TILE_WIDTH = 144;
const PREVIEW_SCALE = PREVIEW_TILE_WIDTH / PREVIEW_CANVAS_WIDTH;
const PREVIEW_TILE_HEIGHT = Math.round(PREVIEW_CANVAS_HEIGHT * PREVIEW_SCALE);

/**
 * One registry for every preview tile: the default renderer set is stateless
 * dispatch, so all previews (and re-opens) can share a single instance.
 */
let previewRegistry: ElementRendererRegistry | undefined;

/**
 * Render one template preview tile (144x81): a clipped frame around the real
 * slide stage scaled to `PREVIEW_SCALE` (transform-origin top left). The frame
 * is decorative; the owning gallery option carries the accessible name.
 */
export function renderSlideTemplatePreview(
	doc: Document,
	t: Translator,
	templateId: SlideTemplateId,
	scheme?: Record<string, string>,
): HTMLElement {
	previewRegistry ??= createDefaultRegistry();
	const content = buildSlideTemplateContent(templateId, {
		slideWidth: PREVIEW_CANVAS_WIDTH,
		slideHeight: PREVIEW_CANVAS_HEIGHT,
		...(scheme ? { scheme } : {}),
		idFor: (index) => `tpl-preview-${templateId}-${index}`,
	});
	const previewSlide: PptxSlide = {
		id: `tpl-preview-${templateId}`,
		rId: '',
		slideNumber: 1,
		elements: content.elements,
		...(content.backgroundColor ? { backgroundColor: content.backgroundColor } : {}),
	};

	const frame = createEl(doc, 'div', 'pptxv-tpl-preview', {
		width: `${PREVIEW_TILE_WIDTH}px`,
		height: `${PREVIEW_TILE_HEIGHT}px`,
		overflow: 'hidden',
		pointerEvents: 'none',
		backgroundColor: previewSlide.backgroundColor ?? '#FFFFFF',
	});
	frame.setAttribute('aria-hidden', 'true');
	frame.appendChild(
		renderSlideStage({
			document: doc,
			slide: previewSlide,
			canvasSize: { width: PREVIEW_CANVAS_WIDTH, height: PREVIEW_CANVAS_HEIGHT },
			mediaDataUrls: new Map<string, string>(),
			registry: previewRegistry,
			t,
			scale: PREVIEW_SCALE,
		}),
	);
	return frame;
}
