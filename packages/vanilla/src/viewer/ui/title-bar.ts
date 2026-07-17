import type { ToolbarActionId } from 'pptx-viewer-shared';
import {
	isActionHidden,
	resolveTitleBarStatusKey,
	TITLE_BAR_DEFAULT_FILE_KEY,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { CommandSearchCommand } from './command-search';
import { createCommandSearch } from './command-search';
import { makeButton } from './controls';
import type { RibbonEditState } from './ribbon/ribbon-types';

/** Autosave lifecycle states the title-bar status text reflects. */
export type TitleBarAutosaveKind = 'idle' | 'saving' | 'saved' | 'error';

export interface TitleBarDeps {
	/** Display name of the open document (host-supplied). */
	fileName?: string;
	/** Whether the AutoSave switch starts on. */
	autosaveEnabled: boolean;
	/** Flip autosave; returns the new enabled state the switch reflects. */
	onToggleAutosave(): boolean;
	save(): void;
	undo(): void;
	redo(): void;
	/** Command-search entries (new slide / undo / export / zoom / ...). */
	commands: readonly CommandSearchCommand[];
	/** Individually hidden toolbar buttons (gates undo/redo independently). */
	hiddenActions?: readonly ToolbarActionId[];
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
}

/**
 * PowerPoint-style title bar (vanilla counterpart of React's `TitleBar.tsx`):
 * logo mark, AutoSave toggle, quick-access Save/Undo/Redo, file name +
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
	const toggle = createEl(doc, 'button', 'pptxv-titlebar-switch');
	toggle.type = 'button';
	toggle.setAttribute('role', 'switch');
	toggle.title = t('pptx.titleBar.toggleAutoSave');
	toggle.setAttribute('aria-label', t('pptx.titleBar.toggleAutoSave'));
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
		autosaveEnabled = deps.onToggleAutosave();
		applyAutosaveSwitch();
		applyStatus();
	});

	// -- Quick actions: Save / Undo / Redo ------------------------------------
	const sep1 = createEl(doc, 'span', 'pptxv-titlebar-sep');
	el.appendChild(sep1);
	const save = makeButton(doc, {
		label: t('pptx.titleBar.save'),
		icon: 'save',
		className: 'pptxv-titlebar-btn',
		onClick: () => deps.save(),
	});
	const undo = isActionHidden('undo', deps.hiddenActions)
		? null
		: makeButton(doc, {
				label: t('pptx.toolbar.undo'),
				icon: 'undo',
				className: 'pptxv-titlebar-btn',
				onClick: () => deps.undo(),
			});
	const redo = isActionHidden('redo', deps.hiddenActions)
		? null
		: makeButton(doc, {
				label: t('pptx.toolbar.redo'),
				icon: 'redo',
				className: 'pptxv-titlebar-btn',
				onClick: () => deps.redo(),
			});
	el.append(save.btn, ...(undo ? [undo.btn] : []), ...(redo ? [redo.btn] : []));
	const sep2 = createEl(doc, 'span', 'pptxv-titlebar-sep');
	el.appendChild(sep2);

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
	el.appendChild(createEl(doc, 'span', 'pptxv-titlebar-spacer'));

	applyAutosaveSwitch();
	applyStatus();

	return {
		el,
		setEditState({ editable, canUndo, canRedo }) {
			const editingEls = [
				autosaveGroup,
				sep1,
				save.btn,
				sep2,
				...(undo ? [undo.btn] : []),
				...(redo ? [redo.btn] : []),
			];
			for (const editingEl of editingEls) {
				editingEl.hidden = !editable;
			}
			statusDot.hidden = !editable;
			statusText.hidden = !editable;
			searchWrap.hidden = !editable;
			undo?.setDisabled(!canUndo);
			redo?.setDisabled(!canRedo);
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
	};
}
