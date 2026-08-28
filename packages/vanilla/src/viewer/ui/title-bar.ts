import type { ToolbarActionId } from 'pptx-viewer-shared';
import {
	isActionHidden,
	QUICK_ACCESS_COMMAND_CATALOG,
	resolveTitleBarStatusKey,
	TITLE_BAR_DEFAULT_FILE_KEY,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { CommandSearchCommand } from './command-search';
import { createCommandSearch } from './command-search';
import type { ButtonHandle } from './controls';
import { makeButton } from './controls';
import type { IconName } from './icons';
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
	/** Command-search entries (new slide / undo / export / zoom / ...). */
	commands: readonly CommandSearchCommand[];
	/** Individually hidden toolbar buttons (gates undo/redo independently). */
	hiddenActions?: readonly ToolbarActionId[];
	/** Options-driven Quick Access strip; omitted = the classic Save/Undo/Redo. */
	quickAccess?: TitleBarQuickAccess;
	/**
	 * Fires whenever the strip's own `hidden` state is (re)computed, so a
	 * detached "below the Ribbon" dock (see `ViewerChrome.setQuickAccessPosition`)
	 * can mirror it instead of showing an empty bar.
	 */
	onQuickAccessVisibilityChange?(hidden: boolean): void;
}

export interface TitleBar {
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
	 * The Quick Access strip element itself, so the chrome can relocate it for
	 * Options > Quick Access Toolbar > "Show below the Ribbon". Detaching it
	 * moves the live node (and its rendered buttons) rather than rebuilding it.
	 */
	getQuickAccessElement(): HTMLElement;
	/** Re-dock a detached Quick Access strip back into the title bar row. */
	dockQuickAccessElement(): void;
	/** Hide the title bar's own separators while the strip lives elsewhere. */
	setQuickAccessDetached(detached: boolean): void;
}

/** Catalog icon name -> local inline icon; unmapped ids fall back to a glyph. */
const QAT_ICONS: Record<string, IconName> = {
	save: 'save',
	undo: 'undo',
	redo: 'redo',
	play: 'play',
	printer: 'printer',
	fileDown: 'download',
	plus: 'new-slide',
	zoomIn: 'zoom-in',
	zoomOut: 'zoom-out',
};

/**
 * PowerPoint-style title bar (vanilla counterpart of React's `TitleBar.tsx`):
 * logo mark, AutoSave toggle, the Quick Access Toolbar strip, file name +
 * save-location status, and the centred command search box.
 */
