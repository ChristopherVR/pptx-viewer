import { STATUS_BAR_METRICS } from '../render';

/** The pptx look of the shared `office-ui-status-bar` in controlled mode. */
export const STATUS_BAR_BRIDGE = `
:host {
	--office-status-bar-height: ${STATUS_BAR_METRICS.height}px;
	--office-surface: color-mix(in srgb, var(--pptx-secondary, #1e1e2e) 50%, transparent);
	--office-border: var(--pptx-border, #33334d);
	--office-foreground: var(--pptx-card-foreground, #e2e8f0);
	--office-font-size-xs: 10px;
	--office-control-height-xs: 24px;
	--office-icon-stroke: 1.45;
	--office-warning: #facc15;
	--office-danger: #f87171;
}
.bar { font: 10px/1.2 system-ui, sans-serif; }
.sep, .item + .item::before { opacity: .6; }
.zoom-fit { min-width: 3rem; padding: 2px 6px; }
`;
