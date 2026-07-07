/**
 * PowerPoint-style title bar: shared pure logic + Tailwind class tokens.
 *
 * The title bar is the top chrome row above the ribbon (AutoSave toggle,
 * quick-access Save/Undo/Redo, file name + save-location status, centred
 * search box). Every binding (React/Vue/Angular) renders its own thin view
 * from these tokens so the three stay pixel-identical.
 */

// ---------------------------------------------------------------------------
// Save-status resolution
// ---------------------------------------------------------------------------

/** Lifecycle state of the autosave engine, normalised across bindings. */
export type TitleBarAutosaveState = 'idle' | 'saving' | 'saved' | 'error' | 'disabled';

export interface ResolveTitleBarStatusInput {
	/** Current autosave lifecycle state. */
	autosaveState: TitleBarAutosaveState;
	/** Whether the document has unsaved changes. */
	isDirty: boolean;
	/** Whether the AutoSave toggle is on. */
	autosaveEnabled: boolean;
	/** When autosaveState is 'disabled', the reason code. */
	disabledReason?: string;
}

/**
 * Resolve the i18n key for the save-status text shown next to the file name
 * (PowerPoint shows "Saved to this PC" there).
 */
export function resolveTitleBarStatusKey(input: ResolveTitleBarStatusInput): string {
	const { autosaveState, isDirty, autosaveEnabled, disabledReason } = input;
	if (autosaveState === 'disabled') {
		if (disabledReason === 'no_file_path') {
			return 'pptx.autosave.disabledNoFilePath';
		}
		if (disabledReason === 'autosave_toggle_off') {
			return 'pptx.autosave.disabledToggleOff';
		}
		return 'pptx.autosave.disabled';
	}
	if (autosaveEnabled && autosaveState === 'saving') {
		return 'pptx.autosave.saving';
	}
	if (autosaveEnabled && autosaveState === 'error') {
		return 'pptx.autosave.error';
	}
	if (isDirty) {
		return 'pptx.statusBar.unsavedChanges';
	}
	return 'pptx.titleBar.savedToThisPc';
}

/** Default document name shown when the host supplies no file name. */
export const TITLE_BAR_DEFAULT_FILE_KEY = 'pptx.titleBar.defaultFileName';

// ---------------------------------------------------------------------------
// Class tokens (Tailwind), shared verbatim by all three bindings
// ---------------------------------------------------------------------------

export const TITLE_BAR_CLASSES = {
	/** Outer row container. Hidden on mobile (the compact toolbar covers it). */
	container:
		'flex items-center gap-1 h-9 px-2 border-b border-border/60 bg-secondary/80 text-[11px] select-none max-md:hidden',
	/** Small square app mark on the far left. */
	logo: 'flex items-center justify-center w-5 h-5 rounded-sm bg-[#c43e1c] text-white text-[10px] font-bold shrink-0',
	/** Wrapper for the AutoSave label + switch. */
	autosaveGroup: 'flex items-center gap-1.5 pl-1.5 pr-0.5 shrink-0',
	autosaveLabel: 'text-[11px] text-muted-foreground whitespace-nowrap',
	/** Switch track, base classes; combine with on/off variant. */
	toggleTrack:
		'relative inline-flex items-center w-7 h-3.5 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
	toggleTrackOn: 'bg-primary',
	toggleTrackOff: 'bg-muted-foreground/40',
	/** Switch knob, base classes; combine with on/off variant. */
	toggleKnob: 'absolute w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-transform',
	toggleKnobOn: 'translate-x-[15px]',
	toggleKnobOff: 'translate-x-0.5',
	/** Quick-access icon button (Save / Undo / Redo). */
	quickButton:
		'p-1 rounded-sm transition-colors hover:bg-accent/60 text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed active:scale-90 active:opacity-70',
	separator: 'w-px h-4 bg-border/60 mx-1 shrink-0',
	/** File name + status wrapper (centred block in PowerPoint sits left of search). */
	fileGroup: 'flex items-baseline gap-1.5 px-1 min-w-0 shrink',
	fileName:
		'text-[12px] font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[240px]',
	statusDot: 'text-muted-foreground/70',
	statusText: 'text-[11px] text-muted-foreground whitespace-nowrap',
	statusError: 'text-red-400',
	statusSaving: 'text-yellow-500',
	/** Centred search area. */
	searchWrap: 'flex-1 flex justify-center min-w-0 px-2',
	searchBox:
		'flex items-center gap-2 w-full max-w-md px-3 py-[3px] rounded-md bg-background/70 border border-border/60 text-muted-foreground hover:bg-background hover:text-foreground transition-colors',
	searchIcon: 'w-3 h-3 shrink-0',
	searchLabel: 'text-[11px] truncate',
	/** Right-hand spacer mirroring the left block so search stays centred. */
	rightSpacer: 'flex items-center justify-end gap-1 shrink-0',
} as const;

/** Ribbon tab-row right-side actions (Record + Share live on the tab row). */
export const TAB_ROW_ACTION_CLASSES = {
	record:
		'inline-flex items-center gap-1.5 px-2.5 py-1 mr-1 rounded-sm text-[11px] font-medium text-foreground hover:bg-accent/60 transition-colors whitespace-nowrap',
	recordDot: 'w-2 h-2 rounded-full bg-red-600 shrink-0',
} as const;