export function createTitleBar(doc: Document, t: Translator, deps: TitleBarDeps): TitleBar {
	const el = createEl(doc, 'div', 'pptxv-titlebar');
	el.setAttribute('data-pptx-title-bar', '');

	const logo = createEl(doc, 'span', 'pptxv-titlebar-logo');
	logo.textContent = 'P';
	logo.setAttribute('aria-hidden', 'true');
	el.appendChild(logo);

	// -- AutoSave label + switch (editing only) -------------------------------
	let autosaveEnabled = deps.autosaveEnabled;
	const autosaveGroup = createEl(doc, 'span', 'pptxv-titlebar-autosave');
	const autosaveLabel = createEl(doc, 'span', 'pptxv-titlebar-autosave-label');
	autosaveLabel.textContent = t('pptx.titleBar.autoSave');
	const toggleAvailable = deps.autosaveToggleAvailable ?? true;
	const toggle = createEl(doc, 'button', 'pptxv-titlebar-switch');
	toggle.type = 'button';
	toggle.setAttribute('role', 'switch');
	toggle.title = toggleAvailable
		? t('pptx.titleBar.toggleAutoSave')
		: t('pptx.autosave.disabledByHost');
	toggle.setAttribute('aria-label', t('pptx.titleBar.toggleAutoSave'));
	if (!toggleAvailable) {
		toggle.disabled = true;
		toggle.classList.add('is-disabled');
	}
	toggle.appendChild(createEl(doc, 'span', 'pptxv-titlebar-switch-knob'));
	const autosaveOnOff = createEl(doc, 'span', 'pptxv-titlebar-autosave-label');
	autosaveGroup.append(autosaveLabel, toggle, autosaveOnOff);
	el.appendChild(autosaveGroup);

	const applyAutosaveSwitch = (): void => {
		toggle.classList.toggle('is-on', autosaveEnabled);
		toggle.setAttribute('aria-checked', String(autosaveEnabled));
		autosaveOnOff.textContent = t(
			autosaveEnabled ? 'pptx.titleBar.autoSaveOn' : 'pptx.titleBar.autoSaveOff',
		);
	};
	toggle.addEventListener('click', () => {
		if (!toggleAvailable) {
			return;
		}
		autosaveEnabled = deps.onToggleAutosave();
		applyAutosaveSwitch();
		applyStatus();
	});

	// -- Quick Access strip: Save/Undo/Redo + configured commands -------------
	const sep1 = createEl(doc, 'span', 'pptxv-titlebar-sep');
	el.appendChild(sep1);
	const qat = createEl(doc, 'span', 'pptxv-qat');
	el.appendChild(qat);
	const sep2 = createEl(doc, 'span', 'pptxv-titlebar-sep');
	el.appendChild(sep2);

	let lastEditState: RibbonEditState = { editable: true, canUndo: false, canRedo: false };
	let undoHandle: ButtonHandle | null = null;
	let redoHandle: ButtonHandle | null = null;
	let qatDetached = false;
	const applyQatSeparators = (): void => {
		sep1.hidden = !lastEditState.editable;
		// Detached (docked below the ribbon instead), sep2 would bracket nothing:
		// hide it so autosave/sep1 don't render two separators back to back.
		sep2.hidden = qatDetached || !lastEditState.editable;
	};

	const runCommand = (id: string): void => {
		if (id === 'save') {
			deps.save();
		} else if (id === 'undo') {
			deps.undo();
		} else if (id === 'redo') {
			deps.redo();
		} else {
			deps.quickAccess?.run(id);
		}
	};

	const renderQuickAccess = (): void => {
		qat.replaceChildren();
		undoHandle = null;
		redoHandle = null;
		const state: TitleBarQuickAccessState = deps.quickAccess?.getState() ?? {
			visible: true,
			showCommandLabels: false,
			commandIds: ['save', 'undo', 'redo'],
		};
		qat.hidden = !state.visible || !lastEditState.editable;
		deps.onQuickAccessVisibilityChange?.(qat.hidden);
		for (const id of state.commandIds) {
			if ((id === 'undo' || id === 'redo') && isActionHidden(id, deps.hiddenActions)) {
				continue;
			}
			const command = QUICK_ACCESS_COMMAND_CATALOG.find((entry) => entry.id === id);
			if (!command) {
				continue;
			}
			const label = t(command.labelKey);
			const icon = QAT_ICONS[command.icon];
			const handle = makeButton(doc, {
				label,
				icon,
				text: icon === undefined ? 'Ab' : undefined,
				textLabel: state.showCommandLabels ? label : undefined,
				className: 'pptxv-titlebar-btn',
				onClick: () => runCommand(id),
			});
			if (deps.quickAccess) {
				const tip = deps.quickAccess.screenTip(label);
				if (tip === undefined) {
					handle.btn.removeAttribute('title');
				} else {
					handle.btn.title = tip;
				}
			}
			if (id === 'undo') {
				undoHandle = handle;
				handle.setDisabled(!lastEditState.canUndo);
			} else if (id === 'redo') {
				redoHandle = handle;
				handle.setDisabled(!lastEditState.canRedo);
			}
			qat.appendChild(handle.btn);
		}
	};

	// -- File name + save-location status -------------------------------------
	const fileGroup = createEl(doc, 'span', 'pptxv-titlebar-file');
	const fileName = createEl(doc, 'span', 'pptxv-titlebar-filename');
	fileName.textContent = deps.fileName || t(TITLE_BAR_DEFAULT_FILE_KEY);
	const statusDot = createEl(doc, 'span', 'pptxv-titlebar-dot');
	statusDot.textContent = '•';
	statusDot.setAttribute('aria-hidden', 'true');
	const statusText = createEl(doc, 'span', 'pptxv-titlebar-status');
	fileGroup.append(fileName, statusDot, statusText);
	el.appendChild(fileGroup);

	let autosaveState: TitleBarAutosaveKind = 'idle';
	let dirty = false;
	const applyStatus = (): void => {
		statusText.textContent = t(
			resolveTitleBarStatusKey({ autosaveState, isDirty: dirty, autosaveEnabled }),
		);
		statusText.classList.toggle('is-error', autosaveEnabled && autosaveState === 'error');
		statusText.classList.toggle('is-saving', autosaveEnabled && autosaveState === 'saving');
	};

	// -- Centred command search ------------------------------------------------
	const searchWrap = createEl(doc, 'span', 'pptxv-titlebar-search');
	searchWrap.appendChild(createCommandSearch(doc, t, deps.commands).el);
	el.appendChild(searchWrap);

	applyAutosaveSwitch();
	applyStatus();
	applyQatSeparators();
	renderQuickAccess();

	return {
		el,
		setEditState(state) {
			lastEditState = state;
			autosaveGroup.hidden = !state.editable;
			applyQatSeparators();
			const qatState = deps.quickAccess?.getState();
			qat.hidden = !state.editable || qatState?.visible === false;
			deps.onQuickAccessVisibilityChange?.(qat.hidden);
			statusDot.hidden = !state.editable;
			statusText.hidden = !state.editable;
			searchWrap.hidden = !state.editable;
			undoHandle?.setDisabled(!state.canUndo);
			redoHandle?.setDisabled(!state.canRedo);
		},
		setAutosaveState(state) {
			autosaveState = state;
			applyStatus();
		},
		setDirty(next) {
			dirty = next;
			applyStatus();
		},
		setAutosaveEnabled(enabled) {
			autosaveEnabled = enabled;
			applyAutosaveSwitch();
			applyStatus();
		},
		refreshQuickAccess: renderQuickAccess,
		getQuickAccessElement: () => qat,
		dockQuickAccessElement() {
			el.insertBefore(qat, sep2);
		},
		setQuickAccessDetached(detached) {
			qatDetached = detached;
			applyQatSeparators();
		},
	};
}
