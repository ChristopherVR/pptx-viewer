import { buildSummaryZoomView, getContainerStyle } from 'pptx-viewer-shared';

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
 * - During presentation, click or keyboard activation navigates to the target.
 * - Fallback thumbnails use target slide metadata when the deck is available.
 */
export const renderZoomElement: ElementRenderer = (element, zIndex, context) => {
	if (element.type !== 'zoom') {
		return null;
	}
	const doc = context.document;
	const summaryView = buildSummaryZoomView(
		element,
		(index) => {
			const slide = context.slides?.[index];
			return slide
				? {
						slideNumber: slide.slideNumber,
						sectionName: slide.sectionName,
						backgroundColor: slide.backgroundColor,
					}
				: undefined;
		},
		// The tile captions and the container aria-label are built in shared; the
		// translator is what keeps them from rendering English inside an otherwise
		// translated viewer.
		(key, params) => context.t(key, params),
	);
	if (summaryView) {
		const root = createEl(
			doc,
			'div',
			'pptxv-element pptxv-zoom pptxv-summary-zoom',
			getContainerStyle(element, zIndex),
		);
		const content = createEl(doc, 'div', 'pptxv-summary-zoom-content', summaryView.containerStyle);
		root.dataset.elementId = element.id;
		root.dataset.zoomType = 'summary';
		root.setAttribute('role', 'group');
		root.setAttribute('aria-label', summaryView.ariaLabel);
		for (const tile of summaryView.tiles) {
			const tileElement = createEl(doc, 'div', 'pptxv-summary-zoom-tile', {
				...tile.style,
				backgroundColor: tile.backgroundColor,
				overflow: 'hidden',
				border: '1px solid rgba(0, 0, 0, 0.12)',
			});
			tileElement.dataset.zoomTarget = String(tile.targetSlideIndex);
			tileElement.dataset.sectionId = tile.sectionId;
			tileElement.setAttribute('aria-label', tile.ariaLabel);
			if (context.presenting && context.onZoomClick) {
				tileElement.setAttribute('role', 'button');
				tileElement.tabIndex = 0;
				const activate = (): void =>
					context.onZoomClick?.(tile.targetSlideIndex, context.currentSlideIndex ?? 0);
				tileElement.addEventListener('click', (event) => {
					event.stopPropagation();
					activate();
				});
				tileElement.addEventListener('keydown', (event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						event.stopPropagation();
						activate();
					}
				});
			}
			if (tile.imageSrc) {
				const image = createEl(doc, 'img');
				image.src = tile.imageSrc;
				image.alt = tile.ariaLabel;
				image.style.cssText = 'width:100%;height:100%;object-fit:contain';
				tileElement.appendChild(image);
			} else {
				const label = createEl(doc, 'div');
				label.textContent = tile.label;
				const slideLabel = createEl(doc, 'div');
				slideLabel.textContent = tile.slideLabel;
				tileElement.append(label, slideLabel);
			}
			content.appendChild(tileElement);
		}
		const badge = createEl(doc, 'div', 'pptxv-zoom-badge');
		badge.textContent = context.t('pptx.zoom.summaryZoom');
		content.appendChild(badge);
		root.appendChild(content);
		return root;
	}
	const zoomType = element.zoomType ?? 'slide';
	const target = element.targetSlideIndex ?? 0;
	const targetSlide = context.slides?.[target];
	const interactive = context.presenting && context.onZoomClick !== undefined;

	const el = createEl(doc, 'div', 'pptxv-element pptxv-zoom', getContainerStyle(element, zIndex));
	el.dataset.elementId = element.id;
	el.dataset.zoomType = zoomType;
	el.dataset.zoomTarget = String(target);
	if (interactive) {
		el.classList.add('pptxv-zoom-interactive');
		el.setAttribute('role', 'button');
		el.tabIndex = 0;
		el.style.cursor = 'pointer';
		const activate = (): void => {
			context.onZoomClick?.(target, context.currentSlideIndex ?? 0);
		};
		el.addEventListener('click', (event) => {
			event.stopPropagation();
			activate();
		});
		el.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			activate();
		});
	}
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
		tile.appendChild(
			buildThumbnail(
				doc,
				targetSlide?.slideNumber ?? target + 1,
				targetSlide?.sectionName ?? targetSlide?.sectionId ?? element.targetSectionId,
				targetSlide?.backgroundColor,
				context.t,
			),
		);
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
	slideNumber: number,
	sectionText: string | undefined,
	backgroundColor: string | undefined,
	t: Translator,
): HTMLElement {
	const box = createEl(doc, 'div', 'pptxv-zoom-thumbnail', {
		width: '100%',
		height: '100%',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: backgroundColor ?? '#f0f0f0',
		border: '1px solid rgba(0, 0, 0, 0.1)',
		boxSizing: 'border-box',
	});

	const slideLabel = createEl(doc, 'div', 'pptxv-zoom-slide-label', {
		fontSize: '14px',
		fontWeight: 600,
		color: 'rgba(0, 0, 0, 0.5)',
		marginBottom: '4px',
	});
	slideLabel.textContent = t('pptx.notes.slideN', { n: slideNumber });
	box.appendChild(slideLabel);

	if (sectionText) {
		const sectionLabel = createEl(doc, 'div', 'pptxv-zoom-section-label', {
			fontSize: '10px',
			color: 'rgba(0, 0, 0, 0.4)',
		});
		sectionLabel.textContent = sectionText;
		box.appendChild(sectionLabel);
	}
	return box;
}
