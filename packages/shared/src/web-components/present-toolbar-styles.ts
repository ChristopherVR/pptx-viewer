import { PRESENT_TOOLBAR_METRICS as m } from '../render';

/** Scoped styles for `pptx-ui-present-toolbar`, from the shared show-toolbar metrics. */
export const PRESENT_TOOLBAR_STYLES = `
:host { display: block; }
:host([hidden]) { display: none !important; }
[hidden] { display: none !important; }
.bar {
	box-sizing: border-box; display: flex; align-items: center; gap: ${m.gap}px; width: max-content;
	padding: ${m.paddingY}px ${m.paddingX}px; border: 1px solid ${m.borderColor}; border-radius: ${m.radius}px;
	background: ${m.background}; color: #fff; box-shadow: 0 25px 50px -12px rgb(0 0 0 / 50%);
	-webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
	font: ${m.fontSize}px/${m.lineHeight}px ui-monospace, SFMono-Regular, Menlo, monospace;
}
.group { position: relative; display: flex; align-items: center; }
svg { flex: none; width: ${m.iconSize}px; height: ${m.iconSize}px; }
.timer svg { width: ${m.timerIconSize}px; height: ${m.timerIconSize}px; }
.caret svg { width: ${m.caretIconSize}px; height: ${m.caretIconSize}px; }
button {
	position: relative; box-sizing: border-box; display: flex; align-items: center; justify-content: center;
	width: ${m.buttonSize}px; height: ${m.buttonSize}px; padding: 0; border: 0; border-radius: ${m.controlRadius}px;
	background: transparent; color: rgb(255 255 255 / 70%); cursor: pointer; touch-action: manipulation;
	transition: color .15s, background-color .15s;
}
button:hover:not(:disabled) { color: #fff; background: rgb(255 255 255 / 10%); }
button:disabled { color: rgb(255 255 255 / 20%); cursor: not-allowed; }
button[aria-pressed="true"] { background: rgb(255 255 255 / 25%); color: #fff; }
button:focus-visible { outline: 2px solid var(--pptx-ring, #818cf8); outline-offset: 1px; }
button.end:hover:not(:disabled), button.clear:not(:disabled):hover { color: #f87171; }
button.caret { width: ${m.caretWidth}px; margin-left: -${m.caretOverlap}px; border-radius: 0 ${m.controlRadius}px ${m.controlRadius}px 0; color: rgb(255 255 255 / 50%); }
.swatch-bar { position: absolute; bottom: 2px; left: 50%; width: ${m.swatchBarWidth}px; height: ${m.swatchBarHeight}px; border-radius: 9999px; transform: translateX(-50%); }
.divider { flex: none; width: ${m.dividerWidth}px; height: ${m.dividerHeight}px; margin: 0 ${m.dividerMarginX}px; background: ${m.dividerColor}; }
.counter { min-width: ${m.counterMinWidth}px; padding: 0 6px; text-align: center; color: rgb(255 255 255 / 80%); font-variant-numeric: tabular-nums; user-select: none; }
.timer { display: flex; align-items: center; gap: ${m.timerGap}px; padding: 0 4px; color: rgb(255 255 255 / 60%); font-variant-numeric: tabular-nums; user-select: none; }
.palette {
	position: absolute; bottom: 100%; left: 50%; z-index: 1; width: max-content; margin-bottom: 8px; transform: translateX(-50%);
	display: grid; grid-template-columns: repeat(${m.paletteColumns}, ${m.swatchSize}px); gap: ${m.paletteGap}px; padding: ${m.palettePadding}px;
	border: 1px solid rgb(255 255 255 / 20%); border-radius: 8px; background: #262626; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 40%);
}
button.swatch { width: ${m.swatchSize}px; height: ${m.swatchSize}px; border: 2px solid rgb(255 255 255 / 20%); border-radius: 9999px; transition: transform .15s; }
button.swatch:hover:not(:disabled) { transform: scale(1.1); background: inherit; }
button.swatch[aria-pressed="true"] { border-color: #fff; }
@media (pointer: coarse) { button { min-width: 44px; min-height: 44px; } button.swatch { width: 44px; height: 44px; } .palette { grid-template-columns: repeat(${m.paletteColumns}, 44px); } }
@media (forced-colors: active) {
	.bar { border-color: CanvasText; background: Canvas; color: CanvasText; }
	button, .counter, .timer { color: ButtonText; }
	button:hover:not(:disabled) { background: Highlight; color: HighlightText; }
	button[aria-pressed="true"] { border: 2px solid Highlight; }
	button:focus-visible { outline-color: Highlight; }
	.divider { background: CanvasText; } .palette { border-color: CanvasText; background: Canvas; }
}
`;
