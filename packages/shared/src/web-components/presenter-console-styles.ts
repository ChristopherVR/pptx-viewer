import { PRESENTER_LAYOUT_METRICS as m } from '../render';

/** Scoped styles for `pptx-ui-presenter-console`, from the shared console metrics. */
export const PRESENTER_CONSOLE_STYLES = `
:host { display: block; }
:host([hidden]) { display: none !important; }
.strip {
	box-sizing: border-box; display: flex; flex-wrap: wrap; align-items: center; gap: ${m.stripGap}px;
	padding: ${m.stripPaddingY}px ${m.stripPaddingX}px; border-bottom: 1px solid var(--pptx-border, #33334d);
	background: var(--pptx-card, #1e1e2e); color: var(--pptx-foreground, #e2e8f0); font: 12px/16px system-ui, sans-serif;
}
svg { flex: none; width: ${m.controlIconSize}px; height: ${m.controlIconSize}px; }
button {
	box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
	min-width: ${m.controlSize}px; height: ${m.controlSize}px; padding: 0 8px; border: 0; border-radius: ${m.controlRadius}px;
	background: var(--pptx-muted, #2a2a3d); color: var(--pptx-foreground, #e2e8f0); font: inherit; cursor: pointer;
	touch-action: manipulation; transition: background-color .15s, color .15s;
}
button:hover:not(:disabled):not([aria-pressed="true"]) { background: var(--pptx-accent, #33334d); }
button[aria-pressed="true"] { background: var(--pptx-primary, #6366f1); color: var(--pptx-primary-foreground, #fff); }
button:disabled { opacity: .5; cursor: not-allowed; }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 1px; }
.divider { flex: none; width: ${m.dividerWidth}px; height: ${m.dividerHeight}px; margin: 0 ${m.dividerMarginX}px; background: var(--pptx-border, #33334d); }
.spacer { flex: 1; }
@media (pointer: coarse) { button { min-width: 44px; height: 44px; } }
@media (forced-colors: active) {
	.strip { border-bottom-color: CanvasText; background: Canvas; color: CanvasText; }
	button { background: ButtonFace; color: ButtonText; border: 1px solid ButtonText; }
	button[aria-pressed="true"] { border: 2px solid Highlight; }
	button:hover:not(:disabled) { background: Highlight; color: HighlightText; }
	button:focus-visible { outline-color: Highlight; }
	.divider { background: CanvasText; }
}
`;
