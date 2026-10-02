export const MOBILE_BAR_STYLES = `
:host { display: block; flex: none; }
:host([hidden]) { display: none !important; }
[hidden] { display: none !important; }
nav {
	box-sizing: border-box; display: flex; align-items: stretch; justify-content: space-around; width: 100%;
	padding-bottom: max(env(safe-area-inset-bottom), 0px); border-top: 1px solid var(--pptx-border, #33334d);
	background: color-mix(in srgb, var(--pptx-secondary, #1e1e2e) 70%, transparent);
	color: var(--pptx-muted-foreground, #a5a5b5); font: 500 10px/1.2 system-ui, sans-serif;
}
button {
	position: relative; box-sizing: border-box; display: flex; flex: 1; flex-direction: column;
	align-items: center; justify-content: center; gap: 2px; min-width: 44px; min-height: 56px; padding: 6px 2px;
	border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; touch-action: manipulation;
	transition: transform .1s ease, color .1s ease;
}
@media (hover: hover) { button:hover:not(:disabled):not([aria-pressed="true"]) { color: var(--pptx-foreground, #e2e8f0); } }
button:active:not(:disabled) { transform: scale(.95); }
button:disabled { opacity: .4; pointer-events: none; }
button[aria-pressed="true"] { color: var(--pptx-primary, #6366f1); }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: -2px; }
svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }
.badge {
	position: absolute; top: 4px; right: 25%; display: flex; align-items: center; justify-content: center;
	min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box; border-radius: 9999px;
	background: var(--pptx-primary, #6366f1); color: #fff; font-size: 9px; font-weight: 600;
}
.pill { position: absolute; top: 0; left: 50%; width: 32px; height: 2px; border-radius: 9999px;
	background: var(--pptx-primary, #6366f1); transform: translateX(-50%); }
@media (forced-colors: active) {
	nav { border-top-color: CanvasText; background: Canvas; color: CanvasText; }
	button { color: ButtonText; } button[aria-pressed="true"] { color: Highlight; border-top: 2px solid Highlight; }
	.badge, .pill { background: Highlight; color: HighlightText; }
	button:focus-visible { outline-color: Highlight; }
}
`;

export const MOBILE_TOOLBAR_STYLES = `
:host { display: block; flex: none; }
:host([hidden]) { display: none !important; }
[hidden], ::slotted([hidden]) { display: none !important; }
.bar {
	position: relative; z-index: 20; box-sizing: border-box; display: flex; align-items: center; gap: 4px;
	min-height: 52px; padding: max(env(safe-area-inset-top), 0px) 8px 4px; border-bottom: 1px solid var(--pptx-border, #33334d);
	background: color-mix(in srgb, var(--pptx-secondary, #1e1e2e) 50%, transparent);
	color: var(--pptx-card-foreground, #e2e8f0); font: 12px/1.2 system-ui, sans-serif;
}
.spacer { flex: 1; }
button {
	box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; flex: none;
	min-width: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 6px; background: transparent;
	color: inherit; cursor: pointer; touch-action: manipulation; transition: transform .1s ease;
}
@media (hover: hover) { button:hover:not(:disabled) { background: var(--pptx-accent, #33334d); } }
button:active:not(:disabled) { transform: scale(.95); }
button:disabled { opacity: .4; cursor: default; }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: -2px; }
button[aria-pressed="true"], button.present { color: var(--pptx-primary, #818cf8); }
button.share { padding: 0 12px; background: var(--pptx-primary, #6366f1); color: #fff; }
button.share:hover:not(:disabled) { background: color-mix(in srgb, var(--pptx-primary, #6366f1) 90%, transparent); }
svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }
@media (forced-colors: active) {
	.bar { border-bottom-color: CanvasText; background: Canvas; color: CanvasText; }
	button, button.share, button.present { color: ButtonText; background: ButtonFace; }
	button:hover:not(:disabled) { background: Highlight; color: HighlightText; }
	button:focus-visible { outline-color: Highlight; }
}
`;
