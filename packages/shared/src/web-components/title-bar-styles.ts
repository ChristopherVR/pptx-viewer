import { TITLE_BAR_METRICS as M } from '../render';

/**
 * The pptx look of the shared `office-ui-title-bar`: its `--office-title-bar-*` tokens from the
 * shared metrics and theme, the compact AutoSave switch, and hiding on phones (the compact
 * toolbar covers the row there).
 */
export const TITLE_BAR_BRIDGE = `
:host {
	--office-title-bar-height: ${M.height}px;
	--office-title-bar-background: color-mix(in srgb, var(--pptx-secondary, #1e1e2e) 80%, transparent);
	--office-title-bar-foreground: var(--pptx-card-foreground, #e2e8f0);
	--office-title-bar-border: color-mix(in srgb, var(--pptx-border, #33334d) 60%, transparent);
	--office-title-bar-mark-size: ${M.logoSize}px;
	--office-title-bar-mark-background: ${M.logoBackground};
	--office-title-bar-mark-foreground: #fff;
	--office-font-size-xs: ${M.fontSize}px;
	--office-font-size-sm: ${M.fileNameFontSize}px;
	--office-font-size-2xs: ${M.logoFontSize}px;
	--office-font-weight-medium: ${M.fileNameFontWeight};
	--office-icon-size: 14px;
	--office-icon-stroke: 1.4;
	--office-control-height-md: 24px;
	--office-selected: color-mix(in srgb, var(--pptx-accent, #33334d) 60%, transparent);
	--office-warning: #eab308;
	--office-danger: #f87171;
	--office-popover: var(--pptx-popover, var(--pptx-card, #1e1e2e));
	--office-shadow-lg: 0 14px 28px rgb(0 0 0 / 40%);
}
.results button[aria-selected="true"], .results button:hover { background: var(--pptx-accent, #33334d); }
.name { color: var(--pptx-foreground, #f1f5f9); }
.switch {
	--pptx-switch-width: ${M.switchTrackWidth}px; --pptx-switch-height: ${M.switchTrackHeight}px;
	--pptx-switch-knob-size: ${M.switchKnobSize}px; --pptx-switch-knob-offset: ${M.switchKnobOffsetOff}px;
	--pptx-switch-knob-travel: ${M.switchKnobOffsetOn - M.switchKnobOffsetOff}px;
	--pptx-switch-track: color-mix(in srgb, var(--pptx-muted-foreground, #a5a5b5) 40%, transparent);
	--pptx-switch-thumb: #fff;
}
@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) { :host { display: none !important; } }
`;
