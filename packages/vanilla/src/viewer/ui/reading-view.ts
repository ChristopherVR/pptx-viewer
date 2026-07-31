import type { PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize, ReadingViewCommand, ReadingViewState } from 'pptx-viewer-shared';
import {
	applyReadingViewCommand,
	canGoNext,
	canGoPrevious,
	createPresentationKeyBuffer,
	formatSlideCounter,
	handleReadingViewKey,
	openReadingView,
	READING_VIEW_ATTR,
	READING_VIEW_COUNTER_ATTR,
	READING_VIEW_STAGE_ATTR,
	readingViewFitScale,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { makeButton } from './controls';

/** Breathing room between the slide and the window edge, in CSS pixels. */
const READING_VIEW_PADDING = 24;

export interface ReadingViewOptions {
	slides: readonly PptxSlide[];
	canvasSize: CanvasSize;
	/** Slide the editor was on when the view was opened. */
	initialSlideIndex: number;
	/**
	 * The viewer's own static slide renderer (`RenderController.renderSlideNode`),
	 * so the reading view draws the deck through the same path as the canvas and
	 * the thumbnail rail instead of growing a second element renderer.
	 */
	renderStage(slide: PptxSlide, scale: number): HTMLElement;
	/** Receives the slide the reader ended on, so the editor lands there. */
	onExit(slideIndex: number): void;
}

export interface ReadingViewHandle {
	el: HTMLElement;
	/** Tear down: drop the key listener, the observer and the node. */
	close(): void;
}

/**
 * PowerPoint's Reading View: the deck at full window size with the editor
 * chrome reduced to a nav bar.
 *
 * This is NOT the slide show. It never touches the Fullscreen API and carries
 * no pointer tools, blackout or presenter console, which is exactly the weight
 * a reader asked to escape; see `render/reading-view` in `pptx-viewer-shared`
 * for why the two views are kept apart. Every navigation rule (what Page Down
 * does, what advancing past the last slide means) comes from that shared module
 * so the five bindings cannot drift.
 *
 * Returns `null` for an empty deck: there is nothing to read, and mounting a
 * chrome-only overlay would trap the user behind a nav bar with no exit target.
 */
export function openReadingViewOverlay(
	doc: Document,
	host: HTMLElement,
	t: Translator,
	options: ReadingViewOptions,
): ReadingViewHandle | null {
	const slideCount = options.slides.length;
	host.querySelector(`[${READING_VIEW_ATTR}]`)?.remove();
	if (slideCount === 0) {
		return null;
	}

	let state: ReadingViewState = openReadingView(options.initialSlideIndex, slideCount);
	let viewportBox = { width: 0, height: 0 };
	let closed = false;
	// One buffer for as long as the view stays open: it accumulates PowerPoint's
	// "type a slide number, then Enter" jump across key presses.
	const keyBuffer = createPresentationKeyBuffer();

	const el = createEl(doc, 'section', 'pptxv-reading-view');
	el.setAttribute(READING_VIEW_ATTR, 'true');
	el.setAttribute('role', 'region');
	el.setAttribute('aria-label', t('pptx.view.readingView'));
	// Focusable so the view owns the keyboard the moment it opens, without
	// stealing focus from any editable field afterwards.
	el.tabIndex = -1;

	const viewport = createEl(doc, 'div', 'pptxv-reading-view-viewport');
	const bar = createEl(doc, 'div', 'pptxv-reading-view-bar');
	const previous = makeButton(doc, {
		label: t('pptx.common.previous'),
		icon: 'chevron-left',
		className: 'pptxv-reading-view-btn',
		onClick: () => run({ command: 'previous' }),
	});
	const counter = createEl(doc, 'span', 'pptxv-reading-view-counter');
	counter.setAttribute(READING_VIEW_COUNTER_ATTR, 'true');
	const next = makeButton(doc, {
		label: t('pptx.common.next'),
		icon: 'chevron-right',
		className: 'pptxv-reading-view-btn',
		onClick: () => run({ command: 'next' }),
	});
	const exit = makeButton(doc, {
		label: t('pptx.statusBar.normalView'),
		icon: 'close',
		className: 'pptxv-reading-view-btn',
		onClick: () => run({ command: 'exit' }),
	});
	bar.append(previous.btn, counter, next.btn, exit.btn);
	el.append(viewport, bar);

	const render = (): void => {
		const slide = options.slides[state.slideIndex];
		counter.textContent = formatSlideCounter(state.slideIndex, slideCount);
		previous.setDisabled(!canGoPrevious(state));
		next.setDisabled(!canGoNext(state, slideCount));
		const width = Math.max(options.canvasSize.width, 1);
		const height = Math.max(options.canvasSize.height, 1);
		const scale = readingViewFitScale(options.canvasSize, viewportBox, READING_VIEW_PADDING);
		const stage = createEl(doc, 'div', 'pptxv-reading-view-stage', {
			width: `${width * scale}px`,
			height: `${height * scale}px`,
		});
		stage.setAttribute(READING_VIEW_STAGE_ATTR, 'true');
		stage.setAttribute('aria-roledescription', 'slide');
		// Scale 0 means the viewport has not been laid out yet; the contract node
		// still goes up (the nav bar is built around it) but there is no honest
		// size to draw the slide at until the first measurement lands.
		if (slide && scale > 0) {
			stage.appendChild(options.renderStage(slide, scale));
		}
		viewport.replaceChildren(stage);
	};

	const run = (command: ReadingViewCommand): void => {
		const current = state;
		const nextState = applyReadingViewCommand(current, command, slideCount);
		if (current.open && !nextState.open) {
			// Leaving hands the reader back to the editor on the slide they were
			// reading, which is what leaving any PowerPoint view does.
			close();
			options.onExit(current.slideIndex);
			return;
		}
		state = nextState;
		render();
	};

	// Capture phase, not bubble: the editor's own shortcut handler is still
	// listening on the viewer root underneath this overlay, and until this ran
	// first an arrow key both turned the page AND nudged the selected shape
	// behind the overlay, so merely reading a deck edited it.
	const onKeyDown = (event: KeyboardEvent): void => {
		// Handled exactly once: the call mutates `keyBuffer` to accumulate a typed
		// slide number, so handling twice would swallow every digit.
		const { command, swallow, preventDefault } = handleReadingViewKey(event, keyBuffer);
		if (swallow) {
			event.stopPropagation();
		}
		if (preventDefault) {
			// Space and the arrows would otherwise scroll the page underneath.
			event.preventDefault();
		}
		if (command.command !== 'none') {
			run(command);
		}
	};

	const measure = (): void => {
		const rect = viewport.getBoundingClientRect();
		if (rect.width !== viewportBox.width || rect.height !== viewportBox.height) {
			viewportBox = { width: rect.width, height: rect.height };
			render();
		}
	};

	const ResizeObserverCtor = doc.defaultView?.ResizeObserver;
	const observer = ResizeObserverCtor ? new ResizeObserverCtor(() => measure()) : null;

	function close(): void {
		if (closed) {
			return;
		}
		closed = true;
		doc.removeEventListener('keydown', onKeyDown, true);
		observer?.disconnect();
		el.remove();
	}

	doc.addEventListener('keydown', onKeyDown, true);
	host.appendChild(el);
	const initial = viewport.getBoundingClientRect();
	viewportBox = { width: initial.width, height: initial.height };
	render();
	observer?.observe(viewport);
	el.focus();

	return { el, close };
}
