import { buildTitleBarState } from 'pptx-viewer-shared';
import type {
	TitleBarAutosaveState,
	TitleBarSearchDetail,
	TitleBarViewState,
	ToolbarActionId,
	ViewerQuickAccessOptions,
} from 'pptx-viewer-shared';

export interface TitleBarAdapterInput {
	editable: boolean;
	fileName?: string;
	isDirty: boolean;
	autosaveEnabled: boolean;
	autosaveStatus?: TitleBarAutosaveState;
	/** Why autosave is off while the status is 'disabled' (host policy, no file path, ...). */
	autosaveReason?: string;
	canUndo: boolean;
	canRedo: boolean;
	/** Pending-action descriptions for the Undo/Redo tooltips; empty means none. */
	undoLabel?: string | null;
	redoLabel?: string | null;
	hiddenActions?: readonly ToolbarActionId[];
	quickAccess: ViewerQuickAccessOptions;
	/** False when the host removed the strip (`quickAccessToolbar` panel). */
	quickAccessAllowed: boolean;
	screenTip: (label: string) => string | undefined;
	translate: (key: string, params?: Record<string, string | number>) => string;
}

/** Map the viewer's title-bar inputs onto the shared element state (one gating table). */
export function titleBarViewState(input: TitleBarAdapterInput): TitleBarViewState {
	return buildTitleBarState({
		editing: input.editable,
		fileName: input.fileName,
		isDirty: input.isDirty,
		autosaveState: input.autosaveStatus,
		autosaveReason: input.autosaveReason,
		autosaveEnabled: input.autosaveEnabled,
		canUndo: input.canUndo,
		canRedo: input.canRedo,
		undoLabel: input.undoLabel || undefined,
		redoLabel: input.redoLabel || undefined,
		hiddenActions: input.hiddenActions,
		quickAccess: {
			...input.quickAccess,
			visible: input.quickAccess.visible && input.quickAccessAllowed,
		},
		screenTip: input.screenTip,
		translate: input.translate,
	});
}

/** Route a `command-search` detail: a catalogue command, or content search. */
export function routeCommandSearch(
	detail: TitleBarSearchDetail,
	oncommand: ((command: string) => void) | undefined,
	onfindreplace: () => void,
): void {
	if (detail.command) {
		oncommand?.(detail.command);
	} else {
		onfindreplace();
	}
}
