/** Slide template gallery dialog, aligned with React's SlideTemplateGalleryDialog. */
export const SLIDE_TEMPLATE_DIALOG_CSS = `
.pptxv-tpl-dialog-layer {
	position: fixed;
	inset: 0;
	z-index: 1200;
	display: flex;
	align-items: center;
	justify-content: center;
}
.pptxv-tpl-dialog-layer[hidden] { display: none; }
.pptxv-tpl-dialog-backdrop {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	padding: 0;
	border: 0;
	background: rgb(0 0 0 / 0.5);
	cursor: default;
}
.pptxv-tpl-dialog {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	width: min(640px, 92vw);
	max-height: 80vh;
	overflow: hidden;
	border: 1px solid var(--pptx-border);
	border-radius: 8px;
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	box-shadow: 0 20px 50px rgb(0 0 0 / 0.35);
}
.pptxv-tpl-dialog:focus { outline: none; }
.pptxv-tpl-dialog-header,
.pptxv-tpl-dialog-footer {
	display: flex;
	align-items: center;
	padding: 12px 16px;
}
.pptxv-tpl-dialog-header {
	justify-content: space-between;
	border-bottom: 1px solid var(--pptx-border);
}
.pptxv-tpl-dialog-heading { display: flex; flex-direction: column; gap: 2px; }
.pptxv-tpl-dialog-heading h2 { margin: 0; font-size: 14px; font-weight: 500; }
.pptxv-tpl-dialog-heading p { margin: 0; font-size: 11px; color: var(--pptx-muted-foreground); }
.pptxv-tpl-dialog-close {
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
.pptxv-tpl-dialog-close:hover { background: var(--pptx-muted); }
.pptxv-tpl-dialog-body { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; }
.pptxv-tpl-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.pptxv-tpl-option {
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
.pptxv-tpl-option:hover { background: color-mix(in srgb, var(--pptx-muted) 50%, transparent); }
.pptxv-tpl-option.is-selected {
	border-color: var(--pptx-primary);
	background: color-mix(in srgb, var(--pptx-primary) 20%, transparent);
}
.pptxv-tpl-preview { border-radius: var(--pptx-radius); }
.pptxv-tpl-option-label { font-size: 10px; line-height: 1.25; text-align: center; }
.pptxv-tpl-dialog-footer {
	justify-content: flex-end;
	gap: 8px;
	border-top: 1px solid var(--pptx-border);
}
.pptxv-tpl-dialog-cancel,
.pptxv-tpl-dialog-insert {
	padding: 6px 12px;
	border: 0;
	border-radius: var(--pptx-radius);
	font: inherit;
	font-size: 12px;
	cursor: pointer;
}
.pptxv-tpl-dialog-cancel { background: var(--pptx-muted); color: inherit; }
.pptxv-tpl-dialog-insert { background: var(--pptx-primary); color: #fff; }
.pptxv-tpl-dialog-insert:disabled { background: var(--pptx-muted); color: var(--pptx-muted-foreground); cursor: not-allowed; }
.pptxv-tpl-dialog button:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }

@media (max-width: 767px) {
	.pptxv-tpl-dialog-layer { align-items: flex-end; }
	.pptxv-tpl-dialog { width: 100%; max-height: 88dvh; border-radius: 16px 16px 0 0; }
	.pptxv-tpl-options { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
`;
