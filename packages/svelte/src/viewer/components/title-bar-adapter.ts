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
	canUndo: boolean;
	canRedo: boolean;
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
		autosaveEnabled: input.autosaveEnabled,
		canUndo: input.canUndo,
		canRedo: input.canRedo,
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
