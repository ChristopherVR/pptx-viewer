export const ANIMATION_AUTHORING_CSS = `
.pptxv-motion-path-row { display: grid; gap: 2px; font-size: 11px; }
.pptxv-motion-path-row > span { color: var(--pptx-muted-foreground); }
.pptxv-motion-path-row select {
	width: 100%;
	padding: 3px 4px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	font-size: 11px;
}
.pptxv-motion-path-hint { font-size: 10px; color: var(--pptx-muted-foreground); }
/* The on-canvas path overlay lives inside the scaled stage; only the end
   handle takes pointers so the slide underneath stays clickable. */
svg[data-pptx-motion-path-overlay] { pointer-events: none; }
svg[data-pptx-motion-path-overlay] [data-pptx-motion-path-handle] { pointer-events: auto; }
.pptxv-animation-timeline {
	display: grid;
	gap: 6px;
	min-width: 220px;
	padding: 4px 8px;
	border-left: 1px solid var(--pptx-border);
}
.pptxv-animation-timeline-list { display: grid; gap: 2px; max-height: 112px; overflow: auto; }
.pptxv-animation-timeline-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 28px 28px;
	align-items: center;
	gap: 2px;
	padding: 2px 4px;
	border-radius: var(--pptx-radius);
	background: color-mix(in srgb, var(--pptx-muted) 65%, transparent);
}
.pptxv-animation-timeline-row.is-selected { outline: 1px solid var(--pptx-ring); }
.pptxv-animation-timeline-row.is-native { font-style: italic; opacity: 0.7; grid-template-columns: minmax(0, 1fr); }
.pptxv-animation-timeline-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pptxv-animation-timing-controls { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
.pptxv-animation-timing-controls label { display: grid; gap: 2px; font-size: 11px; }
.pptxv-animation-timing-controls :is(select, input) {
	min-width: 0;
	width: 100%;
	padding: 3px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: var(--pptx-foreground);
}
`;
