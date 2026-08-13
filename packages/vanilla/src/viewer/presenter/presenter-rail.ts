import type { PptxSlide } from 'pptx-viewer-core';
import {
	clampNotesFontSize,
	formatElapsed,
	formatTime,
	nextPresentedSlide,
	notesSegmentsToSpans,
	NOTES_FONT_SIZE_DEFAULT,
	NOTES_FONT_SIZE_MAX,
	NOTES_FONT_SIZE_MIN,
	NOTES_FONT_SIZE_STEP,
	PRESENTER_RAIL_LABEL_KEYS,
	presenterNextDisabled,
	presenterPrevDisabled,
} from 'pptx-viewer-shared';
import type { ShowOrderCustomShow } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createIcon } from '../ui/icons';
import { sizePreviewHost } from './presenter-preview-box';
import type { PresenterCanvasSize } from './presenter-preview-box';

/**
 * The presenter console's right-hand rail: wall clock, elapsed timer, slide
 * navigation, the next-slide preview and the speaker notes.
 *
 * Vanilla previously had none of this - its "console" was a strip of buttons
 * over the live show, so a presenter got no notes and no idea what was coming
 * next, which is the whole point of a presenter view.
 *
 * @module viewer/presenter/presenter-rail
 */

export interface PresenterRailOptions {
	doc: Document;
	t: Translator;
	getSlides: () => PptxSlide[];
	getCurrent: () => number;
	/** Render a slide at a scale, for the next-slide preview. */
	renderSlide: (slide: PptxSlide, scale: number) => HTMLElement;
	/** Preview scale, derived from the shared next-preview width. */
	previewScale: () => number;
	/** Deck dimensions, so the preview host can claim its real layout box. */
	canvas: () => PresenterCanvasSize;
	/**
	 * The custom show playback is restricted to, so the preview names the slide
	 * the next forward press actually reaches. Without it a running custom show
	 * previewed the next DECK slide instead of the next SHOW one.
	 */
	getActiveCustomShow?: () => ShowOrderCustomShow | null | undefined;
	move: (direction: 1 | -1) => void;
}

export interface PresenterRail {
	root: HTMLElement;
	/** Repaint the clock and elapsed readouts. */
	syncClock: (now: number, elapsedMs: number) => void;
	/** Repaint everything that depends on the current slide. */
	syncSlide: () => void;
}

/** A labelled read-only readout (Current Time / Elapsed). */
function buildReadout(
	doc: Document,
	label: string,
	className: string,
): { root: HTMLElement; value: HTMLElement } {
	const root = doc.createElement('div');
	root.className = className;
	const heading = doc.createElement('div');
	heading.className = 'pptxv-presenter-heading';
	heading.textContent = label;
	const value = doc.createElement('div');
	value.className = 'pptxv-presenter-readout';
	root.append(heading, value);
	return { root, value };
}

