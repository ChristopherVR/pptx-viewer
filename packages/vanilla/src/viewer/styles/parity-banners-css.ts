/**
 * Wave-4 parity banners: the "Run program" notice stack. The read-only
 * recommendation banner and the compatibility-warning toast stack are the shared
 * `pptx-ui-read-only-banner` and `pptx-ui-compat-toasts` elements and carry
 * their own shadow-root styles.
 */
export const PARITY_BANNERS_CSS = `
.pptxv-sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
}

.pptxv-run-program-notices {
	/* Position, size, stacking order and pointer-events come from
	   \`compatToastStackStyleAttr()\` (render/chrome-metrics), same anchor as
	   \`.pptxv-compat-toasts\` (see \`ui/run-program-notices.ts\`); the two never
	   compete for the same screen since these only appear while presenting. */
	align-items: flex-end;
	max-width: min(340px, calc(100% - 24px));
}
.pptxv-run-program-notice {
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
.pptxv-run-program-notice-message { flex: 1 1 auto; min-width: 0; word-break: break-word; }
.pptxv-run-program-notice-copy {
	flex: none;
	padding: 2px 6px;
	border: 1px solid var(--pptx-border);
	border-radius: 4px;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font-size: 11px;
	cursor: pointer;
}
.pptxv-run-program-notice-copy:hover { background: var(--pptx-accent); color: var(--pptx-card-foreground); }
.pptxv-run-program-notice-dismiss {
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
.pptxv-run-program-notice-dismiss:hover { background: var(--pptx-accent); }
.pptxv-run-program-notice-dismiss svg { width: 12px; height: 12px; margin: 0; }
`;
