export const ANIMATION_AUTHORING_CSS = `
/* Animations > Animation: the full 27-preset catalogue in three captioned
   columns. Capped and scrollable rather than tall: the ribbon is one row high
   and the layout-parity spec fails the whole tab if a group grows it. */
.pptxv-animation-gallery {
	display: flex;
	align-items: flex-start;
	gap: 8px;
	max-height: 62px;
	padding: 2px 4px;
	overflow-y: auto;
	border: 1px solid color-mix(in srgb, var(--pptx-border) 60%, transparent);
	border-radius: var(--pptx-radius);
	background: color-mix(in srgb, var(--pptx-muted) 30%, transparent);
}
.pptxv-animation-gallery-column { display: grid; gap: 1px; }
.pptxv-animation-gallery-caption {
	font-size: 9px;
	line-height: 1.2;
	font-weight: 600;
	color: var(--pptx-muted-foreground);
}
.pptxv-animation-gallery-items { display: flex; flex-wrap: wrap; gap: 1px; max-width: 150px; }
.pptxv-btn.pptxv-animation-preset {
	width: auto;
	height: auto;
	padding: 1px 4px;
	font-size: 9px;
	line-height: 1.3;
	white-space: nowrap;
}
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
