export const CHECKBOX_STYLES = `
:host {
	display: inline-grid;
	box-sizing: border-box;
	width: 16px;
	height: 16px;
	flex: none;
	place-items: center;
	border: 1px solid var(--pptx-border, #374151);
	border-radius: 3px;
	background: var(--pptx-background, #030712);
	color: var(--pptx-primary-foreground, #fff);
	cursor: pointer;
	vertical-align: middle;
}
:host([checked]) {
	border-color: var(--pptx-primary, #6366f1);
	background: var(--pptx-primary, #6366f1);
}
:host(:focus-visible) {
	outline: 2px solid var(--pptx-ring, #6366f1);
	outline-offset: 2px;
}
:host([disabled]) {
	opacity: .5;
	cursor: not-allowed;
}
svg {
	display: none;
	width: 12px;
	height: 12px;
}
:host([checked]) svg { display: block; }
@media (pointer: coarse), (max-width: 767px) {
	:host { width: 22px; height: 22px; }
	svg { width: 16px; height: 16px; }
}
@media (forced-colors: active) {
	:host {
		border-color: CanvasText;
		background: Canvas;
		color: CanvasText;
		forced-color-adjust: auto;
	}
	:host([checked]) {
		border-color: Highlight;
		background: Highlight;
		color: HighlightText;
	}
	:host(:focus-visible) { outline-color: Highlight; }
}
`;
