/**
 * Reading View chrome.
 *
 * `position: fixed; inset: 0` rather than the slide sorter's `absolute`: this
 * is the deck at full WINDOW size, and it is the one thing that separates it
 * visually from the editor it covers. It deliberately does NOT request
 * fullscreen; see `render/reading-view` in `pptx-viewer-shared`.
 *
 * The dark surface is hard-coded rather than themed for the same reason
 * presentation mode's is: a slide is a document rendered on its own paper, and
 * a light chrome tint bleeding around it reads as part of the deck.
 */
export const READING_VIEW_CSS = `
.pptxv-reading-view {
	position: fixed;
	inset: 0;
	z-index: 1300;
	display: flex;
	flex-direction: column;
	background: #171717;
	outline: none;
}
.pptxv-reading-view-viewport {
	display: flex;
	flex: 1;
	min-height: 0;
	align-items: center;
	justify-content: center;
}
.pptxv-reading-view-stage {
	position: relative;
	overflow: hidden;
	background: #fff;
	box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5);
}
.pptxv-reading-view-bar {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 12px;
	padding: 8px 16px;
	border-top: 1px solid rgb(255 255 255 / 0.1);
}
.pptxv-reading-view-counter {
	min-width: 64px;
	color: rgb(255 255 255 / 0.7);
	font-size: 12px;
	font-variant-numeric: tabular-nums;
	text-align: center;
}
.pptxv-reading-view-btn {
	color: rgb(255 255 255 / 0.8);
	background: transparent;
	border: 0;
}
.pptxv-reading-view-btn:hover:not(:disabled) {
	color: #fff;
	background: rgb(255 255 255 / 0.15);
}
.pptxv-reading-view-btn:disabled {
	opacity: .3;
	cursor: default;
}
`;
