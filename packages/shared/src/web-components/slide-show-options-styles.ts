export const SLIDE_SHOW_OPTIONS_STYLES = `
:host {
	display: inline-flex;
	flex: none;
	align-items: flex-start;
	gap: 8px;
	color: var(--pptx-foreground, #f9fafb);
	font: inherit;
}
.column { display: flex; flex-direction: column; gap: 2px; }
label {
	display: flex;
	align-items: center;
	gap: 4px;
	min-height: 22px;
	padding: 0 4px;
	font-size: 10px;
	white-space: nowrap;
	cursor: pointer;
}
label:has([disabled]) { color: var(--pptx-muted-foreground, #9ca3af); cursor: not-allowed; }
@media (pointer: coarse), (max-width: 767px) {
	label { min-height: 44px; font-size: 12px; }
}
`;
