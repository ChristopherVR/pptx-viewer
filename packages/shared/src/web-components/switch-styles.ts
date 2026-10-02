import { FOCUS_RING, tok } from './control-tokens';

export const SWITCH_STYLES = `
:host {
	position: relative;
	display: inline-flex;
	box-sizing: border-box;
	width: ${tok('--pptx-switch-width')};
	height: ${tok('--pptx-switch-height')};
	flex: none;
	align-items: center;
	border-radius: 999px;
	background: ${tok('--pptx-switch-track')};
	cursor: pointer;
	touch-action: manipulation;
	transition: background-color .15s;
	vertical-align: middle;
}
:host([checked]) { background: ${tok('--pptx-switch-track-on')}; }
:host(:focus-visible) {
	${FOCUS_RING}
}
:host([disabled]) {
	opacity: .4;
	cursor: not-allowed;
}
.knob {
	position: absolute;
	top: calc((${tok('--pptx-switch-height')} - ${tok('--pptx-switch-knob-size')}) / 2);
	left: ${tok('--pptx-switch-knob-offset')};
	width: ${tok('--pptx-switch-knob-size')};
	height: ${tok('--pptx-switch-knob-size')};
	border-radius: 50%;
	background: ${tok('--pptx-switch-thumb')};
	box-shadow: 0 1px 2px rgb(0 0 0 / .3);
	transition: transform .15s;
}
:host([checked]) .knob { transform: translateX(${tok('--pptx-switch-knob-travel')}); }
@media (pointer: coarse) {
	.hit { position: absolute; inset: -15px -8px; }
}
@media (forced-colors: active) {
	:host { border: 1px solid ButtonText; background: ButtonFace; forced-color-adjust: none; }
	:host([checked]) { background: Highlight; }
	.knob { background: ButtonText; }
	:host([checked]) .knob { background: HighlightText; }
	:host([disabled]) { border-color: GrayText; opacity: 1; }
	:host([disabled]) .knob { background: GrayText; }
	:host(:focus-visible) { outline-color: Highlight; }
}
`;
