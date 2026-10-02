import { FOCUS_RING, tok } from './control-tokens';

export const RADIO_STYLES = `
:host {
	display: inline-grid;
	box-sizing: border-box;
	width: ${tok('--pptx-checkbox-size')};
	height: ${tok('--pptx-checkbox-size')};
	flex: none;
	place-items: center;
	border: 1px solid ${tok('--pptx-checkbox-border')};
	border-radius: 50%;
	background: ${tok('--pptx-checkbox-bg')};
	cursor: pointer;
	vertical-align: middle;
}
:host([checked]) { border-color: ${tok('--pptx-checkbox-accent')}; }
:host(:focus-visible) {
	${FOCUS_RING}
}
:host([disabled]) {
	opacity: .5;
	cursor: not-allowed;
}
.dot {
	display: none;
	width: ${tok('--pptx-radio-dot-size')};
	height: ${tok('--pptx-radio-dot-size')};
	border-radius: 50%;
	background: ${tok('--pptx-checkbox-accent')};
}
:host([checked]) .dot { display: block; }
@media (pointer: coarse), (max-width: 767px) {
	:host { width: ${tok('--pptx-checkbox-size-touch')}; height: ${tok('--pptx-checkbox-size-touch')}; }
	.dot { width: ${tok('--pptx-radio-dot-size-touch')}; height: ${tok('--pptx-radio-dot-size-touch')}; }
}
@media (forced-colors: active) {
	:host {
		border-color: CanvasText;
		background: Canvas;
		forced-color-adjust: auto;
	}
	:host([checked]) { border-color: Highlight; }
	.dot { background: Highlight; }
	:host([disabled]) { border-color: GrayText; }
	:host([disabled]) .dot { background: GrayText; }
	:host(:focus-visible) { outline-color: Highlight; }
}
`;
