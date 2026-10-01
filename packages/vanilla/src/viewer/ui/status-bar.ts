import { isActionHidden, registerPptxWebControls, resolveStatusBarSave } from 'pptx-viewer-shared';
import type {
	StatusBarRequestEvent,
	StatusBarViewState,
	ToolbarActionId,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { RibbonNavState } from './ribbon/ribbon-types';

/** Autosave lifecycle states pushed into the save-state text. */
export type StatusBarSaveKind = 'idle' | 'saving' | 'saved' | 'error';

export interface StatusBarHandlers {
	toggleNotes(): void;
	/** Return to the normal editing view (exit presentation + close slide sorter). */
	normalView(): void;
	openSlideSorter(): void;
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
	/** Reflect presentation state so the Normal / Slide Show buttons show the
	    active view (derived, not hardcoded). */
	setPresenting(presenting: boolean): void;
}

/**
 * PowerPoint-style status bar docked below the notes strip. A thin adapter over
 * the shared `pptx-ui-status-bar`: slide counter, language and save state on the
 * left; notes toggle, view buttons and zoom on the right.
 */
export function createStatusBar(
	doc: Document,
	t: Translator,
	handlers: StatusBarHandlers,
	hiddenActions?: readonly ToolbarActionId[],
	/**
	 * Optional collaboration-status element, projected between the view-mode
	 * cluster and the zoom cluster (React parity's `collaborationSlot`). Hosts
	 * can supply their own connection-status indicator here.
	 */
	collaborationSlot?: HTMLElement,
): StatusBar {
	registerPptxWebControls();
	const el = doc.createElement('pptx-ui-status-bar');
	el.className = 'pptxv-statusbar';
	if (collaborationSlot) {
		collaborationSlot.slot = 'collaboration';
		el.append(collaborationSlot);
	}
	const showZoom = !isActionHidden('zoom', hiddenActions);
	let dirty = false;
	let pushedLabel = '';
	let pushedKind: StatusBarSaveKind = 'idle';
	let nav = { current: 0, total: 0, zoomPercent: 100 };
	let notesExpanded = false;
	let presenting = false;

	const sync = (): void => {
		const save = resolveStatusBarSave(t, undefined, dirty);
		const state: StatusBarViewState = {
			slideCount: nav.total,
			activeSlideIndex: nav.current,
			saveText: pushedLabel.length > 0 ? pushedLabel : save.text,
			saveKind: pushedKind === 'saving' || pushedKind === 'error' ? pushedKind : 'idle',
			zoomPercent: showZoom ? nav.zoomPercent : undefined,
			showNotes: !isActionHidden('notes', hiddenActions),
			notesExpanded,
			showSlideShow: !isActionHidden('fullscreen', hiddenActions),
			// The slide-sorter overlay is modal and self-dismissing, so it is not
			// tracked as a persistent active view.
			viewMode: presenting ? 'slideShow' : 'normal',
			translate: t,
		};
		el.state = state;
	};
	const intents = {
		notes: handlers.toggleNotes,
		normal: handlers.normalView,
		sorter: handlers.openSlideSorter,
		slideShow: handlers.togglePresentation,
		zoomOut: handlers.zoomOut,
		zoomFit: handlers.zoomToFit,
		zoomIn: handlers.zoomIn,
	};
	el.addEventListener('status-request', (event) => {
		intents[(event as StatusBarRequestEvent).detail.id]();
	});
	sync();

	return {
		el,
		update(state) {
			nav = { current: state.current, total: state.total, zoomPercent: state.zoomPercent };
			sync();
		},
		setNotesExpanded(expanded) {
			notesExpanded = expanded;
			sync();
		},
		setSaveStatus(label, kind) {
			pushedLabel = label;
			pushedKind = kind;
			sync();
		},
		setDirty(isDirty) {
			dirty = isDirty;
			sync();
		},
		setPresenting(next) {
			presenting = next;
			sync();
		},
	};
}
