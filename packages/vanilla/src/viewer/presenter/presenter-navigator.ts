import type { PptxSlide } from 'pptx-viewer-core';
import { PRESENTER_LAYOUT_METRICS, PRESENTER_NAVIGATOR_LABEL_KEYS } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { sizePreviewHost } from './presenter-preview-box';
import type { PresenterCanvasSize } from './presenter-preview-box';

/**
 * The presenter console's "all slides" navigator.
 *
 * Vanilla's old grid rendered TEXT tiles ("Slide 3", "Slide 4 - hidden"), so
 * jumping to a slide meant counting rather than recognising it. This renders
 * the real slide, as the other four bindings do, and keeps the hidden-slide
 * tiles visible but dimmed so the presenter can still reach one deliberately.
 *
 * @module viewer/presenter/presenter-navigator
 */

export interface PresenterNavigatorOptions {
	doc: Document;
	t: Translator;
	slides: PptxSlide[];
	current: number;
	/** Render a slide at a scale, for a tile's preview. */
	renderSlide: (slide: PptxSlide, scale: number) => HTMLElement;
	/** Tile preview scale, derived from the shared tile width. */
	tileScale: number;
	/** Deck dimensions, so each tile claims its real layout box. */
	canvas: PresenterCanvasSize;
	select: (index: number) => void;
	close: () => void;
}

export function buildPresenterNavigator(options: PresenterNavigatorOptions): HTMLElement {
	const { doc, t } = options;
	const root = doc.createElement('div');
	root.className = 'pptxv-presenter-navigator';
	root.setAttribute('role', 'dialog');
	root.setAttribute('aria-label', t(PRESENTER_NAVIGATOR_LABEL_KEYS.title));

	const header = doc.createElement('header');
	header.className = 'pptxv-presenter-navigator-header';
	const title = doc.createElement('div');
	title.textContent = t(PRESENTER_NAVIGATOR_LABEL_KEYS.subtitle);
	const close = doc.createElement('button');
	close.type = 'button';
	close.className = 'pptxv-presenter-navigator-close';
	close.dataset.pptxPresenterControl = 'navigator-close';
	const closeLabel = t(PRESENTER_NAVIGATOR_LABEL_KEYS.close);
	close.setAttribute('aria-label', closeLabel);
	close.title = closeLabel;
	close.textContent = closeLabel;
	close.addEventListener('click', options.close);
	header.append(title, close);

	const grid = doc.createElement('div');
	grid.className = 'pptxv-presenter-navigator-grid';
	options.slides.forEach((slide, index) => {
		const tile = doc.createElement('button');
		tile.type = 'button';
		tile.className = 'pptxv-presenter-navigator-tile';
		tile.dataset.slideIndex = String(index);
		if (index === options.current) {
			tile.classList.add('is-current');
			tile.setAttribute('aria-current', 'true');
		}
		if (slide.hidden === true) {
			tile.style.opacity = String(PRESENTER_LAYOUT_METRICS.hiddenSlideOpacity);
		}
		// The tile's accessible name is the slide number, not the rendered
		// preview: the preview is a stack of decorative nodes with no text of
		// its own on a chart-only or image-only slide.
		tile.setAttribute(
			'aria-label',
			t('pptx.presenter.slideLabel', {
				current: index + 1,
				total: options.slides.length,
			}),
		);
		const preview = doc.createElement('div');
		preview.className = 'pptxv-presenter-navigator-preview';
		preview.setAttribute('aria-hidden', 'true');
		preview.append(options.renderSlide(slide, options.tileScale));
		// A transform-scaled stage keeps its full-size layout box, so each tile
		// would otherwise be 720px tall whatever the preview looks like.
		sizePreviewHost(preview, options.canvas, options.tileScale);
		const caption = doc.createElement('span');
		caption.className = 'pptxv-presenter-navigator-caption';
		caption.textContent = String(index + 1);
		tile.append(preview, caption);
		tile.addEventListener('click', () => options.select(index));
		grid.append(tile);
	});

	root.append(header, grid);
	return root;
}
