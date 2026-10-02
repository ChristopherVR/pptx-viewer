/**
 * Shared model for the title bar and quick-access strip (`pptx-ui-title-bar`).
 *
 * Five bindings hand-built this row and drifted on gating, ordering, tooltips
 * and icons (#394). The element owns the markup and the rules below; hosts own
 * every effect (saving, history, command dispatch, Find & Replace).
 *
 * Decisions, applied identically everywhere:
 * - Order: Save, Undo, Redo (catalog order, each individually gated), then the
 *   other configured commands in the order File > Options lists them.
 * - Gating: AutoSave, strip, status and search show only while `editing`;
 *   the strip also needs `quickAccess.visible`. `showSave` hides Save, and
 *   `showUndo`/`showRedo` hide those two (host `hiddenActions`).
 * - Tooltip: every strip button has `aria-label` = its label and `title` =
 *   `screenTip(tooltip)`; Undo/Redo name the pending action when known.
 * - Placement: `titleBar` renders the whole row (the extras only while the
 *   position is `above`); `belowRibbon` renders just the extras row.
 */
import type { CommandSearchEntry } from './command-search';
import { QUICK_ACCESS_COMMAND_CATALOG } from './options/quick-access';
import type { QuickAccessCommandDefinition } from './options/quick-access';
import type { QuickAccessPosition } from './options/viewer-options';
import { resolveTitleBarStatusKey } from './title-bar';
import type { TitleBarAutosaveState } from './title-bar';
import { isActionHidden } from './toolbar-actions';
import type { ToolbarActionId } from './toolbar-actions';

export type TitleBarTranslate = (key: string, params?: Record<string, string | number>) => string;
export type TitleBarPlacement = 'titleBar' | 'belowRibbon';
export type TitleBarTone = 'idle' | 'saving' | 'error';

/** Identifier of a strip button. Catalog ids; Save, Undo and Redo are dedicated. */
export type TitleBarCommandId = string;

export interface TitleBarAutosaveView {
	enabled: boolean;
	/** Default true. False renders the switch inert (host policy `autosave: false`). */
	toggleAvailable?: boolean;
	/** Translation key from `resolveTitleBarStatusKey`. */
	statusKey: string;
	/** Colour of the status text; only meaningful while `enabled`. */
	tone?: TitleBarTone;
}

export interface TitleBarHistoryState {
	canUndo: boolean;
	canRedo: boolean;
	/** Description of the pending action, e.g. "Delete shape". */
	undoLabel?: string | null;
	redoLabel?: string | null;
	/** Default true. Maps to `hiddenActions: ['undo']`. */
	showUndo?: boolean;
	/** Default true. Maps to `hiddenActions: ['redo']`. */
	showRedo?: boolean;
}

export interface TitleBarQuickAccessView {
	visible: boolean;
	position: QuickAccessPosition;
	showCommandLabels: boolean;
	/** Ordered catalog ids (File > Options > Quick Access Toolbar). */
	commandIds: readonly string[];
}

export interface TitleBarViewState {
	/** Edit mode with an editable deck. Gates AutoSave, the strip, status and search. */
	editing: boolean;
	/** Whether the command search shows; hosts pass `editing`. */
	searchVisible: boolean;
	/** Display name; the translated default shows when empty. */
	fileName?: string;
	autosave: TitleBarAutosaveView;
	history: TitleBarHistoryState;
	/** Default true. */
	showSave?: boolean;
	quickAccess: TitleBarQuickAccessView;
	/** Search catalogue; defaults to the shared `COMMAND_SEARCH_ENTRIES`. */
	commands?: readonly CommandSearchEntry[];
	/** Default true. False drops the "Find in Slides" fallback row. */
	contentSearch?: boolean;
	/** ScreenTip rule (Options > General); returning undefined suppresses the title. */
	screenTip?: (label: string) => string | undefined;
	translate?: TitleBarTranslate;
}

/** Detail of `command-search`: a chosen catalogue command, or content search. */
export interface TitleBarSearchDetail {
	query: string;
	/** Present when a catalogue command was chosen; absent means "search content". */
	command?: string;
}

export interface TitleBarEventDetails {
	'toggle-autosave': null;
	save: null;
	undo: null;
	redo: null;
	'quick-command': { id: TitleBarCommandId };
	'command-search': TitleBarSearchDetail;
}

export const TITLE_BAR_DEDICATED_IDS = ['save', 'undo', 'redo'] as const;

