import { FOCUS_RING, tok } from './control-tokens';

export const SEARCH_STYLES = `
:host {
	display: flex;
	align-items: center;
	gap: ${tok('--pptx-space-2')};
	box-sizing: border-box;
	width: 100%;
	height: ${tok('--pptx-field-height-lg')};
	padding: 0 ${tok('--pptx-space-3')};
	border: 1px solid ${tok('--pptx-field-border')};
	border-radius: ${tok('--pptx-field-radius')};
	background: ${tok('--pptx-field-bg')};
	color: ${tok('--pptx-field-placeholder')};
	font: inherit;
}
:host(:focus-within) { border-color: ${tok('--pptx-field-border-focus')}; }
:host([variant="titlebar"]) {
	height: ${tok('--pptx-field-height')};
	gap: 7px;
	padding-inline: 14px;
	border-color: var(--pptx-border, #374151);
	border-radius: 6px;
	background: var(--pptx-background, #030712);
}
:host([variant="titlebar"]:focus-within) {
	border-color: ${tok('--pptx-field-border-focus')};
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
	color: ${tok('--pptx-field-fg')};
	font: inherit;
	font-size: 13px;
}
:host([variant="titlebar"]) input {
	font-size: 11px;
	color: var(--pptx-foreground, #f3f4f6);
}
input::placeholder {
	color: ${tok('--pptx-field-placeholder')};
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
		${FOCUS_RING}
		outline-color: Highlight;
	}
	input { color: CanvasText; }
}
`;
