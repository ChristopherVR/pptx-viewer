import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { makeButton } from '../controls';
import type { RibbonEditState, RibbonPrimaryHandlers } from './ribbon-types';

export interface RibbonPrimaryRow {
	el: HTMLElement;
	setEditState(state: RibbonEditState): void;
	setAutosaveStatus(label: string, kind: 'idle' | 'saving' | 'saved' | 'error'): void;
}

/**
 * The ribbon's quick-access primary row: undo/redo, save, and the autosave
 * status pill (extracted from the old combined `toolbar.ts`). Hidden entirely
 * outside editing mode, matching React's `TitleBar`/`ToolbarPrimaryRow` split
 * (undo/redo/save are editing-only quick actions).
 */
export function createRibbonPrimaryRow(
	doc: Document,
	t: Translator,
	handlers: RibbonPrimaryHandlers,
): RibbonPrimaryRow {
	const el = createEl(doc, 'div', 'pptxv-ribbon-primary');
	el.setAttribute('role', 'toolbar');

	const save = makeButton(doc, {
		label: t('pptx.titleBar.save'),
		icon: 'save',
		onClick: () => handlers.save(),
	});
	const undoBtn = makeButton(doc, {
		label: t('pptx.toolbar.undo'),
		icon: 'undo',
		onClick: () => handlers.undo(),
	});
	const redoBtn = makeButton(doc, {
		label: t('pptx.toolbar.redo'),
		icon: 'redo',
		onClick: () => handlers.redo(),
	});
	el.append(save.btn, undoBtn.btn, redoBtn.btn);

	const autosaveStatus = createEl(doc, 'span', 'pptxv-autosave-status');
	autosaveStatus.setAttribute('aria-live', 'polite');
	autosaveStatus.hidden = true;
	el.appendChild(autosaveStatus);

	return {
		el,
		setEditState({ editable, canUndo, canRedo }) {
			el.hidden = !editable;
			undoBtn.setDisabled(!canUndo);
			redoBtn.setDisabled(!canRedo);
		},
		setAutosaveStatus(label, kind) {
			autosaveStatus.textContent = label;
			autosaveStatus.hidden = label.length === 0;
			autosaveStatus.classList.toggle('is-saving', kind === 'saving');
			autosaveStatus.classList.toggle('is-error', kind === 'error');
		},
	};
}
