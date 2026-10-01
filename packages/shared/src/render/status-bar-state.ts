/**
 * Shared model for the bottom status bar (`pptx-ui-status-bar`).
 *
 * The slide counter, save indicator, notes toggle, view-mode buttons and zoom
 * cluster were hand-built five times. The view owns the markup, pressed state
 * and gating; hosts own every effect (notes panel, view switching, zoom).
 */

export type StatusBarTranslate = (key: string, params?: Record<string, string | number>) => string;

/** Public intent ids. Hosts map them to their native handlers. */
export type StatusBarControlId =
	| 'notes'
	| 'normal'
	| 'sorter'
	| 'slideShow'
	| 'zoomOut'
	| 'zoomFit'
	| 'zoomIn';

export type StatusBarSaveKind = 'idle' | 'saving' | 'error';
export type StatusBarViewMode = 'normal' | 'sorter' | 'slideShow';

export interface StatusBarViewState {
	slideCount: number;
	/** Zero-based active slide; clamped into range for display. */
	activeSlideIndex: number;
	/** Already-translated save indicator, see {@link resolveStatusBarSave}. */
	saveText: string;
	saveKind?: StatusBarSaveKind;
	/** Omit to hide the whole zoom cluster. */
	zoomPercent?: number;
	showNotes?: boolean;
	notesExpanded?: boolean;
	/** Default true. False drops the Normal / Sorter / Slide Show cluster. */
	showViewModes?: boolean;
	/** Default true. */
	showSorter?: boolean;
	/** Default true. */
	showSlideShow?: boolean;
	/** The pressed view button; omit when none is active. */
	viewMode?: StatusBarViewMode;
	translate?: StatusBarTranslate;
}

export type StatusBarIntent = { id: StatusBarControlId };

export interface StatusBarAutosave {
	state: 'idle' | 'disabled' | 'saving' | 'saved' | 'error';
	/** Epoch ms of the last successful save; "saved" without it reads as dirty/all-saved. */
	timestamp?: number;
}

function formatAge(timestamp: number, t: StatusBarTranslate, now: number): string {
	const minutes = Math.floor((now - timestamp) / 60_000);
	if (minutes < 1) {
		return t('pptx.autosave.justNow');
	}
	if (minutes === 1) {
		return t('pptx.autosave.oneMinAgo');
	}
	return t('pptx.autosave.minutesAgo', { count: minutes });
}

/** The one save-indicator rule: autosave state first, then the dirty flag. */
export function resolveStatusBarSave(
	t: StatusBarTranslate,
	autosave: StatusBarAutosave | undefined,
	dirty: boolean,
	now: number = Date.now(),
): { text: string; kind: StatusBarSaveKind } {
	if (autosave?.state === 'saving') {
		return { text: t('pptx.autosave.saving'), kind: 'saving' };
	}
	if (autosave?.state === 'saved' && typeof autosave.timestamp === 'number') {
		return {
			text: t('pptx.autosave.saved', { time: formatAge(autosave.timestamp, t, now) }),
			kind: 'idle',
		};
	}
	if (autosave?.state === 'error') {
		return { text: t('pptx.autosave.error'), kind: 'error' };
	}
	return {
		text: t(dirty ? 'pptx.statusBar.unsavedChanges' : 'pptx.statusBar.allSaved'),
		kind: 'idle',
	};
}

/** Map a viewer mode string to the pressed view button (unknown modes press none). */
export function statusBarViewMode(
	mode: string | undefined,
	sorterOpen = false,
): StatusBarViewMode | undefined {
	if (mode === 'present') {
		return 'slideShow';
	}
	if (sorterOpen) {
		return 'sorter';
	}
	return mode === 'edit' ? 'normal' : undefined;
}
