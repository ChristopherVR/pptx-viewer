import { ACTION_BUTTON_PRESETS } from 'pptx-viewer-shared';

import type { Translator } from '../../../../i18n';
import type { DropdownHandle } from '../../../dropdown';
import { makeDropdown } from '../../../dropdown';

/**
 * Insert > Action Button dropdown: the 12 OOXML built-in action-button
 * presets from the shared `action-buttons.ts` catalogue. Preset labels have
 * no dictionary entries of their own (React's own Insert section renders them
 * untranslated too), so the catalogue's English `label` is used as-is.
 */
export function createActionButtonDropdown(
	doc: Document,
	t: Translator,
	onSelect: (shapeType: string) => void,
): DropdownHandle<string> {
	return makeDropdown<string>(doc, {
		triggerLabel: t('pptx.ribbon.insertActionButton'),
		triggerText: t('pptx.ribbon.action'),
		items: ACTION_BUTTON_PRESETS.map((preset) => ({
			label: preset.label,
			value: preset.shapeType,
		})),
		onSelect,
	});
}
