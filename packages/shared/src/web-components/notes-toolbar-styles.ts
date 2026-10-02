export const NOTES_TOOLBAR_STYLES = `
:host { display: block; position: relative; margin-bottom: 4px; }
:host([hidden]) { display: none !important; }
[hidden] { display: none !important; }
.bar {
	display: flex; align-items: center; justify-content: space-between; gap: 8px;
	font: 12px/1.2 system-ui, sans-serif; color: var(--pptx-foreground, inherit);
}
.group {
	display: inline-flex; align-items: center; flex-wrap: wrap;
	border: 1px solid var(--pptx-border, rgba(127, 127, 127, .35)); border-radius: 4px;
	background: var(--pptx-muted, rgba(127, 127, 127, .12));
}
.sep { flex: none; width: 1px; height: 16px; margin: 0 2px; background: var(--pptx-border, rgba(127, 127, 127, .45)); }
button {
	box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
	min-width: 28px; min-height: 28px; padding: 4px 6px; border: 0; border-radius: 3px;
	background: transparent; color: inherit; font: inherit; cursor: pointer; touch-action: manipulation;
}
button:hover:not(:disabled) { background: var(--pptx-accent, rgba(127, 127, 127, .25)); }
button:disabled { cursor: not-allowed; opacity: .45; }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: -2px; }
button.mode { min-width: 0; padding: 4px 8px; font-size: 10px; border: 1px solid var(--pptx-border, rgba(127, 127, 127, .35)); background: var(--pptx-muted, rgba(127, 127, 127, .12)); }
svg { flex: none; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2;
	stroke-linecap: round; stroke-linejoin: round; }
.popover {
	position: fixed; z-index: 60; box-sizing: border-box; width: 288px; max-width: calc(100vw - 16px);
	padding: 12px; border: 1px solid var(--pptx-border, #33334d); border-radius: 8px;
	background: var(--pptx-popover, var(--pptx-card, #1e1e2e)); color: var(--pptx-popover-foreground, var(--pptx-card-foreground, #e2e8f0));
	box-shadow: 0 8px 24px rgba(0, 0, 0, .35);
}
.popover form { display: grid; gap: 8px; }
.popover label { display: grid; gap: 2px; font-size: 10px; color: var(--pptx-muted-foreground, #a5a5b5); }
.popover input {
	box-sizing: border-box; width: 100%; min-height: 28px; padding: 4px 8px; border: 1px solid var(--pptx-border, #33334d);
	border-radius: 4px; background: var(--pptx-background, #11111b); color: var(--pptx-foreground, #e2e8f0); font: 12px system-ui, sans-serif;
}
.popover input:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: -1px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
.actions button { min-width: 0; padding: 4px 10px; font-size: 11px; }
.actions .insert { background: var(--pptx-primary, #6366f1); color: var(--pptx-primary-foreground, #fff); }
@media (pointer: coarse) {
	button { min-width: 44px; min-height: 44px; }
	.popover input { min-height: 44px; font-size: 16px; }
	.actions button { min-width: 44px; }
}
@media (forced-colors: active) {
	.group, button.mode, .popover { border-color: CanvasText; background: Canvas; color: CanvasText; }
	button { color: ButtonText; }
	button:hover:not(:disabled) { background: Highlight; color: HighlightText; }
	button:disabled { color: GrayText; opacity: 1; }
	button:focus-visible, .popover input:focus-visible { outline-color: Highlight; }
	.actions .insert { background: ButtonFace; color: ButtonText; border: 1px solid ButtonText; }
}
`;
