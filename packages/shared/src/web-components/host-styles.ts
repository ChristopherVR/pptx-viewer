// Tailwind's document reset overrides :host defaults. Keep these host rules in
// the document cascade while theme tokens cross each shadow boundary.
export const HOST_STYLES = `
pptx-ui-search {
	border: 1px solid var(--pptx-input, #374151);
	padding-inline: 12px;
}
pptx-ui-search[variant="titlebar"] {
	border-color: var(--pptx-border, #374151);
	padding-inline: 14px;
}
pptx-ui-search:focus-within { border-color: var(--pptx-ring, #6366f1); }
pptx-ui-checkbox { border: 1px solid var(--pptx-border, #374151); }
pptx-ui-checkbox[checked] { border-color: var(--pptx-primary, #6366f1); }
@media (forced-colors: active) {
	pptx-ui-search, pptx-ui-checkbox { border-color: CanvasText; }
	pptx-ui-search:focus-within,
	pptx-ui-checkbox:focus-visible {
		outline: 2px solid Highlight;
		outline-offset: 2px;
	}
}
`;
