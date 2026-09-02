/**
 * Wave-4 parity banners: the read-only recommendation strip (mirrors the
 * existing Protected View bar's layout, `.pptxv-protected-view`) and the
 * compatibility-warning toast stack anchored bottom-right of the chrome.
 */
export const PARITY_BANNERS_CSS = `
.pptxv-readonly-banner {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 16px;
	background: #fef3c7;
	color: #78350f;
	border-bottom: 1px solid #fcd34d;
	font-size: 13px;
}
.pptxv-readonly-banner svg { width: 16px; height: 16px; flex: none; }
.pptxv-readonly-banner-text { flex: 1 1 auto; }
.pptxv-readonly-banner-edit {
	flex: none;
	padding: 3px 10px;
	border: 1px solid #b45309;
	border-radius: 4px;
	background: #fff;
	color: #78350f;
	font: inherit;
	font-weight: 600;
	cursor: pointer;
}
.pptxv-readonly-banner-edit:hover { background: #fde68a; }
.pptxv-readonly-banner-dismiss {
	flex: none;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	padding: 0;
	border: none;
	background: transparent;
	color: inherit;
	cursor: pointer;
	border-radius: 4px;
}
.pptxv-readonly-banner-dismiss:hover { background: rgba(120, 53, 15, 0.12); }
.pptxv-readonly-banner-dismiss svg { width: 14px; height: 14px; }

.pptxv-compat-toasts {
	/* Position, size, stacking order and pointer-events come from
	   \`compatToastStackStyleAttr()\` (render/chrome-metrics), set as an inline
	   style on the element so every binding anchors the stack to the same
	   bottom inset above the status bar (see \`ui/compat-toasts.ts\`). */
	align-items: flex-end;
	max-width: min(340px, calc(100% - 24px));
}
.pptxv-compat-toasts-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
	max-height: 60vh;
	overflow-y: auto;
	width: 100%;
}
.pptxv-compat-toast {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	padding: 8px 10px;
	border-radius: 6px;
	border: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
	font-size: 12px;
	pointer-events: auto;
}
.pptxv-compat-toast[data-severity='warning'] { border-color: #f59e0b; }
.pptxv-compat-toast svg { width: 14px; height: 14px; flex: none; margin-top: 2px; }
.pptxv-compat-toast-body { flex: 1 1 auto; min-width: 0; }
.pptxv-compat-toast-title { display: block; font-size: 11px; }
.pptxv-compat-toast-message { display: block; word-break: break-word; }
.pptxv-compat-toast-dismiss {
	flex: none;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 18px;
	height: 18px;
	padding: 0;
	border: none;
	background: transparent;
	color: inherit;
	cursor: pointer;
	border-radius: 4px;
}
.pptxv-compat-toast-dismiss:hover { background: var(--pptx-accent); }
.pptxv-compat-toast-dismiss svg { width: 12px; height: 12px; margin: 0; }
.pptxv-compat-toasts-overflow {
	font-size: 11px;
	color: var(--pptx-muted-foreground);
	pointer-events: none;
}
.pptxv-compat-toasts-dismiss-all {
	pointer-events: auto;
	align-self: flex-end;
	padding: 3px 8px;
	border: 1px solid var(--pptx-border);
	border-radius: 4px;
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	font-size: 11px;
	cursor: pointer;
}
.pptxv-compat-toasts-dismiss-all:hover { background: var(--pptx-accent); }
`;
