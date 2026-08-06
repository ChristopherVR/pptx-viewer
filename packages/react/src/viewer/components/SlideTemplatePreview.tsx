/**
 * SlideTemplatePreview: live-rendered miniature of a slide template.
 *
 * Mirrors the SmartArt gallery pattern: build the exact elements insertion
 * would produce (shared `buildSlideTemplateContent`) at full canvas size,
 * render them through the real StaticElementRenderer, and scale the stage
 * down with a CSS transform so the preview is pixel-faithful.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { buildSlideTemplateContent } from 'pptx-viewer-shared';
import type { SlideTemplateId } from 'pptx-viewer-shared';
import React, { useMemo } from 'react';

import { StaticElementRenderer } from './StaticElementRenderer';

/** Full-size stage the template is built at (standard 16:9 canvas). */
const PREVIEW_CANVAS_WIDTH = 1280;
const PREVIEW_CANVAS_HEIGHT = 720;
/** Rendered tile width in px. */
const PREVIEW_TILE_WIDTH = 144;
const PREVIEW_SCALE = PREVIEW_TILE_WIDTH / PREVIEW_CANVAS_WIDTH;
const PREVIEW_TILE_HEIGHT = Math.round(PREVIEW_CANVAS_HEIGHT * PREVIEW_SCALE);

export interface SlideTemplatePreviewProps {
	templateId: SlideTemplateId;
	/** Optional deck scheme so the preview shows the deck's theme colours. */
	scheme?: Record<string, string>;
}

export function SlideTemplatePreview({
	templateId,
	scheme,
}: SlideTemplatePreviewProps): React.ReactElement {
	const previewSlide: PptxSlide = useMemo(() => {
		const content = buildSlideTemplateContent(templateId, {
			slideWidth: PREVIEW_CANVAS_WIDTH,
			slideHeight: PREVIEW_CANVAS_HEIGHT,
			...(scheme ? { scheme } : {}),
			idFor: (index) => `tpl-preview-${templateId}-${index}`,
		});
		return {
			id: `tpl-preview-${templateId}`,
			rId: '',
			slideNumber: 1,
			elements: content.elements,
			...(content.backgroundColor ? { backgroundColor: content.backgroundColor } : {}),
		};
	}, [templateId, scheme]);

	return (
		<div
			aria-hidden='true'
			className='overflow-hidden pointer-events-none rounded'
			style={{
				width: PREVIEW_TILE_WIDTH,
				height: PREVIEW_TILE_HEIGHT,
				backgroundColor: previewSlide.backgroundColor ?? '#FFFFFF',
			}}
		>
			<div
				style={{
					position: 'relative',
					width: PREVIEW_CANVAS_WIDTH,
					height: PREVIEW_CANVAS_HEIGHT,
					transform: `scale(${PREVIEW_SCALE})`,
					transformOrigin: 'top left',
				}}
			>
				{previewSlide.elements.map((element, index) => (
					<StaticElementRenderer
						key={element.id}
						element={element}
						activeSlide={previewSlide}
						allSlides={[previewSlide]}
						zIndex={index}
					/>
				))}
			</div>
		</div>
	);
}
