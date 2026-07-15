import type { Translator } from '../../../../i18n';
import type { DropdownHandle } from '../../../dropdown';
import { makeDropdown } from '../../../dropdown';

/** The field types offered by the Insert > Field dropdown, with dictionary keys. */
const FIELD_OPTIONS: ReadonlyArray<{ fieldType: string; i18nKey: string }> = [
	{ fieldType: 'slidenum', i18nKey: 'pptx.field.slideNumber' },
	{ fieldType: 'datetime', i18nKey: 'pptx.field.dateTime' },
	{ fieldType: 'header', i18nKey: 'pptx.field.header' },
	{ fieldType: 'footer', i18nKey: 'pptx.field.footer' },
];

/**
 * Insert > Field dropdown: slide number / date-time / header / footer,
 * resolved to display text via the shared `text-field-substitution.ts`
 * module (see `resolveFieldDisplayText` in `editor-insert-structured.ts`).
 * No custom date-format sub-picker (React's popover); the current date/time
 * is inserted directly, matching this binding's simpler dialog idiom.
 */
export function createFieldDropdown(
	doc: Document,
	t: Translator,
	onSelect: (fieldType: string) => void,
): DropdownHandle<string> {
	const dropdown = makeDropdown<string>(doc, {
		triggerLabel: t('pptx.field.field'),
		triggerText: t('pptx.field.field'),
		items: FIELD_OPTIONS.map((opt) => ({ label: t(opt.i18nKey), value: opt.fieldType })),
		onSelect,
	});
	const trigger = dropdown.el.querySelector<HTMLButtonElement>('.pptxv-dropdown-trigger');
	if (trigger) {
		trigger.title = t('pptx.field.insertField');
	}
	return dropdown;
}
