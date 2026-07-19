import type { ViewerOptions } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { Store, ViewerState } from '../state';

/**
 * Slide-show extras driven by File > Options > Advanced: the "End of slide
 * show" black slide shown when advancing past the last slide, and the
 * right-click navigation menu while presenting.
 */

/**
 * PowerPoint's end-of-show caption. No `pptx.options.*` key exists for this
 * string yet, so it stays a literal until one lands in the shared dictionary.
 */
const END_OF_SHOW_TEXT = 'End of slide show, click to exit.';

export interface PresentationShowExtrasDeps {
	doc: Document;
	root(): HTMLElement;
	store: Store<ViewerState>;
	t(): Translator;
	getOptions(): ViewerOptions;
	exit(): void;
	next(): void;
	prev(): void;
}

export interface PresentationShowExtras {
	/**
	 * An advance was requested past the last slide while presenting. Shows the
	 * black end slide first when the option is on; the next advance (or a
	 * click) ends the show. Always consumes the advance.
	 */
	advancePastEnd(): void;
	/** Dismiss the end slide if visible (backward navigation); true when consumed. */
	dismissIfShown(): boolean;
	dispose(): void;
}

export function createPresentationShowExtras(
	deps: PresentationShowExtrasDeps,
): PresentationShowExtras {
	let overlay: HTMLElement | null = null;
	let menu: HTMLElement | null = null;

	const removeOverlay = (): void => {
		overlay?.remove();
		overlay = null;
	};
	const removeMenu = (): void => {
		menu?.remove();
		menu = null;
	};

	const showOverlay = (): void => {
		if (overlay) {
			return;
		}
		overlay = createEl(deps.doc, 'button', 'pptxv-endshow');
		(overlay as HTMLButtonElement).type = 'button';
		overlay.textContent = END_OF_SHOW_TEXT;
		overlay.addEventListener('click', () => {
			removeOverlay();
			deps.exit();
		});
		deps.root().appendChild(overlay);
	};

	const showMenu = (x: number, y: number): void => {
		removeMenu();
		const t = deps.t();
		menu = createEl(deps.doc, 'div', 'pptxv-showmenu');
		menu.setAttribute('role', 'menu');
		const items: Array<[string, () => void]> = [
			[t('pptx.presenter.nextSlide'), deps.next],
			[t('pptx.presenter.previousSlide'), deps.prev],
			[t('pptx.presenter.endPresentation'), deps.exit],
		];
		for (const [label, run] of items) {
			const button = createEl(deps.doc, 'button');
			button.type = 'button';
			button.setAttribute('role', 'menuitem');
			button.textContent = label;
			button.addEventListener('click', () => {
				removeMenu();
				run();
			});
			menu.appendChild(button);
		}
		const root = deps.root();
		const rect = root.getBoundingClientRect();
		menu.style.left = `${Math.max(0, x - rect.left)}px`;
		menu.style.top = `${Math.max(0, y - rect.top)}px`;
		root.appendChild(menu);
	};

	const onContextMenu = (event: MouseEvent): void => {
		if (!deps.store.get().presenting) {
			return;
		}
		if (!deps.root().contains(event.target as Node)) {
			return;
		}
		event.preventDefault();
		if (deps.getOptions().advanced.slideShowShowMenuOnRightClick) {
			showMenu(event.clientX, event.clientY);
		}
	};
	const onPointerDown = (event: PointerEvent): void => {
		if (menu && !menu.contains(event.target as Node)) {
			removeMenu();
		}
	};
	deps.doc.addEventListener('contextmenu', onContextMenu);
	deps.doc.addEventListener('pointerdown', onPointerDown);

	const unsubscribe = deps.store.subscribe((state, previous) => {
		if (!state.presenting && previous.presenting) {
			removeOverlay();
			removeMenu();
		}
		if (state.currentSlide !== previous.currentSlide) {
			removeOverlay();
		}
	});

	return {
		advancePastEnd() {
			if (overlay) {
				removeOverlay();
				deps.exit();
				return;
			}
			if (deps.getOptions().advanced.slideShowEndWithBlackSlide) {
				showOverlay();
				return;
			}
			deps.exit();
		},
		dismissIfShown() {
			if (overlay) {
				removeOverlay();
				return true;
			}
			return false;
		},
		dispose() {
			unsubscribe();
			removeOverlay();
			removeMenu();
			deps.doc.removeEventListener('contextmenu', onContextMenu);
			deps.doc.removeEventListener('pointerdown', onPointerDown);
		},
	};
}
