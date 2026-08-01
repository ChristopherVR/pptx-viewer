import type { PptxSlide } from 'pptx-viewer-core';
import {
	formatElapsed,
	PRESENTER_LAYOUT_METRICS,
	PRESENTER_RAIL_LABEL_KEYS,
	presenterConsoleCssVars,
	presenterPaneAdvancesOnClick,
	presenterTimerProgress,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { buildPresenterNavigator } from './presenter-navigator';
import { scaleForWidth, scaleToFit, sizePreviewHost } from './presenter-preview-box';
import type { PresenterCanvasSize } from './presenter-preview-box';
import { buildPresenterRail } from './presenter-rail';
import { buildPresenterStrip } from './presenter-strip';
import type { PresenterStripOptions } from './presenter-strip';

/**
 * The vanilla presenter view: PowerPoint's presenter console, at last.
 *
 * What this replaces: `presenter-console.ts` used to lay a bare strip of
 * English-labelled buttons over the running show. There was no current-slide
 * pane, no next-slide preview, no speaker notes, no wall clock, no elapsed
 * timer and no progress bar, so the one screen a presenter actually looks at
 * carried none of the information a presenter view exists to give them. The
 * layout, inventory and measurements now come from `render/presenter-chrome`
 * in the shared package, the same table React, Vue, Angular and Svelte read.
 *
 * @module viewer/presenter/presenter-view
 */

/** Everything the console needs from the viewer that owns it. */
export interface PresenterViewOptions extends Omit<
	PresenterStripOptions,
	'showAllSlides' | 'doc' | 't'
> {
	doc: Document;
	t: Translator;
	/** Where the console mounts: the viewer container. */
	container: HTMLElement;
	getSlides: () => PptxSlide[];
	getCurrent: () => number;
	/** Render a slide at a scale. Used by both previews and the main pane. */
	renderSlide: (slide: PptxSlide, scale: number) => HTMLElement;
	/** Deck aspect, so the main pane and previews scale correctly. */
	canvasSize: () => PresenterCanvasSize;
	navigate: (index: number) => void;
	move: (direction: 1 | -1) => void;
	/** Milliseconds the show has been running. */
	getElapsedMs: () => number;
}

/** A mounted console: refresh hooks plus teardown. */
export interface PresenterViewHandle {
	/** Repaint everything that depends on which slide is current. */
	syncSlide: () => void;
	/** Repaint the strip's pressed states and state-dependent labels. */
	syncSnapshot: () => void;
	dispose: () => void;
}

export function mountPresenterView(options: PresenterViewOptions): PresenterViewHandle {
	const { doc, t } = options;
	const root = doc.createElement('div');
	root.className = 'pptxv-presenter';
	root.setAttribute('role', 'region');
	root.setAttribute('aria-label', t('pptx.presenter.presenterView'));
	for (const [name, value] of Object.entries(presenterConsoleCssVars())) {
		root.style.setProperty(name, value);
	}

	const strip = buildPresenterStrip({ ...options, showAllSlides: () => openNavigator() });

	const body = doc.createElement('div');
	body.className = 'pptxv-presenter-body';

	const main = doc.createElement('div');
	main.className = 'pptxv-presenter-main';
	main.dataset.pptxPresenterSlide = 'true';
	const mainFrame = doc.createElement('div');
	mainFrame.className = 'pptxv-presenter-main-frame';
	const badge = doc.createElement('div');
	badge.className = 'pptxv-presenter-badge';
	main.append(mainFrame, badge);
	// Clicking the big pane advances, the way PowerPoint's console does; an
	// active drawing tool owns the pointer instead, so a stroke is not turned
	// into a slide jump halfway through.
	main.addEventListener('click', () => {
		if (presenterPaneAdvancesOnClick(options.getSnapshot().pointer?.tool)) {
			options.move(1);
		}
	});

	const rail = buildPresenterRail({
		doc,
		t,
		getSlides: options.getSlides,
		getCurrent: options.getCurrent,
		renderSlide: options.renderSlide,
		previewScale: () =>
			scaleForWidth(options.canvasSize(), PRESENTER_LAYOUT_METRICS.nextPreviewWidth),
		canvas: options.canvasSize,
		move: options.move,
	});
	body.append(main, rail.root);

	const progress = doc.createElement('div');
	progress.className = 'pptxv-presenter-progress';
	progress.setAttribute('role', 'progressbar');
	progress.setAttribute('aria-valuemin', '0');
	progress.setAttribute('aria-valuemax', '100');
	progress.setAttribute('aria-label', t(PRESENTER_RAIL_LABEL_KEYS.timerProgress));
	const progressFill = doc.createElement('div');
	progressFill.className = 'pptxv-presenter-progress-fill';
	progress.append(progressFill);

	root.append(strip.root, body, progress);
	options.container.append(root);

	let navigator: HTMLElement | null = null;
	function openNavigator(): void {
		navigator?.remove();
		navigator = buildPresenterNavigator({
			doc,
			t,
			slides: options.getSlides(),
			current: options.getCurrent(),
			renderSlide: options.renderSlide,
			tileScale: scaleForWidth(options.canvasSize(), PRESENTER_LAYOUT_METRICS.navigatorTileWidth),
			canvas: options.canvasSize(),
			select: (index) => {
				options.navigate(index);
				closeNavigator();
			},
			close: () => closeNavigator(),
		});
		root.append(navigator);
	}
	function closeNavigator(): void {
		navigator?.remove();
		navigator = null;
	}

	/** Repaint the main pane, the badge and everything slide-dependent. */
	function syncSlide(): void {
		const slides = options.getSlides();
		const current = options.getCurrent();
		const slide = slides[current];
		mainFrame.replaceChildren();
		if (slide) {
			const scale = mainScale();
			mainFrame.append(options.renderSlide(slide, scale));
			// A transform-scaled stage keeps its full-size layout box, which in a
			// centred flex column pushes the slide-number badge far below the slide.
			sizePreviewHost(mainFrame, options.canvasSize(), scale);
		} else {
			mainFrame.style.removeProperty('width');
			mainFrame.style.removeProperty('height');
			const empty = doc.createElement('div');
			empty.className = 'pptxv-presenter-empty';
			empty.textContent = t(PRESENTER_RAIL_LABEL_KEYS.noSlides);
			mainFrame.append(empty);
		}
		badge.textContent = t(PRESENTER_RAIL_LABEL_KEYS.slideLabel, {
			current: current + 1,
			total: slides.length,
		});
		rail.syncSlide();
		applyZoom();
	}

	/** Fit the current slide inside the pane, minus its padding. */
	function mainScale(): number {
		const pad = PRESENTER_LAYOUT_METRICS.mainPadding * 2;
		return scaleToFit(
			options.canvasSize(),
			Math.max(1, main.clientWidth - pad),
			Math.max(1, main.clientHeight - pad),
		);
	}

	/**
	 * The console's zoom is a CSS transform on the frame, not a re-render: the
	 * presenter zooms to read a dense slide, and re-rasterising the stage on
	 * every half-step would stutter.
	 */
	function applyZoom(): void {
		const zoom = options.getSnapshot().zoom;
		const scale = zoom?.scale ?? 1;
		mainFrame.style.transform = `scale(${String(scale)})`;
		mainFrame.style.transformOrigin = `${String((zoom?.originX ?? 0.5) * 100)}% ${String((zoom?.originY ?? 0.5) * 100)}%`;
	}

	function syncClock(): void {
		const elapsedMs = options.getElapsedMs();
		rail.syncClock(Date.now(), elapsedMs);
		const reading = presenterTimerProgress(elapsedMs);
		progress.setAttribute('aria-valuenow', String(Math.round(reading.percent)));
		progress.title = t('pptx.presenter.timerTitle', {
			elapsed: formatElapsed(elapsedMs),
			segment: reading.segment + 1,
		});
		progressFill.style.width = `${String(reading.percent)}%`;
	}

	syncSlide();
	syncClock();
	strip.sync();
	const clockTimer = setInterval(syncClock, 1000);

	return {
		syncSlide,
		syncSnapshot: () => {
			strip.sync();
			applyZoom();
		},
		dispose: () => {
			clearInterval(clockTimer);
			closeNavigator();
			root.remove();
		},
	};
}
