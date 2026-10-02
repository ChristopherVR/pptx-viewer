import {
	buildTitleBarState,
	registerPptxWebControls,
	resolveTitleBarStrip,
} from 'pptx-viewer-shared';
import type {
	CommandSearchEntry,
	PptxUiTitleBarElement,
	TitleBarCommandSearchEvent,
	TitleBarEvent,
	ToolbarActionId,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { CommandSearchCommand } from './command-search';
import type { RibbonEditState } from './ribbon/ribbon-types';

/** Autosave lifecycle states the title-bar status text reflects. */
export type TitleBarAutosaveKind = 'idle' | 'saving' | 'saved' | 'error';

/** Live Quick Access Toolbar config (File > Options > Quick Access Toolbar). */
export interface TitleBarQuickAccessState {
	visible: boolean;
	showCommandLabels: boolean;
	commandIds: readonly string[];
}

export interface TitleBarQuickAccess {
	getState(): TitleBarQuickAccessState;
	/** Run a non-core command id (`presentFromStart`, `print`, `zoomIn`, ...). */
	run(id: string): void;
	/** ScreenTip text for a command label; undefined suppresses the tooltip. */
	screenTip(label: string): string | undefined;
}

export interface TitleBarDeps {
	/** Display name of the open document (host-supplied). */
	fileName?: string;
	/** Whether the AutoSave switch starts on. */
	autosaveEnabled: boolean;
	/**
	 * Whether the switch can change anything (default `true`). The host's
	 * `autosave: false` is a policy the user cannot override, and a switch that
	 * silently does nothing is worse than a visibly disabled one, so it renders
	 * inert instead of pretending to work. See
	 * `pptx-viewer-shared/render/autosave-policy`.
	 */
	autosaveToggleAvailable?: boolean;
	/** Flip autosave; returns the new enabled state the switch reflects. */
	onToggleAutosave(): boolean;
	save(): void;
	undo(): void;
	redo(): void;
	/** Command-search entries (save / undo / redo here; vanilla has no catalogue runner). */
	commands: readonly CommandSearchCommand[];
	/** Individually hidden toolbar buttons (gates undo/redo independently). */
	hiddenActions?: readonly ToolbarActionId[];
	/** Options-driven Quick Access strip; omitted = the classic Save/Undo/Redo. */
	quickAccess?: TitleBarQuickAccess;
	/**
	 * Fires whenever the below-the-ribbon strip's emptiness is recomputed, so the
	 * detached dock (see `ViewerChrome.setQuickAccessPosition`) can hide instead
	 * of showing an empty bar.
	 */
	onQuickAccessVisibilityChange?(hidden: boolean): void;
}

export interface TitleBar {
	/** The shared `pptx-ui-title-bar` host; host-owned parts are slotted into it. */
	el: HTMLElement;
	/** Show/hide the editing quick actions + enable/disable undo/redo. */
	setEditState(state: RibbonEditState): void;
	/** Reflect the current autosave lifecycle state in the status text. */
	setAutosaveState(state: TitleBarAutosaveKind): void;
	/** Reflect the unsaved-changes flag in the status text. */
	setDirty(dirty: boolean): void;
	/** Synchronize the AutoSave switch with a host-driven runtime change. */
	setAutosaveEnabled(enabled: boolean): void;
	/** Re-render the Quick Access strip from the current options state. */
	refreshQuickAccess(): void;
	/**
	 * The below-the-ribbon `pptx-ui-title-bar` (`placement="belowRibbon"`), so the
	 * chrome can mount it in the dock for Options > Quick Access Toolbar >
	 * "Show below the Ribbon". It renders only the extras while detached.
	 */
	getQuickAccessElement(): HTMLElement;
	/** Remove the below-the-ribbon strip from wherever the chrome docked it. */
	dockQuickAccessElement(): void;
	/** Switch the strips between the title bar and the below-ribbon dock. */
	setQuickAccessDetached(detached: boolean): void;
}

const DEFAULT_QUICK_ACCESS: TitleBarQuickAccessState = {
	visible: true,
	showCommandLabels: false,
	commandIds: ['save', 'undo', 'redo'],
};

/**
 * PowerPoint-style title bar (vanilla counterpart of React's `TitleBar.tsx`): a
 * thin adapter around the shared `pptx-ui-title-bar`. The element owns the
 * markup, gating, tooltips and search; this keeps the host state and routes its
 * typed events to the viewer's handlers.
 */
export function createTitleBar(doc: Document, t: Translator, deps: TitleBarDeps): TitleBar {
	registerPptxWebControls();
	const el = doc.createElement('pptx-ui-title-bar') as PptxUiTitleBarElement;
	el.className = 'pptxv-titlebar';
	const strip = doc.createElement('pptx-ui-title-bar') as PptxUiTitleBarElement;
	strip.className = 'pptxv-qat-strip';
	strip.placement = 'belowRibbon';

	let autosaveEnabled = deps.autosaveEnabled;
	let autosaveState: TitleBarAutosaveKind = 'idle';
	let dirty = false;
	let detached = false;
	let edit: RibbonEditState = { editable: true, canUndo: false, canRedo: false };
	const searchCommands: CommandSearchEntry[] = deps.commands.map((command, index) => ({
		labelKey: command.labelKey,
		command: String(index),
	}));

	const sync = (): void => {
		const qa = deps.quickAccess?.getState() ?? DEFAULT_QUICK_ACCESS;
		const state = buildTitleBarState({
			editing: edit.editable,
			fileName: deps.fileName,
			isDirty: dirty,
			autosaveState,
			autosaveEnabled,
			autosaveToggleAvailable: deps.autosaveToggleAvailable ?? true,
			canUndo: edit.canUndo,
			canRedo: edit.canRedo,
			hiddenActions: deps.hiddenActions,
			quickAccess: {
				visible: qa.visible,
				position: detached ? 'below' : 'above',
				showCommandLabels: qa.showCommandLabels,
				commandIds: qa.commandIds,
			},
			commands: searchCommands,
			// Vanilla has no Find in Slides panel to open from the title bar.
			contentSearch: false,
			screenTip: deps.quickAccess ? (label) => deps.quickAccess?.screenTip(label) : undefined,
			translate: t,
		});
		el.state = state;
		strip.state = state;
		deps.onQuickAccessVisibilityChange?.(resolveTitleBarStrip(state, 'belowRibbon').length === 0);
	};

	const route = (host: HTMLElement): void => {
		host.addEventListener('toggle-autosave', () => {
			autosaveEnabled = deps.onToggleAutosave();
			sync();
		});
		host.addEventListener('save', () => deps.save());
		host.addEventListener('undo', () => deps.undo());
		host.addEventListener('redo', () => deps.redo());
		host.addEventListener('quick-command', (event) =>
			deps.quickAccess?.run((event as TitleBarEvent<'quick-command'>).detail.id),
		);
		host.addEventListener('command-search', (event) => {
			const { command } = (event as TitleBarCommandSearchEvent).detail;
			if (command !== undefined) {
				deps.commands[Number(command)]?.run();
			}
		});
	};
	route(el);
	route(strip);
	sync();

	return {
		el,
		setEditState(state) {
			edit = state;
			sync();
		},
		setAutosaveState(state) {
			autosaveState = state;
			sync();
		},
		setDirty(next) {
			dirty = next;
			sync();
		},
		setAutosaveEnabled(enabled) {
			autosaveEnabled = enabled;
			sync();
		},
		refreshQuickAccess: sync,
		getQuickAccessElement: () => strip,
		dockQuickAccessElement() {
			strip.remove();
		},
		setQuickAccessDetached(next) {
			detached = next;
			sync();
		},
	};
}
