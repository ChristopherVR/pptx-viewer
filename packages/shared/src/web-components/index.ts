import { definePptxCheckbox } from './checkbox';
import { HOST_STYLES } from './host-styles';
import { definePptxSearchField } from './search-field';
import { definePptxSelect } from './select';

export type { PptxUiSelectElement } from './select-value';

/** Idempotent browser-only registration. Safe to call from every viewer binding. */
export function registerPptxWebControls(): void {
	if (typeof window === 'undefined' || !window.customElements) {
		return;
	}
	if (!document.getElementById('pptx-ui-control-hosts')) {
		const style = document.createElement('style');
		style.id = 'pptx-ui-control-hosts';
		style.textContent = HOST_STYLES;
		document.head.append(style);
	}
	definePptxSearchField(window.customElements);
	definePptxCheckbox(window.customElements);
	definePptxSelect(window.customElements);
}
