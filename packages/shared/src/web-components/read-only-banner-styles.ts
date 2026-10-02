import { CHROME_ICON_STYLES } from './chrome-icons';

export const READ_ONLY_BANNER_STYLES = `
:host { display: block; flex: none; }
:host([hidden]) { display: none !important; }
[hidden] { display: none !important; }
${CHROME_ICON_STYLES}
.banner {
	box-sizing: border-box; display: flex; align-items: center; gap: 12px; padding: 6px 16px;
	border-bottom: 1px solid rgba(180, 83, 9, .3); background: rgba(120, 53, 15, .2);
	color: #fde68a; font: 12px/1.4 system-ui, sans-serif;
}
.banner > svg { color: #fbbf24; width: 16px; height: 16px; }
.text { flex: 1 1 auto; min-width: 0; margin: 0; }
.form { display: flex; flex: none; align-items: center; gap: 8px; }
.sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
	clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
button, input { font: inherit; }
button {
	box-sizing: border-box; flex: none; min-height: 24px; padding: 4px 12px; border: 1px solid transparent;
	border-radius: 4px; background: transparent; color: rgba(253, 230, 138, .85); font-weight: 500;
	cursor: pointer; touch-action: manipulation;
}
button.primary { border-color: rgba(217, 119, 6, .5); color: #fef3c7; }
button:hover { background: rgba(180, 83, 9, .3); }
button:disabled { opacity: .6; cursor: not-allowed; }
button:focus-visible, input:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 1px; }
input {
	box-sizing: border-box; min-height: 24px; padding: 4px 8px; border: 1px solid rgba(217, 119, 6, .4);
	border-radius: 4px; background: rgba(0, 0, 0, .2); color: #fef3c7;
}
.error { flex: none; color: #fca5a5; }
@media (pointer: coarse) { button, input { min-height: 44px; min-width: 44px; } }
@media (forced-colors: active) {
	.banner { border-bottom-color: CanvasText; background: Canvas; color: CanvasText; }
	.banner > svg, .error { color: CanvasText; }
	button, input { border-color: ButtonText; color: ButtonText; background: ButtonFace; }
	button:focus-visible, input:focus-visible { outline-color: Highlight; }
}
`;
