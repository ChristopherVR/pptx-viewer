import { FOCUS_RING, tok } from './control-tokens';

export const CHECKBOX_STYLES = `
:host {
	display: inline-grid;
	box-sizing: border-box;
	width: ${tok('--pptx-checkbox-size')};
	height: ${tok('--pptx-checkbox-size')};
	flex: none;
	place-items: center;
	border: 1px solid ${tok('--pptx-checkbox-border')};
	border-radius: ${tok('--pptx-checkbox-radius')};
	background: ${tok('--pptx-checkbox-bg')};
	color: ${tok('--pptx-checkbox-accent-fg')};
	cursor: pointer;
	vertical-align: middle;
}
:host([checked]) {
	border-color: ${tok('--pptx-checkbox-accent')};
	background: ${tok('--pptx-checkbox-accent')};
}
:host(:focus-visible) {
	${FOCUS_RING}
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
	:host { width: ${tok('--pptx-checkbox-size-touch')}; height: ${tok('--pptx-checkbox-size-touch')}; }
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
