import { FOCUS_RING, tok } from './control-tokens';

// Tailwind's document reset overrides :host defaults. Keep these host rules in
// the document cascade while theme tokens cross each shadow boundary.
//
// The second block gives controls that deliberately stay native (checkboxes,
// radios and OS-owned select popups in secondary dialogs) the same closed-control
// treatment as the shared primitives, read from the same tokens. It is scoped to
// viewer chrome and dialogs, never the embedding page, and written with `:where`
// so a component that needs a different size can still override it.
export const HOST_STYLES = `
pptx-ui-search {
	border: 1px solid ${tok('--pptx-field-border')};
	border-radius: ${tok('--pptx-field-radius')};
	padding-inline: ${tok('--pptx-space-3')};
}
pptx-ui-search[variant="titlebar"] {
	border-color: var(--pptx-border, #374151);
	border-radius: 6px;
	padding-inline: 14px;
}
pptx-ui-search:focus-within { border-color: ${tok('--pptx-field-border-focus')}; }
pptx-ui-checkbox {
	border: 1px solid ${tok('--pptx-checkbox-border')};
	border-radius: ${tok('--pptx-checkbox-radius')};
}
pptx-ui-checkbox[checked] { border-color: ${tok('--pptx-checkbox-accent')}; }
:where([data-pptx-editor-chrome], [data-pptx-dialog], [role="dialog"]) :is(input[type="checkbox"], input[type="radio"]) {
	accent-color: ${tok('--pptx-checkbox-accent')};
}
:where([data-pptx-editor-chrome], [data-pptx-dialog], [role="dialog"]) input[type="checkbox"] {
	width: ${tok('--pptx-checkbox-size')};
	height: ${tok('--pptx-checkbox-size')};
}
@media (pointer: coarse), (max-width: 767px) {
	:where([data-pptx-editor-chrome], [data-pptx-dialog], [role="dialog"]) input[type="checkbox"] {
		width: ${tok('--pptx-checkbox-size-touch')};
		height: ${tok('--pptx-checkbox-size-touch')};
	}
}
:where([data-pptx-editor-chrome], [data-pptx-dialog], [role="dialog"]) :is(input[type="checkbox"], input[type="radio"], select):focus-visible {
	${FOCUS_RING}
}
:where([data-pptx-editor-chrome], [data-pptx-dialog], [role="dialog"]) select {
	border-radius: ${tok('--pptx-field-radius')};
	border-color: ${tok('--pptx-field-border')};
}
@media (forced-colors: active) {
	pptx-ui-search, pptx-ui-checkbox { border-color: CanvasText; }
	pptx-ui-search:focus-within,
	pptx-ui-checkbox:focus-visible {
		outline: 2px solid Highlight;
		outline-offset: 2px;
	}
}
`;
