import {
	AUTO_HIDE_DELAY_MS,
	formatElapsed,
	formatSlideCounter,
	HIGHLIGHTER_COLORS,
	isInBottomTriggerZone,
	PEN_COLORS,
} from 'pptx-viewer-shared';
import type { PresentationPointerTool } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { buildPresentationToolbarDom } from './presentation-toolbar-controls';

/**
 * The floating slide-show toolbar, matching React's `PresentationToolbar`.
 *
 * Vanilla previously shipped ONLY `presentation-touch-controls.ts`, whose CSS
 * hides it outside a coarse pointer, so a desktop presenter saw no show chrome
 * at all: no counter, no navigation, and no way out short of Escape. This is the
 * desktop bar, built from the shared `present-chrome` inventory so its control
 * ids, order and accessible names cannot drift from the other four bindings.
 *
 * This module owns behaviour only; the element tree lives in
 * `presentation-toolbar-controls.ts` (see the 300 LOC ceiling in CLAUDE.md).
 */

export interface PresentationToolbarHandlers {
	previous(): void;
	next(): void;
	/** Select an annotation tool; the caller decides whether re-selecting clears it. */
	setTool(tool: PresentationPointerTool): void;
	/** Set the active pointer colour (picking a swatch also selects its tool). */
	setColor(color: string): void;
	clearAnnotations(): void;
	/** Open/close the presenter console + audience display. */
	togglePresenterView(): void;
	end(): void;
}

/** Everything the bar reflects; pushed in as partial patches from two sources. */
export interface PresentationToolbarState {
	/** Zero-based active slide. */
	current: number;
	total: number;
	tool: PresentationPointerTool;
	hasAnnotations: boolean;
	presenterViewActive: boolean;
}

export interface PresentationToolbar {
	el: HTMLElement;
	update(patch: Partial<PresentationToolbarState>): void;
	/** Start/stop the elapsed timer, the auto-hide listeners and the bar itself. */
	setPresenting(presenting: boolean): void;
	dispose(): void;
}

/**
 * Build the show toolbar. `container` is the surface the bottom trigger zone is
 * measured against (the `.pptxv` root, which is also the fullscreen element).
 */
export function createPresentationToolbar(
	doc: Document,
	t: Translator,
	container: HTMLElement,
	handlers: PresentationToolbarHandlers,
): PresentationToolbar {
	const state: PresentationToolbarState = {
		current: 0,
		total: 0,
		tool: 'none',
		hasAnnotations: false,
		presenterViewActive: false,
	};
	// The presenter snapshot carries ONE pointer colour, but PowerPoint remembers
	// a pen colour and a highlighter colour independently, so the last choice per
	// tool is kept here and re-applied whenever that tool is picked again.
	let penColor = PEN_COLORS[0] ?? '#ff0000';
	let highlighterColor = HIGHLIGHTER_COLORS[0] ?? '#ffff00';

	const parts = buildPresentationToolbarDom(doc, t, handlers, (tool, color) => {
		if (tool === 'pen') {
			penColor = color;
		} else {
			highlighterColor = color;
		}
		render();
	});
	const { wrap, bar } = parts;

	function render(): void {
		parts.counter.textContent = formatSlideCounter(state.current, state.total);
		parts.previous.setDisabled(state.current <= 0);
		parts.next.setDisabled(state.current >= state.total - 1);
		parts.laser.setActive(state.tool === 'laser');
		parts.pen.toggle.setActive(state.tool === 'pen');
		parts.highlighter.toggle.setActive(state.tool === 'highlighter');
		parts.eraser.setActive(state.tool === 'eraser');
		parts.clear.setDisabled(!state.hasAnnotations);
		parts.presenterView.setActive(state.presenterViewActive);
		parts.pen.bar.style.backgroundColor = penColor;
		parts.highlighter.bar.style.backgroundColor = highlighterColor;
		parts.pen.palette.setValue(penColor);
		parts.highlighter.palette.setValue(highlighterColor);
	}

	// -- Auto-hide (React's `PresentationToolbarWrapper`) ---------------------
	let hideTimer: number | null = null;
	let hovering = false;
	let startedAt = 0;
	let tick: number | null = null;

	const setVisible = (visible: boolean): void => {
		// Inline rather than a class: the hidden bar must stop receiving pointer
		// events even in a host page that has not loaded the viewer stylesheet.
		wrap.style.opacity = visible ? '1' : '0';
		wrap.style.pointerEvents = visible ? 'auto' : 'none';
	};
	const clearHideTimer = (): void => {
		if (hideTimer !== null) {
			window.clearTimeout(hideTimer);
			hideTimer = null;
		}
	};
	const resetHideTimer = (): void => {
		clearHideTimer();
		hideTimer = window.setTimeout(() => {
			if (!hovering) {
				setVisible(false);
			}
		}, AUTO_HIDE_DELAY_MS);
	};
	const onMouseMove = (event: MouseEvent): void => {
		const rect = container.getBoundingClientRect();
		// React checks the shared bottom trigger zone first and then falls through
		// to the same reveal, so both branches show the bar today. The zone test is
		// kept in the same position so a future "bottom edge only" policy stays a
		// one-line change in every binding rather than a re-derivation here.
		if (isInBottomTriggerZone(event.clientY, rect.height, rect.top)) {
			setVisible(true);
			resetHideTimer();
			return;
		}
		setVisible(true);
		resetHideTimer();
	};
	const onDocumentPointerDown = (event: Event): void => {
		if (event.target instanceof Node && !bar.contains(event.target)) {
			parts.closePalettes();
		}
	};
	wrap.addEventListener('mouseenter', () => {
		hovering = true;
		clearHideTimer();
		setVisible(true);
	});
	wrap.addEventListener('mouseleave', () => {
		hovering = false;
		resetHideTimer();
	});
	const renderElapsed = (): void => {
		parts.elapsedText.textContent = formatElapsed(startedAt === 0 ? 0 : Date.now() - startedAt);
	};
	const stopPresenting = (): void => {
		doc.removeEventListener('mousemove', onMouseMove);
		doc.removeEventListener('mousedown', onDocumentPointerDown);
		clearHideTimer();
		if (tick !== null) {
			window.clearInterval(tick);
			tick = null;
		}
		startedAt = 0;
		hovering = false;
		parts.closePalettes();
		renderElapsed();
		setVisible(false);
	};

	setVisible(false);
	renderElapsed();
	render();

	return {
		el: wrap,
		update(patch) {
			Object.assign(state, patch);
			render();
		},
		setPresenting(presenting) {
			if (!presenting) {
				stopPresenting();
				return;
			}
			startedAt = Date.now();
			renderElapsed();
			tick ??= window.setInterval(renderElapsed, 1000);
			doc.addEventListener('mousemove', onMouseMove);
			doc.addEventListener('mousedown', onDocumentPointerDown);
			setVisible(true);
			resetHideTimer();
		},
		dispose() {
			stopPresenting();
			wrap.remove();
		},
	};
}
