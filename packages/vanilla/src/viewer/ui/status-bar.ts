import type { ToolbarActionId } from 'pptx-viewer-shared';
import { isActionHidden } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { makeButton } from './controls';
import type { IconName } from './icons';
import { createIcon } from './icons';
import type { RibbonNavState } from './ribbon/ribbon-types';

/** Autosave lifecycle states pushed into the save-state text. */
export type StatusBarSaveKind = 'idle' | 'saving' | 'saved' | 'error';

export interface StatusBarHandlers {
	toggleNotes(): void;
	togglePresentation(): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
}

export interface StatusBar {
	el: HTMLElement;
	/** Reflect the slide counter and zoom percent. */
	update(state: RibbonNavState): void;
	setNotesExpanded(expanded: boolean): void;
	/** Push an autosave status label ('' = idle; falls back to All saved/dirty). */
	setSaveStatus(label: string, kind: StatusBarSaveKind): void;
	/** Reflect the unsaved-changes flag in the idle save-state text. */
	setDirty(dirty: boolean): void;
}

/**
 * PowerPoint-style status bar docked below the notes strip (vanilla
 * counterpart of React's `StatusBar.tsx`): slide counter, language, and save
 * state on the left; notes toggle, view buttons, and zoom on the right.
 */
export function createStatusBar(
	doc: Document,
	t: Translator,
	handlers: StatusBarHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): StatusBar {
	const el = createEl(doc, 'div', 'pptxv-statusbar');

	const divider = (): HTMLElement => {
		const rule = createEl(doc, 'span', 'pptxv-statusbar-sep');
		rule.setAttribute('aria-hidden', 'true');
		return rule;
	};

	// -- Left: counter + language + save state -------------------------------
	const counter = createEl(doc, 'span', 'pptxv-statusbar-counter');
	counter.setAttribute('aria-live', 'polite');
	const language = createEl(doc, 'span', 'pptxv-statusbar-text');
	language.textContent = t('pptx.statusBar.language');
	const saveState = createEl(doc, 'span', 'pptxv-statusbar-text pptxv-statusbar-save');
	el.append(counter, divider(), language, divider(), saveState);
	el.appendChild(createEl(doc, 'span', 'pptxv-statusbar-spacer'));

	let dirty = false;
	let pushedLabel = '';
	let pushedKind: StatusBarSaveKind = 'idle';
	const applySaveState = (): void => {
		saveState.textContent =
			pushedLabel.length > 0
				? pushedLabel
				: t(dirty ? 'pptx.statusBar.unsavedChanges' : 'pptx.statusBar.allSaved');
		saveState.classList.toggle('is-saving', pushedKind === 'saving');
		saveState.classList.toggle('is-error', pushedKind === 'error');
	};
	applySaveState();

	// -- Right: notes toggle + view buttons + zoom cluster ---------------------
	const showNotes = !isActionHidden('notes', hiddenActions);
	const showFullscreen = !isActionHidden('fullscreen', hiddenActions);
	const showZoom = !isActionHidden('zoom', hiddenActions);

	let notes: HTMLButtonElement | null = null;
	if (showNotes) {
		notes = createEl(doc, 'button', 'pptxv-statusbar-btn pptxv-statusbar-notes');
		notes.type = 'button';
		notes.title = t('pptx.statusBar.toggleNotes');
		notes.setAttribute('aria-label', t('pptx.statusBar.toggleNotes'));
		notes.setAttribute('aria-pressed', 'false');
		notes.setAttribute('data-pptx-compact', '');
		notes.appendChild(createIconSpan(doc, 'sticky-note'));
		const notesLabel = createEl(doc, 'span');
		notesLabel.textContent = t('pptx.notes.title');
		notes.appendChild(notesLabel);
		notes.addEventListener('click', handlers.toggleNotes);
	}

	const normal = makeButton(doc, {
		label: t('pptx.statusBar.normalView'),
		icon: 'monitor',
		className: 'pptxv-statusbar-btn is-active',
		onClick: () => {},
	});
	normal.btn.setAttribute('data-pptx-compact', '');
	const slideShow = showFullscreen
		? makeButton(doc, {
				label: t('pptx.statusBar.slideShow'),
				icon: 'presentation',
				className: 'pptxv-statusbar-btn',
				onClick: handlers.togglePresentation,
			})
		: null;
	slideShow?.btn.setAttribute('data-pptx-compact', '');

	let zoomOut: ReturnType<typeof makeButton> | null = null;
	let zoomPercent: HTMLButtonElement | null = null;
	let zoomIn: ReturnType<typeof makeButton> | null = null;
	if (showZoom) {
		zoomOut = makeButton(doc, {
			label: t('pptx.statusBar.zoomOut'),
			icon: 'minus',
			className: 'pptxv-statusbar-btn',
			onClick: handlers.zoomOut,
		});
		zoomOut.btn.setAttribute('data-pptx-compact', '');
		zoomPercent = createEl(doc, 'button', 'pptxv-statusbar-zoom');
		zoomPercent.type = 'button';
		// The aria-label wins over the visible percent text, so the "Zoom to fit"
		// accessible name (e2e contract) survives the percent readout.
		zoomPercent.title = t('pptx.statusBar.zoomToFit');
		zoomPercent.setAttribute('aria-label', t('pptx.statusBar.zoomToFit'));
		zoomPercent.setAttribute('data-pptx-compact', '');
		zoomPercent.addEventListener('click', handlers.zoomToFit);
		zoomIn = makeButton(doc, {
			label: t('pptx.statusBar.zoomIn'),
			icon: 'plus',
			className: 'pptxv-statusbar-btn',
			onClick: handlers.zoomIn,
		});
		zoomIn.btn.setAttribute('data-pptx-compact', '');
	}

	el.append(
		...(notes ? [notes] : []),
		divider(),
		normal.btn,
		...(slideShow ? [slideShow.btn] : []),
		divider(),
		...(zoomOut && zoomPercent && zoomIn ? [zoomOut.btn, zoomPercent, zoomIn.btn] : []),
	);

	return {
		el,
		update({ current, total, zoomPercent: percent }) {
			counter.textContent =
				total > 0
					? t('pptx.statusBar.slideOf', { current: current + 1, total })
					: t('pptx.statusBar.noSlides');
			if (zoomPercent) {
				zoomPercent.textContent = `${Math.round(percent)}%`;
			}
		},
		setNotesExpanded(expanded) {
			notes?.setAttribute('aria-pressed', String(expanded));
			notes?.classList.toggle('is-active', expanded);
		},
		setSaveStatus(label, kind) {
			pushedLabel = label;
			pushedKind = kind;
			applySaveState();
		},
		setDirty(isDirty) {
			dirty = isDirty;
			applySaveState();
		},
	};
}

/** Tiny wrapper so the notes button's icon shares the 12px status-bar sizing. */
function createIconSpan(doc: Document, name: 'sticky-note'): HTMLElement {
	const span = createEl(doc, 'span', 'pptxv-statusbar-icon');
	// Deferred import avoidance: icons.ts is a sibling; inline import keeps the
	// dependency explicit without widening this helper's surface.

	span.appendChild(iconFactory(doc, name));
	return span;
}

function iconFactory(doc: Document, name: IconName): SVGSVGElement {
	return createIcon(doc, name);
}
