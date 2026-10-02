export const PASTE_OPTIONS_STYLES = `
:host { position: fixed; z-index: 1100; display: block; }
:host([hidden]) { display: none !important; }
.toolbar {
	box-sizing: border-box; display: flex; align-items: center; gap: 2px;
	padding: 4px; border: 1px solid var(--pptx-border, #374151); border-radius: 4px;
	background: var(--pptx-popover, #111827); box-shadow: 0 10px 25px rgba(0, 0, 0, .35);
	font: 11px/1.2 system-ui, sans-serif;
}
button {
	box-sizing: border-box; min-height: 24px; padding: 4px 8px; border: 0; border-radius: 4px;
	background: transparent; color: var(--pptx-foreground, #f3f4f6); font: inherit; white-space: nowrap;
	cursor: pointer; touch-action: manipulation;
}
button:hover { background: var(--pptx-accent, #1f2937); }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 1px; }
@media (pointer: coarse) { button { min-height: 44px; min-width: 44px; } }
@media (forced-colors: active) {
	.toolbar { border-color: CanvasText; background: Canvas; }
	button { color: ButtonText; } button:hover { background: Highlight; color: HighlightText; }
	button:focus-visible { outline-color: Highlight; }
}
`;
