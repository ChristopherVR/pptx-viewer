import { STATUS_BAR_METRICS } from '../render';

export const STATUS_BAR_STYLES = `
:host { display: block; flex: none; }
:host([hidden]) { display: none !important; }
.bar {
	box-sizing: border-box; display: flex; align-items: center; gap: 4px; width: 100%;
	min-height: ${STATUS_BAR_METRICS.height}px; padding: 2px 8px;
	border-top: 1px solid var(--pptx-border, #33334d);
	background: color-mix(in srgb, var(--pptx-secondary, #1e1e2e) 50%, transparent);
	color: var(--pptx-muted-foreground, #a5a5b5); font: 10px/1.2 system-ui, sans-serif;
}
.counter, .text { flex: none; white-space: nowrap; }
.save.saving { color: #facc15; }
.save.error { color: #f87171; }
.spacer { flex: 1; }
.group { display: flex; align-items: center; gap: 2px; }
.sep { flex: none; width: 1px; height: 12px; margin: 0 4px; background: var(--pptx-border, #33334d); opacity: .6; }
.sep.tight { margin: 0 2px; }
[hidden] { display: none !important; }
button {
	box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
	min-width: 24px; min-height: 24px; padding: 4px; border: 0; border-radius: 3px;
	background: transparent; color: inherit; font: inherit; cursor: pointer; touch-action: manipulation;
}
button:hover { background: var(--pptx-accent, #33334d); color: var(--pptx-card-foreground, #e2e8f0); }
button[aria-pressed="true"] { color: var(--pptx-primary, #6366f1); }
button:active { opacity: .8; }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 1px; }
svg { flex: none; width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.45;
	stroke-linecap: round; stroke-linejoin: round; }
button.notes svg, button.zoom-step svg { width: 12px; height: 12px; }
button.zoom { min-width: 3rem; padding: 2px 6px; font-variant-numeric: tabular-nums; }
@media (max-width: 767px) { .narrow-hide, .notes .label { display: none !important; } }
@media (pointer: coarse) { button { min-width: 44px; min-height: 44px; } }
@media (forced-colors: active) {
	.bar { border-top-color: CanvasText; background: Canvas; color: CanvasText; }
	button { color: ButtonText; } button:hover { background: Highlight; color: HighlightText; }
	button[aria-pressed="true"] { border: 1px solid Highlight; }
	button:focus-visible { outline-color: Highlight; }
}
`;
