import type { PptxSlide, SmartArtLayout, SmartArtPptxElement } from 'pptx-viewer-core';
import { buildSmartArtPresetData, PRESETS } from 'pptx-viewer-shared';
import type { CanvasSize } from 'pptx-viewer-shared';

import type { Translator } from '../../../../i18n';
import type { ElementRenderContext } from '../../../../render';
import { createElementRendererRegistry, createEl, renderSmartArtSvg } from '../../../../render';

/**
 * Live gallery preview for the SmartArt insert dialog, matching React's
 * `SmartArtPreviews.tsx`: the real renderer output for the exact element the
 * preset inserts (same layout, default items, colour scheme, style), scaled
 * down to gallery tile size, so the preview always matches what lands on the
 * slide. Vanilla's dialog previously showed one generic icon for every
 * preset.
 */

/** Element size the insert handler creates; the preview renders the same box. */
const PREVIEW_ELEMENT_WIDTH = 600;
const PREVIEW_ELEMENT_HEIGHT = 340;
/** Gallery tile width in px. */
const PREVIEW_TILE_WIDTH = 64;

const FALLBACK_ITEMS = ['1', '2', '3'];

function buildPreviewElement(layout: SmartArtLayout): SmartArtPptxElement {
	const preset = PRESETS.find((p) => p.layout === layout);
	return {
		id: `smartart-preview-${layout}`,
		type: 'smartArt',
		x: 0,
		y: 0,
		width: PREVIEW_ELEMENT_WIDTH,
		height: PREVIEW_ELEMENT_HEIGHT,
		smartArtData: buildSmartArtPresetData(layout, preset?.defaultItems ?? FALLBACK_ITEMS),
	} as SmartArtPptxElement;
}

/** Build the live, scaled-down gallery tile preview for one SmartArt layout. */
export function buildSmartArtGalleryPreview(
	doc: Document,
	t: Translator,
	layout: SmartArtLayout,
): HTMLElement {
	const scale = PREVIEW_TILE_WIDTH / PREVIEW_ELEMENT_WIDTH;
	const tileHeight = Math.round(PREVIEW_ELEMENT_HEIGHT * scale);

	const tile = createEl(doc, 'div', 'pptxv-smartart-option-preview', {
		width: `${PREVIEW_TILE_WIDTH}px`,
		height: `${tileHeight}px`,
		overflow: 'hidden',
		pointerEvents: 'none',
	});
	tile.setAttribute('aria-hidden', 'true');

	const scaledStage = createEl(doc, 'div', undefined, {
		width: `${PREVIEW_ELEMENT_WIDTH}px`,
		height: `${PREVIEW_ELEMENT_HEIGHT}px`,
		transform: `scale(${scale})`,
		transformOrigin: 'top left',
	});
	tile.appendChild(scaledStage);

	const element = buildPreviewElement(layout);
	const canvasSize: CanvasSize = { width: PREVIEW_ELEMENT_WIDTH, height: PREVIEW_ELEMENT_HEIGHT };
	const slide: PptxSlide = {
		id: 'smartart-preview',
		rId: 'smartart-preview',
		slideNumber: 1,
		elements: [element],
	};
	const context: ElementRenderContext = {
		document: doc,
		slide,
		canvasSize,
		scale: 1,
		mediaDataUrls: new Map(),
		t,
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		lineChart3D: false,
		areaChart3D: false,
		pieChart3D: false,
		presenting: false,
		registry: createElementRendererRegistry(),
		renderElement: () => null,
	};

	const rendered = renderSmartArtSvg(element, 0, context);
	if (rendered) {
		scaledStage.appendChild(rendered);
	}
	return tile;
}
