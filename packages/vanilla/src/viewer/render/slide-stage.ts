import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize } from 'pptx-viewer-shared';
import { getSlideBackgroundStyle } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from './dom';
import type { ElementRenderContext, ElementRendererRegistry } from './types';

export interface SlideStageOptions {
	document: Document;
	slide: PptxSlide;
	canvasSize: CanvasSize;
	mediaDataUrls: ReadonlyMap<string, string>;
	registry: ElementRendererRegistry;
	t: Translator;
	/** Scale applied via CSS transform (default 1). */
	scale?: number;
	/** Opt-in WebGL SmartArt renderer flag; see `PptxViewerOptions.smartArt3D`. */
	smartArt3D?: boolean;
}

/**
 * Render one slide as a fixed-size stage: the resolved slide background plus
 * every element dispatched through the registry, scaled with a CSS transform
 * (`transform-origin: top left`), exactly like the other bindings' stages.
 *
 * The returned node is `canvasSize * scale` ON SCREEN but laid out at the
 * unscaled canvas size, so the caller should wrap it in a box sized to
 * `canvasSize * scale` (the viewer's stage host and thumbnails both do).
 */
export function renderSlideStage(options: SlideStageOptions): HTMLElement {
	const { document: doc, slide, canvasSize, mediaDataUrls, registry, t } = options;
	const scale = options.scale ?? 1;

	const stage = createEl(doc, 'div', 'pptxv-stage', {
		width: `${canvasSize.width}px`,
		height: `${canvasSize.height}px`,
		transform: `scale(${scale})`,
		transformOrigin: 'top left',
		position: 'relative',
		overflow: 'hidden',
		...getSlideBackgroundStyle(slide),
	});

	const context: ElementRenderContext = {
		document: doc,
		slide,
		canvasSize,
		scale,
		mediaDataUrls,
		t,
		smartArt3D: options.smartArt3D ?? false,
		registry,
		renderElement(element: PptxElement, zIndex: number) {
			return registry.resolve(element.type)(element, zIndex, context);
		},
	};

	slide.elements.forEach((element, index) => {
		const node = context.renderElement(element, index);
		if (node) {
			stage.appendChild(node);
		}
	});

	return stage;
}
