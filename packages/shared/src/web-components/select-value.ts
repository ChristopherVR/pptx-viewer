/**
 * Public DOM shape of `pptx-ui-select`, used by every binding. The element is ooxml-ui's
 * `office-ui-select` under the pptx tag (see `office-aliases.ts`); it is not a native select.
 */
export interface PptxUiSelectElement extends HTMLElement {
	value: string;
	disabled: boolean;
	readonly options: HTMLOptionElement[];
	selectedIndex: number;
}

declare global {
	interface HTMLElementTagNameMap {
		'pptx-ui-select': PptxUiSelectElement;
	}
}
