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
 * Broadcast actions into this right-aligned row (`.pptxv-ribbon-primary`,
 * queried by `collab/collab-ui.ts`, the module that actually constructs those
 * two buttons and gates them on the `'share'` / `'broadcast'` entries of the
 * host's `hiddenActions` option, since this row itself owns no buttons of
 * its own to gate).
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