/** One resolved strip button, in display order. */
export interface TitleBarStripItem {
	id: TitleBarCommandId;
	icon: string;
	labelKey: string;
	dedicated: boolean;
}

function dedicatedItem(
	state: TitleBarViewState,
	id: (typeof TITLE_BAR_DEDICATED_IDS)[number],
): QuickAccessCommandDefinition | undefined {
	const shown =
		id === 'save'
			? state.showSave !== false
			: id === 'undo'
				? state.history.showUndo !== false
				: state.history.showRedo !== false;
	return shown ? QUICK_ACCESS_COMMAND_CATALOG.find((entry) => entry.id === id) : undefined;
}

/**
 * The strip's buttons for one placement. Unknown ids are dropped and duplicates
 * collapse, so a stale options file cannot render an unlabeled button.
 */
export function resolveTitleBarStrip(
	state: TitleBarViewState,
	placement: TitleBarPlacement,
): TitleBarStripItem[] {
	const qa = state.quickAccess;
	if (!state.editing || !qa.visible) {
		return [];
	}
	const below = qa.position === 'below';
	const items: TitleBarStripItem[] = [];
	if (placement === 'titleBar') {
		for (const id of TITLE_BAR_DEDICATED_IDS) {
			const command = dedicatedItem(state, id);
			if (command) {
				items.push({ id, icon: command.icon, labelKey: command.labelKey, dedicated: true });
			}
		}
	}
	if ((placement === 'belowRibbon') === below) {
		const seen = new Set<string>(TITLE_BAR_DEDICATED_IDS);
		for (const id of qa.commandIds) {
			const command = QUICK_ACCESS_COMMAND_CATALOG.find((entry) => entry.id === id);
			if (command && !seen.has(id)) {
				seen.add(id);
				items.push({ id, icon: command.icon, labelKey: command.labelKey, dedicated: false });
			}
		}
	}
	return items;
}

/** Tone for the status text from the autosave engine state (idle unless enabled). */
export function titleBarTone(enabled: boolean, state: string | undefined): TitleBarTone {
	if (!enabled) {
		return 'idle';
	}
	return state === 'error' ? 'error' : state === 'saving' ? 'saving' : 'idle';
}

/** What every binding already knows; buildTitleBarState turns it into the element state. */
export interface TitleBarHostInput {
	/** Edit mode with an editable deck (hosts compute this once). */
	editing: boolean;
	fileName?: string;
	isDirty: boolean;
	autosaveState?: TitleBarAutosaveState;
	/** Reason code while autosaveState is 'disabled'. */
	autosaveReason?: string;
	autosaveEnabled: boolean;
	/** Default true; false when the host passed autosave: false. */
	autosaveToggleAvailable?: boolean;
	canUndo: boolean;
	canRedo: boolean;
	undoLabel?: string | null;
	redoLabel?: string | null;
	hiddenActions?: readonly ToolbarActionId[];
	/** Default true; React hides Save when the host gives no save handler. */
	showSave?: boolean;
	quickAccess: TitleBarQuickAccessView;
	commands?: readonly CommandSearchEntry[];
	contentSearch?: boolean;
	screenTip?: (label: string) => string | undefined;
	translate: TitleBarTranslate;
}

/** The one place the title bar's gating table and status rule live. */
export function buildTitleBarState(input: TitleBarHostInput): TitleBarViewState {
	const state = input.autosaveState ?? 'idle';
	return {
		editing: input.editing,
		searchVisible: input.editing,
		fileName: input.fileName,
		autosave: {
			enabled: input.autosaveEnabled,
			toggleAvailable: input.autosaveToggleAvailable,
			statusKey: resolveTitleBarStatusKey({
				autosaveState: state,
				isDirty: input.isDirty,
				autosaveEnabled: input.autosaveEnabled,
				disabledReason: state === 'disabled' ? input.autosaveReason : undefined,
			}),
			tone: titleBarTone(input.autosaveEnabled, state),
		},
		history: {
			canUndo: input.canUndo,
			canRedo: input.canRedo,
			undoLabel: input.undoLabel,
			redoLabel: input.redoLabel,
			showUndo: !isActionHidden('undo', input.hiddenActions),
			showRedo: !isActionHidden('redo', input.hiddenActions),
		},
		showSave: input.showSave,
		quickAccess: input.quickAccess,
		commands: input.commands,
		contentSearch: input.contentSearch,
		screenTip: input.screenTip,
		translate: input.translate,
	};
}
