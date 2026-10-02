import {
	AUTO_HIDE_DELAY_MS,
	HIGHLIGHTER_COLORS,
	isInBottomTriggerZone,
	PEN_COLORS,
	presentToolbarCssVars,
	registerPptxWebControls,
} from 'pptx-viewer-shared';
import type {
	PresentationBlackout,
	PresentationPointerTool,
	PresentToolbarRequestEvent,
	PptxUiPresentToolbarElement,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/**
 * The floating slide-show toolbar, matching React's `PresentationToolbar`.
 *
 * Vanilla previously shipped ONLY `presentation-touch-controls.ts`, whose CSS
 * hides it outside a coarse pointer, so a desktop presenter saw no show chrome
 * at all: no counter, no navigation, and no way out short of Escape. This is the
 * desktop bar, a thin adapter over the shared `pptx-ui-present-toolbar`, which
 * renders the shared `present-chrome` inventory (control ids, order, names,
 * colour palettes and the elapsed readout) so it cannot drift from the other four
 * bindings.
 *
 * This module owns behaviour only: the auto-hide wrapper, the start time and the
 * state reflection. The element tree lives in the shared package.
 */

export interface PresentationToolbarHandlers {
	previous(): void;
	next(): void;
	/** Select an annotation tool; the caller decides whether re-selecting clears it. */
	setTool(tool: PresentationPointerTool): void;
	/** Set the active pointer colour (picking a swatch also selects its tool). */
	setColor(color: string): void;
	/** One-click blackboard: arm/disarm the black screen and the pen together. */
	toggleBlackboard(): void;
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
	/** Blackout state; with the pen it marks the Blackboard toggle active. */
	blackout: PresentationBlackout;
	hasAnnotations: boolean;
	presenterViewActive: boolean;
}

export interface PresentationToolbar {
	el: HTMLElement;
	update(patch: Partial<PresentationToolbarState>): void;
	/** Start/stop the elapsed timer, the auto-hide listeners and the bar itself. */
	setPresenting(presenting: boolean): void;
	/**
	 * PowerPoint's Ctrl+H: flip the bar's visibility. It drives the SAME flag
	 * auto-hide writes, so the shortcut and the countdown cannot disagree about
	 * whether the chrome is up.
	 */
	toggleVisible(): void;
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
	registerPptxWebControls();
	const state: PresentationToolbarState = {
		current: 0,
		total: 0,
		tool: 'none',
		blackout: 'none',
		hasAnnotations: false,
		presenterViewActive: false,
	};
	// The presenter snapshot carries ONE pointer colour, but PowerPoint remembers
	// a pen colour and a highlighter colour independently, so the last choice per
	// tool is kept here and re-applied whenever that tool is picked again.
	let penColor = PEN_COLORS[0] ?? '#ff0000';
	let highlighterColor = HIGHLIGHTER_COLORS[0] ?? '#ffff00';
	let startedAt: number | null = null;

	const wrap = createEl(doc, 'div', 'pptxv-present-toolbar-wrap');
	for (const [name, value] of Object.entries(presentToolbarCssVars())) {
		wrap.style.setProperty(name, value);
	}
	const bar = doc.createElement('pptx-ui-present-toolbar') as PptxUiPresentToolbarElement;
	wrap.appendChild(bar);

	function render(): void {
		bar.state = {
			...state,
			penColor,
			highlighterColor,
			presenterViewVisible: true,
			startTime: startedAt,
			translate: t,
		};
	}

	bar.addEventListener('present-toolbar-request', (event) => {
		const intent = (event as PresentToolbarRequestEvent).detail;
		switch (intent.id) {
			case 'move':
				if (intent.direction === 1) {
					handlers.next();
				} else {
					handlers.previous();
				}
				break;
			case 'tool':
				handlers.setTool(intent.tool);
				break;
			case 'color':
				if (intent.tool === 'pen') {
					penColor = intent.color;
				} else {
					highlighterColor = intent.color;
				}
				handlers.setColor(intent.color);
				// Picking a colour arms its tool. The host toggles on re-selection, so an
				// already-armed tool must not be selected again (React gates it the same way).
				if (state.tool !== intent.tool) {
					handlers.setTool(intent.tool);
				}
				render();
				break;
			case 'blackboard':
				handlers.toggleBlackboard();
				break;
			case 'clear':
				handlers.clearAnnotations();
				break;
			case 'presenterView':
				handlers.togglePresenterView();
				break;
			case 'end':
				handlers.end();
		}
	});

	// -- Auto-hide (React's `PresentationToolbarWrapper`) ---------------------
	let hideTimer: number | null = null;
	let visible = false;
	let hovering = false;

	const setVisible = (next: boolean): void => {
		visible = next;
		// Inline rather than a class: the hidden bar must stop receiving pointer
		// events even in a host page that has not loaded the viewer stylesheet.
		wrap.style.opacity = next ? '1' : '0';
		wrap.style.pointerEvents = next ? 'auto' : 'none';
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
	wrap.addEventListener('mouseenter', () => {
		hovering = true;
		clearHideTimer();
		setVisible(true);
	});
	wrap.addEventListener('mouseleave', () => {
		hovering = false;
		resetHideTimer();
	});
	const stopPresenting = (): void => {
		doc.removeEventListener('mousemove', onMouseMove);
		clearHideTimer();
		startedAt = null;
		hovering = false;
		bar.closePalettes();
		render();
		setVisible(false);
	};

	setVisible(false);
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
			render();
			doc.addEventListener('mousemove', onMouseMove);
			setVisible(true);
			resetHideTimer();
		},
		toggleVisible() {
			if (visible) {
				clearHideTimer();
				setVisible(false);
				return;
			}
			setVisible(true);
			resetHideTimer();
		},
		dispose() {
			stopPresenting();
			wrap.remove();
		},
	};
}
