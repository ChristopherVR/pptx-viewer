/** SmartArt insertion dialog, aligned with the React binding's gallery. */
export const SMARTART_DIALOG_CSS = `
.pptxv-smartart-dialog-layer {
	position: fixed;
	inset: 0;
	z-index: 1200;
	display: flex;
	align-items: center;
	justify-content: center;
}
.pptxv-smartart-dialog-layer[hidden] { display: none; }
.pptxv-smartart-dialog-backdrop {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	padding: 0;
	border: 0;
	background: rgb(0 0 0 / 0.5);
	cursor: default;
}
.pptxv-smartart-dialog {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	width: min(600px, 90vw);
	max-height: 80vh;
	overflow: hidden;
	border: 1px solid var(--pptx-border);
	border-radius: 8px;
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	box-shadow: 0 20px 50px rgb(0 0 0 / 0.35);
}
.pptxv-smartart-dialog:focus { outline: none; }
.pptxv-smartart-dialog-header,
.pptxv-smartart-dialog-footer {
	display: flex;
	align-items: center;
	padding: 12px 16px;
}
.pptxv-smartart-dialog-header {
	justify-content: space-between;
	border-bottom: 1px solid var(--pptx-border);
}
.pptxv-smartart-dialog-header h2 { margin: 0; font-size: 14px; font-weight: 500; }
.pptxv-smartart-dialog-close {
	display: grid;
	width: 28px;
	height: 28px;
	padding: 0;
	place-items: center;
	border: 0;
	border-radius: var(--pptx-radius);
	background: transparent;
	color: inherit;
	font: inherit;
	font-size: 20px;
	line-height: 1;
	cursor: pointer;
}
.pptxv-smartart-dialog-close:hover { background: var(--pptx-muted); }
.pptxv-smartart-dialog-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.pptxv-smartart-categories {
	flex: 0 0 160px;
	padding: 8px 0;
	border-right: 1px solid var(--pptx-border);
}
.pptxv-smartart-category {
	display: block;
	width: 100%;
	padding: 6px 12px;
	border: 0;
	background: transparent;
	color: inherit;
	font: inherit;
	font-size: 12px;
	text-align: left;
	cursor: pointer;
}
.pptxv-smartart-category:hover { background: var(--pptx-muted); }
.pptxv-smartart-category.is-active { background: var(--pptx-primary); color: #fff; }
.pptxv-smartart-gallery { flex: 1; min-width: 0; overflow-y: auto; padding: 12px; }
.pptxv-smartart-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pptxv-smartart-option {
	display: flex;
	min-width: 0;
	padding: 8px;
	align-items: center;
	flex-direction: column;
	gap: 4px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: transparent;
	color: inherit;
	font: inherit;
	cursor: pointer;
}
.pptxv-smartart-option:hover { background: color-mix(in srgb, var(--pptx-muted) 50%, transparent); }
.pptxv-smartart-option.is-selected {
	border-color: var(--pptx-primary);
	background: color-mix(in srgb, var(--pptx-primary) 20%, transparent);
}
.pptxv-smartart-option-preview {
	display: grid;
	width: 64px;
	height: 48px;
	place-items: center;
	border-radius: var(--pptx-radius);
	background: var(--pptx-muted);
	color: var(--pptx-primary);
}
.pptxv-smartart-option-preview svg { width: 30px; height: 30px; }
.pptxv-smartart-option-label { font-size: 10px; line-height: 1.25; text-align: center; }
.pptxv-smartart-dialog-footer {
	justify-content: flex-end;
	gap: 8px;
	border-top: 1px solid var(--pptx-border);
}
.pptxv-smartart-dialog-cancel,
.pptxv-smartart-dialog-insert {
	padding: 6px 12px;
	border: 0;
	border-radius: var(--pptx-radius);
	font: inherit;
	font-size: 12px;
	cursor: pointer;
}
.pptxv-smartart-dialog-cancel { background: var(--pptx-muted); color: inherit; }
.pptxv-smartart-dialog-insert { background: var(--pptx-primary); color: #fff; }
.pptxv-smartart-dialog-insert:disabled { background: var(--pptx-muted); color: var(--pptx-muted-foreground); cursor: not-allowed; }
.pptxv-smartart-dialog button:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }

@media (max-width: 767px) {
	.pptxv-smartart-dialog-layer { align-items: flex-end; }
	.pptxv-smartart-dialog { width: 100%; max-height: 88dvh; border-radius: 16px 16px 0 0; }
	.pptxv-smartart-categories { flex-basis: 120px; }
	.pptxv-smartart-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