export function buildPresenterRail(options: PresenterRailOptions): PresenterRail {
	const { doc, t } = options;
	const root = doc.createElement('aside');
	root.className = 'pptxv-presenter-rail';

	const header = doc.createElement('header');
	header.className = 'pptxv-presenter-rail-header';
	const clock = buildReadout(
		doc,
		t(PRESENTER_RAIL_LABEL_KEYS.currentTime),
		'pptxv-presenter-clock',
	);
	const elapsed = buildReadout(
		doc,
		t(PRESENTER_RAIL_LABEL_KEYS.elapsed),
		'pptxv-presenter-elapsed',
	);
	header.append(clock.root, elapsed.root);

	const nav = doc.createElement('nav');
	nav.className = 'pptxv-presenter-rail-nav';
	const navButton = (id: 'prev' | 'next', labelKey: string): HTMLButtonElement => {
		const button = doc.createElement('button');
		button.type = 'button';
		button.className = 'pptxv-presenter-nav-btn';
		button.dataset.pptxPresenterControl = id;
		const label = t(labelKey);
		button.setAttribute('aria-label', label);
		button.title = label;
		const text = doc.createElement('span');
		text.textContent = label;
		const icon = createIcon(doc, id === 'prev' ? 'chevron-left' : 'chevron-right');
		button.append(...(id === 'prev' ? [icon, text] : [text, icon]));
		button.addEventListener('click', () => options.move(id === 'prev' ? -1 : 1));
		return button;
	};
	const prev = navButton('prev', 'pptx.presenter.prev');
	const counter = doc.createElement('span');
	counter.className = 'pptxv-presenter-counter';
	const next = navButton('next', 'pptx.presenter.next');
	nav.append(prev, counter, next);

	const nextSection = doc.createElement('section');
	nextSection.className = 'pptxv-presenter-next';
	// Neutral hooks, not classes: `e2e/presenter-view-parity.spec.ts` runs one
	// spec unchanged against all five bindings, and a `pptxv-` class would
	// silently assert nothing in the other four.
	nextSection.dataset.pptxPresenterNextPreview = 'true';
	const nextHeading = doc.createElement('div');
	nextHeading.className = 'pptxv-presenter-heading';
	nextHeading.textContent = t(PRESENTER_RAIL_LABEL_KEYS.nextSlidePreview);
	const nextBody = doc.createElement('div');
	nextBody.className = 'pptxv-presenter-next-body';
	nextSection.append(nextHeading, nextBody);

	const notesSection = doc.createElement('section');
	notesSection.className = 'pptxv-presenter-notes';
	notesSection.dataset.pptxPresenterNotes = 'true';
	const notesHeader = doc.createElement('div');
	notesHeader.className = 'pptxv-presenter-notes-header';
	const notesHeading = doc.createElement('div');
	notesHeading.className = 'pptxv-presenter-heading';
	notesHeading.textContent = t(PRESENTER_RAIL_LABEL_KEYS.speakerNotes);
	let fontSize = NOTES_FONT_SIZE_DEFAULT;
	const notesBody = doc.createElement('div');
	notesBody.className = 'pptxv-presenter-notes-body';
	const sizeReadout = doc.createElement('span');
	sizeReadout.className = 'pptxv-presenter-notes-size';
	const stepFont = (delta: number): void => {
		fontSize = clampNotesFontSize(fontSize + delta);
		notesBody.style.fontSize = `${String(fontSize)}px`;
		sizeReadout.textContent = `${String(fontSize)}px`;
		decrease.disabled = fontSize <= NOTES_FONT_SIZE_MIN;
		increase.disabled = fontSize >= NOTES_FONT_SIZE_MAX;
	};
	const fontButton = (id: string, labelKey: string, delta: number): HTMLButtonElement => {
		const button = doc.createElement('button');
		button.type = 'button';
		button.className = 'pptxv-presenter-notes-btn';
		button.dataset.pptxPresenterControl = id;
		const label = t(labelKey);
		button.setAttribute('aria-label', label);
		button.title = label;
		button.append(createIcon(doc, delta < 0 ? 'minus' : 'plus'));
		button.addEventListener('click', () => stepFont(delta));
		return button;
	};
	const decrease = fontButton(
		'notes-font-decrease',
		'pptx.presenter.decreaseFontSize',
		-NOTES_FONT_SIZE_STEP,
	);
	const increase = fontButton(
		'notes-font-increase',
		'pptx.presenter.increaseFontSize',
		NOTES_FONT_SIZE_STEP,
	);
	const fontControls = doc.createElement('div');
	fontControls.className = 'pptxv-presenter-notes-controls';
	fontControls.append(decrease, sizeReadout, increase);
	notesHeader.append(notesHeading, fontControls);
	notesSection.append(notesHeader, notesBody);
	stepFont(0);

	root.append(header, nav, nextSection, notesSection);

	/** Paint the notes pane: rich segments, then plain text, then a placeholder. */
	const paintNotes = (slide: PptxSlide | undefined): void => {
		notesBody.replaceChildren();
		const segments = slide?.notesSegments;
		if (segments?.length) {
			for (const span of notesSegmentsToSpans(segments)) {
				if (span.kind === 'break') {
					notesBody.append(doc.createElement('br'));
					continue;
				}
				const node = doc.createElement('span');
				node.textContent = span.text;
				Object.assign(node.style, span.style);
				notesBody.append(node);
			}
			return;
		}
		const plain = slide?.notes?.trim();
		if (plain) {
			notesBody.textContent = plain;
			return;
		}
		const placeholder = doc.createElement('em');
		placeholder.className = 'pptxv-presenter-empty';
		placeholder.textContent = t(PRESENTER_RAIL_LABEL_KEYS.noNotes);
		notesBody.append(placeholder);
	};

	const syncSlide = (): void => {
		const slides = options.getSlides();
		const current = options.getCurrent();
		counter.textContent = `${String(current + 1)} / ${String(slides.length)}`;
		prev.disabled = presenterPrevDisabled(current);
		// Never disabled: PowerPoint's console advances from the last slide to the
		// end-of-show screen and then out of the show. Disabling it strands the
		// presenter on the final slide, so the audience display never closes.
		next.disabled = presenterNextDisabled();
		nextBody.replaceChildren();
		// Hidden slides and custom-show membership are the show order's business,
		// not `current + 1`: the preview must show what Next will actually reach.
		const upcoming = nextPresentedSlide(slides, current, options.getActiveCustomShow?.());
		if (upcoming) {
			const scale = options.previewScale();
			nextBody.append(options.renderSlide(upcoming, scale));
			// The stage is transform-scaled, so its layout box is still full size:
			// without this the preview claimed the whole rail and pushed the
			// speaker notes off the bottom of the screen.
			sizePreviewHost(nextBody, options.canvas(), scale);
		} else {
			nextBody.style.removeProperty('width');
			nextBody.style.removeProperty('height');
			const end = doc.createElement('em');
			end.className = 'pptxv-presenter-empty';
			end.textContent = t(PRESENTER_RAIL_LABEL_KEYS.endOfPresentation);
			nextBody.append(end);
		}
		paintNotes(slides[current]);
	};

	return {
		root,
		syncClock: (now, elapsedMs) => {
			clock.value.textContent = formatTime(new Date(now));
			elapsed.value.textContent = formatElapsed(elapsedMs);
		},
		syncSlide,
	};
}
