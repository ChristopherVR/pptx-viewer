/**
 * Outline view chrome.
 *
 * `position: fixed; inset: 0` and the same dark surface as Reading View: both
 * are full-window presentation views that cover the editor rather than dock
 * inside it, and pairing them visually is what tells a user which of the two
 * they are looking at without reading the header.
 *
 * The rows are transparent inputs with no border. An outline is a text
 * document, and drawing a field box around every line turns it into a form.
 */
export const OUTLINE_VIEW_CSS = `
.pptxv-outline-view {
	position: fixed;
	inset: 0;
	z-index: 1300;
	display: flex;
	flex-direction: column;
	background: #171717;
	color: #f5f5f5;
	outline: none;
}
.pptxv-outline-view-header {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 8px 16px;
	border-bottom: 1px solid rgb(255 255 255 / 0.1);
}
.pptxv-outline-view-title { font-size: 13px; font-weight: 600; }
.pptxv-outline-view-hint {
	overflow: hidden;
	flex: 1;
	color: rgb(255 255 255 / 0.5);
	font-size: 11px;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.pptxv-outline-view-btn {
	color: rgb(255 255 255 / 0.8);
	background: transparent;
	border: 0;
}
.pptxv-outline-view-btn:hover:not(:disabled) {
	color: #fff;
	background: rgb(255 255 255 / 0.15);
}
.pptxv-outline-view-list {
	flex: 1;
	min-height: 0;
	overflow: auto;
	padding: 12px 16px;
}
.pptxv-outline-view-row {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 2px 0;
}
.pptxv-outline-view-number {
	flex: none;
	width: 24px;
	color: rgb(255 255 255 / 0.4);
	font-size: 10px;
	font-variant-numeric: tabular-nums;
	text-align: right;
}
.pptxv-outline-view-input {
	width: 100%;
	min-width: 0;
	padding: 2px 4px;
	border: 0;
	border-radius: 3px;
	background: transparent;
	color: rgb(255 255 255 / 0.8);
	font: inherit;
	font-size: 13px;
	outline: none;
}
.pptxv-outline-view-input.is-title { color: #f5f5f5; font-size: 14px; font-weight: 600; }
.pptxv-outline-view-input:focus { background: rgb(255 255 255 / 0.1); }
.pptxv-outline-view-input:read-only { cursor: default; }
`;
