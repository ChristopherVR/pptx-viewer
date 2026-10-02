import { CHROME_ICON_STYLES } from './chrome-icons';

export const COMPAT_TOASTS_STYLES = `
:host { box-sizing: border-box; overflow-y: auto; max-height: 70%; }
:host([hidden]) { display: none !important; }
[hidden] { display: none !important; }
${CHROME_ICON_STYLES}
.header, .toast, .overflow { pointer-events: auto; }
.header { display: flex; align-items: center; justify-content: space-between; padding: 0 4px;
	color: var(--pptx-muted-foreground, #94a3b8); font: 600 11px/1.4 system-ui, sans-serif; }
.toast { box-sizing: border-box; display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px;
	margin-top: 8px; border: 1px solid var(--pptx-border, #374151); border-radius: 6px;
	background: var(--pptx-popover, #111827); color: var(--pptx-foreground, #f3f4f6);
	box-shadow: 0 8px 20px rgba(0, 0, 0, .35); font: 12px/1.4 system-ui, sans-serif; }
.toast svg { width: 16px; height: 16px; margin-top: 1px; }
.toast[data-severity="warning"] svg { color: #f59e0b; }
.toast[data-severity="info"] svg { color: #60a5fa; }
.message { flex: 1; min-width: 0; margin: 0; overflow-wrap: anywhere; }
.overflow { margin: 8px 0 0; text-align: center; color: var(--pptx-muted-foreground, #94a3b8); font: 11px system-ui, sans-serif; }
button { box-sizing: border-box; flex: none; display: inline-flex; align-items: center; justify-content: center;
	min-width: 24px; min-height: 24px; padding: 2px 4px; border: 0; border-radius: 4px; background: transparent;
	color: var(--pptx-muted-foreground, #94a3b8); font: inherit; cursor: pointer; touch-action: manipulation; }
button:hover { background: var(--pptx-accent, #1f2937); color: var(--pptx-foreground, #f3f4f6); }
.dismiss-all { font-weight: 500; text-decoration: underline; text-underline-offset: 2px; }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 1px; }
@media (pointer: coarse) { button { min-width: 44px; min-height: 44px; } }
@media (forced-colors: active) {
	.toast { border-color: CanvasText; background: Canvas; color: CanvasText; }
	.toast svg, button { color: ButtonText; } button:hover { background: Highlight; color: HighlightText; }
	button:focus-visible { outline-color: Highlight; }
}
`;
