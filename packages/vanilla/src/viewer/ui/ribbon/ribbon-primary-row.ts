import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { RibbonEditState, RibbonPrimaryHandlers } from './ribbon-types';

export interface RibbonPrimaryRow {
	el: HTMLElement;
	setEditState(state: RibbonEditState): void;
	setAutosaveStatus(label: string, kind: 'idle' | 'saving' | 'saved' | 'error'): void;
}

/**
 * Desktop command row above the ribbon tabs. Save/undo/redo and autosave state
 * live in the title bar, matching React; collaboration mounts Share and
 * Broadcast actions into this right-aligned row.
 */
export function createRibbonPrimaryRow(
	doc: Document,
	_t: Translator,
	_handlers: RibbonPrimaryHandlers,
): RibbonPrimaryRow {
	const el = createEl(doc, 'div', 'pptxv-ribbon-primary');

	return {
		el,
		setEditState({ editable }) {
			el.hidden = !editable;
		},
		setAutosaveStatus() {},
	};
}
