import { definePptxCheckbox } from './checkbox';
import { definePptxSearchField } from './search-field';
import { definePptxSelect } from './select';

export type { PptxUiSelectElement } from './select-value';

// Host borders and padding live in the document cascade. Tailwind's global
// reset otherwise overrides these :host styles inside the shadow root.
const HOST_STYLES = `
pptx-ui-search { border: 1px solid var(--pptx-input, #374151); padding-inline: 12px; }
pptx-ui-search[variant="titlebar"] { border-color: var(--pptx-border, #374151); padding-inline: 14px; }
pptx-ui-search:focus-within { border-color: var(--pptx-ring, #6366f1); }
pptx-ui-checkbox { border: 1px solid var(--pptx-border, #374151); }
pptx-ui-checkbox[checked] { border-color: var(--pptx-primary, #6366f1); }
@media (forced-colors: active) { pptx-ui-search, pptx-ui-checkbox { border-color: CanvasText; } pptx-ui-search:focus-within, pptx-ui-checkbox:focus-visible { outline: 2px solid Highlight; outline-offset: 2px; } }
`;

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
