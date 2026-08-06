/**
 * Styles for the export progress modal (PDF / GIF / video), matching the other
 * bindings' ExportProgressModal look: a fixed dimmed backdrop, a centered card,
 * a rounded track/fill bar, a status row, and a Cancel action. All colours
 * resolve from the shared `--pptx-*` theme custom properties.
 */
export const EXPORT_PROGRESS_CSS = `
.pptxv-export-progress-backdrop {
	position: fixed;
	inset: 0;
	z-index: 1200;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(4px);
}
.pptxv-export-progress-panel {
	width: min(92vw, 384px);
	border: 1px solid var(--pptx-border, #33334d);
	border-radius: calc(var(--pptx-radius, 6px) + 6px);
	background: var(--pptx-popover, #111827);
	color: var(--pptx-popover-foreground, #f3f4f6);
	padding: 24px;
	box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
	font-family: system-ui, sans-serif;
}
.pptxv-export-progress-panel h3 {
	margin: 0 0 16px;
	font-size: 14px;
	font-weight: 600;
}
.pptxv-export-progress-track {
	height: 10px;
	width: 100%;
	overflow: hidden;
	border-radius: 9999px;
	background: var(--pptx-muted, #1f2937);
	margin-bottom: 12px;
}
.pptxv-export-progress-fill {
	height: 100%;
	border-radius: 9999px;
	background: var(--pptx-primary, #6366f1);
	transition: width 0.3s ease-out;
}
.pptxv-export-progress-status {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 16px;
	font-size: 12px;
	color: var(--pptx-muted-foreground, #94a3b8);
}
.pptxv-export-progress-pct { font-variant-numeric: tabular-nums; }
.pptxv-export-progress-actions {
	display: flex;
	justify-content: flex-end;
}
.pptxv-export-progress-actions button {
	border: 1px solid var(--pptx-border, #33334d);
	border-radius: var(--pptx-radius, 6px);
	background: var(--pptx-muted, #1f2937);
	color: var(--pptx-foreground, #f3f4f6);
	padding: 6px 16px;
	font-size: 12px;
	font-family: inherit;
	cursor: pointer;
	transition: background 0.15s;
}
.pptxv-export-progress-actions button:hover { background: var(--pptx-accent, #33334d); }
`;
