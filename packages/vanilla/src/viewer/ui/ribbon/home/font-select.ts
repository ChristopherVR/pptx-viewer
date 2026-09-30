import { buildFontCatalog, registerPptxWebControls } from 'pptx-viewer-shared';
import type { FontCatalogInput } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';

/** Home font fields use the existing shared select's value/event contract. */
export function createFontSelect(
	doc: Document,
	t: Translator,
	picker: 'family' | 'size',
	onSelect: (value: string) => void,
) {
	registerPptxWebControls();
	const el = doc.createElement('pptx-ui-select');
	el.setAttribute('variant', 'ribbon-font');
	el.dataset.fontPicker = picker;
	el.setAttribute(
		'aria-label',
		t(picker === 'family' ? 'pptx.ribbon.fontFamily' : 'pptx.ribbon.fontSize'),
	);
	el.addEventListener('change', () => onSelect(el.value));
	return {
		el,
		setTriggerText: (value: string) => {
			el.value = value;
		},
		setDisabled: (disabled: boolean) => {
			el.disabled = disabled;
		},
	};
}

export function setFontSelectCatalog(
	el: HTMLElement,
	t: Translator,
	input: FontCatalogInput,
): void {
	const doc = el.ownerDocument;
	el.replaceChildren(
		...buildFontCatalog(input).map((group) => {
			const optgroup = doc.createElement('optgroup');
			optgroup.label = t(group.labelKey);
			for (const entry of group.entries) {
				const option = doc.createElement('option');
				option.value = option.textContent = entry.family;
				option.dataset.displayLabel = entry.family;
				if (entry.themeRole) {
					option.dataset.description = t(`pptx.font.role.${entry.themeRole}`);
				}
				option.style.fontFamily = entry.family;
				optgroup.append(option);
			}
			return optgroup;
		}),
	);
}
