import { getContainerStyle } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../dom';
import type { ElementRenderer } from '../types';

/**
 * Renderer for `zoom` (Slide Zoom / Section Zoom) elements, vanilla port of
 * Vue's `ZoomRenderer.vue` / React's `ZoomElementRenderer` (static-tile
 * subset):
 *
 * - The element's own preview thumbnail (`imageData`) renders when available;
 *   otherwise a fallback tile shows the target slide number (and the section
 *   id for section zooms), like Vue without a zoom-target lookup provider.
 * - A small "Slide Zoom" / "Section Zoom" badge is drawn in the corner.
 * - `data-zoom-type` / `data-zoom-target` are exposed for hosts and tests.
 *
 * Not ported (host-state dependent in Vue/React): presentation-mode
 * click-to-navigate (both bindings inject a zoom-navigation context from the
 * presentation controller; the vanilla render context has no navigation
 * surface) and the target-slide background/section-name lookup.
 */
export const renderZoomElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'zoom') {
		return null;
	}
	const doc = context.document;
	const zoomType = element.zoomType ?? 'slide';
	const target = element.targetSlideIndex ?? 0;

	const el = createEl(doc, 'div', 'pptxv-element pptxv-zoom', getContainerStyle(element, zIndex));
	el.dataset.elementId = element.id;
	el.dataset.zoomType = zoomType;
	el.dataset.zoomTarget = String(target);
	el.setAttribute(
		'aria-label',
		zoomType === 'section' && element.targetSectionId
			? context.t('pptx.zoom.ariaLabelSection', {
					number: target + 1,
					section: element.targetSectionId,
				})
			: context.t('pptx.zoom.ariaLabel', { number: target + 1 }),
	);

	const tile = createEl(doc, 'div', 'pptxv-zoom-tile', {
		position: 'relative',
		width: '100%',
		height: '100%',
		overflow: 'hidden',
		borderRadius: '4px',
		boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
	});

	if (element.imageData) {
		const img = createEl(doc, 'img', 'pptxv-zoom-img', {
			width: '100%',
			height: '100%',
			objectFit: 'contain',
			pointerEvents: 'none',
			userSelect: 'none',
			display: 'block',
		});
		img.src = element.imageData;
		img.alt = context.t('pptx.zoom.slidePreviewAlt', { number: target + 1 });
		img.draggable = false;
		tile.appendChild(img);
	} else {
		tile.appendChild(buildThumbnail(doc, target, element.targetSectionId, context.t));
	}

	const badge = createEl(doc, 'div', 'pptxv-zoom-badge', {
		position: 'absolute',
		bottom: '4px',
		right: '4px',
		fontSize: '9px',
		padding: '1px 4px',
		borderRadius: '2px',
		backgroundColor: 'rgba(0, 0, 0, 0.5)',
		color: '#fff',
		pointerEvents: 'none',
		lineHeight: 1.4,
	});
	badge.textContent =
		zoomType === 'section' ? context.t('pptx.zoom.sectionZoom') : context.t('pptx.zoom.slideZoom');
	tile.appendChild(badge);

	el.appendChild(tile);
	return el;
};

/** Fallback tile: target slide number + optional section id, like Vue. */
function buildThumbnail(
	doc: Document,
	targetSlideIndex: number,
	targetSectionId: string | undefined,
	t: Translator,
): HTMLElement {
	const box = createEl(doc, 'div', 'pptxv-zoom-thumbnail', {
		width: '100%',
		height: '100%',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#f0f0f0',
		border: '1px solid rgba(0, 0, 0, 0.1)',
		boxSizing: 'border-box',
	});

	const slideLabel = createEl(doc, 'div', 'pptxv-zoom-slide-label', {
		fontSize: '14px',
		fontWeight: 600,
		color: 'rgba(0, 0, 0, 0.5)',
		marginBottom: '4px',
	});
	slideLabel.textContent = t('pptx.notes.slideN', { n: targetSlideIndex + 1 });
	box.appendChild(slideLabel);

	if (targetSectionId) {
		const sectionLabel = createEl(doc, 'div', 'pptxv-zoom-section-label', {
			fontSize: '10px',
			color: 'rgba(0, 0, 0, 0.4)',
		});
		sectionLabel.textContent = targetSectionId;
		box.appendChild(sectionLabel);
	}
	return box;
}
