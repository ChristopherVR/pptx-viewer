import { TITLE_BAR_METRICS as M } from '../render';

/** Scoped CSS for `pptx-ui-title-bar`; every measurement comes from the shared metrics. */
export const TITLE_BAR_STYLES = `
:host { display: block; flex: none; }
:host([hidden]), :host([data-empty]) { display: none !important; }
[hidden] { display: none !important; }
.bar {
	box-sizing: border-box; display: flex; align-items: center; gap: ${M.gap}px; width: 100%;
	height: ${M.height}px; padding: 0 ${M.paddingX}px;
	border-bottom: 1px solid color-mix(in srgb, var(--pptx-border, #33334d) 60%, transparent);
	background: color-mix(in srgb, var(--pptx-secondary, #1e1e2e) 80%, transparent);
	color: var(--pptx-card-foreground, #e2e8f0); font: ${M.fontSize}px/1.2 system-ui, sans-serif;
	user-select: none;
}
.bar.below { height: auto; min-height: 28px; padding-block: 2px; }
.logo {
	flex: none; display: flex; align-items: center; justify-content: center;
	width: ${M.logoSize}px; height: ${M.logoSize}px; border-radius: ${M.logoRadius}px;
	background: ${M.logoBackground}; color: #fff; font-size: ${M.logoFontSize}px; font-weight: 700;
}
.autosave { flex: none; display: flex; align-items: center; gap: 6px; padding: 0 2px 0 6px; white-space: nowrap; }
.label, .dot, .status { color: var(--pptx-muted-foreground, #a5a5b5); white-space: nowrap; }
.switch {
	--pptx-switch-width: ${M.switchTrackWidth}px; --pptx-switch-height: ${M.switchTrackHeight}px;
	--pptx-switch-knob-size: ${M.switchKnobSize}px; --pptx-switch-knob-offset: ${M.switchKnobOffsetOff}px;
	--pptx-switch-knob-travel: ${M.switchKnobOffsetOn - M.switchKnobOffsetOff}px;
	--pptx-switch-track: color-mix(in srgb, var(--pptx-muted-foreground, #a5a5b5) 40%, transparent);
	--pptx-switch-thumb: #fff;
}
.sep { flex: none; width: 1px; height: ${M.separatorHeight}px; margin: 0 4px; background: color-mix(in srgb, var(--pptx-border, #33334d) 60%, transparent); }
.qat { display: flex; align-items: center; gap: 2px; min-width: 0; }
.qat button, .results button {
	box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
	min-width: 24px; min-height: 24px; padding: 4px; border: 0; border-radius: 3px;
	background: transparent; color: var(--pptx-muted-foreground, #a5a5b5); font: inherit; cursor: pointer;
	touch-action: manipulation;
}
.qat button:hover:not(:disabled) { background: color-mix(in srgb, var(--pptx-accent, #33334d) 60%, transparent); }
.qat button:active:not(:disabled) { opacity: .7; }
.qat button:disabled { opacity: .4; cursor: not-allowed; }
.qat small { font-size: ${M.fontSize}px; white-space: nowrap; }
svg { flex: none; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.4;
	stroke-linecap: round; stroke-linejoin: round; }
.file { display: flex; align-items: baseline; gap: 6px; min-width: 0; padding: 0 4px; flex: 0 1 auto; }
.name {
	max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	color: var(--pptx-foreground, #f1f5f9); font-size: ${M.fileNameFontSize}px; font-weight: ${M.fileNameFontWeight};
}
.status.saving { color: #eab308; }
.status.error { color: #f87171; }
.search { position: relative; flex: 1; display: flex; justify-content: center; min-width: 0; padding: 0 8px; }
.box { position: relative; width: 100%; max-width: 448px; min-width: 0; }
pptx-ui-search { width: 100%; }
.results {
	position: absolute; z-index: 50; top: calc(100% + 4px); right: 0; left: 0; max-height: 256px; overflow-y: auto;
	border: 1px solid var(--pptx-border, #33334d); border-radius: 8px;
	background: var(--pptx-popover, var(--pptx-card, #1e1e2e)); box-shadow: 0 14px 28px rgb(0 0 0 / .4);
}
.heading { padding: 6px 12px; color: var(--pptx-muted-foreground, #a5a5b5); font-size: 10px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
.empty { padding: 8px 12px; color: var(--pptx-muted-foreground, #a5a5b5); }
.results button { display: flex; width: 100%; justify-content: flex-start; gap: 8px; padding: 6px 12px; border-radius: 0; color: var(--pptx-foreground, #f1f5f9); text-align: left; }
.results button:hover, .results button[aria-selected="true"] { background: var(--pptx-accent, #33334d); }
.results .cat { margin-left: auto; color: var(--pptx-muted-foreground, #a5a5b5); font-size: 10px; text-transform: capitalize; }
.results .content { border-top: 1px solid color-mix(in srgb, var(--pptx-border, #33334d) 60%, transparent); }
.end { flex: none; display: flex; align-items: center; justify-content: flex-end; gap: ${M.gap}px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 1px; }
@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) { :host { display: none !important; } }
@media (max-width: 1100px) { .qat small { display: none; } .name { max-width: 140px; } }
@media (pointer: coarse) {
	.qat button, .results button { min-width: 44px; min-height: 44px; }
	.bar { height: auto; min-height: 44px; }
}
@media (forced-colors: active) {
	.bar { border-bottom-color: CanvasText; background: Canvas; color: CanvasText; }
	.logo { border: 1px solid CanvasText; background: Canvas; color: CanvasText; }
	.label, .dot, .status, .name, .qat button, .results button { color: CanvasText; }
	.sep { background: CanvasText; }
	.qat button:hover:not(:disabled), .results button:hover, .results button[aria-selected="true"] { background: Highlight; color: HighlightText; }
	.qat button:disabled { color: GrayText; opacity: 1; }
	.results { border-color: CanvasText; background: Canvas; }
	button:focus-visible { outline-color: Highlight; }
}
`;
