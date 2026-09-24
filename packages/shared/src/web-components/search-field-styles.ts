export const SEARCH_STYLES = `
:host {
	display: flex;
	align-items: center;
	gap: 8px;
	box-sizing: border-box;
	width: 100%;
	height: 40px;
	padding: 0 12px;
	border: 1px solid var(--pptx-input, #374151);
	background: var(--pptx-card, #111827);
	color: var(--pptx-muted-foreground, #9ca3af);
	font: inherit;
}
:host(:focus-within) { border-color: var(--pptx-ring, #6366f1); }
:host([variant="titlebar"]) {
	height: 28px;
	gap: 7px;
	padding-inline: 14px;
	border-color: var(--pptx-border, #374151);
	border-radius: 6px;
	background: var(--pptx-background, #030712);
}
:host([variant="titlebar"]:focus-within) {
	border-color: var(--pptx-ring, #6366f1);
	color: var(--pptx-foreground, #f3f4f6);
}
:host([disabled]) { opacity: .5; cursor: not-allowed; }
svg { width: 16px; height: 16px; flex: none; }
:host([variant="titlebar"]) svg { width: 14px; height: 14px; }
input {
	min-width: 0;
	width: 100%;
	height: 100%;
	flex: 1;
	padding: 0;
	border: 0;
	outline: 0;
	background: transparent;
	color: var(--pptx-card-foreground, #f3f4f6);
	font: inherit;
	font-size: 13px;
}
:host([variant="titlebar"]) input {
	font-size: 11px;
	color: var(--pptx-foreground, #f3f4f6);
}
input::placeholder {
	color: var(--pptx-muted-foreground, #9ca3af);
	opacity: .8;
}
input::-webkit-search-cancel-button { display: none; }
@media (forced-colors: active) {
	:host {
		border-color: CanvasText;
		background: Canvas;
		color: CanvasText;
	}
	:host(:focus-within) {
		outline: 2px solid Highlight;
		outline-offset: 2px;
	}
	input { color: CanvasText; }
}
`;
