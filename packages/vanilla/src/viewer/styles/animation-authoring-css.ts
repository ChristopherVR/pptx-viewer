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
/* Animations > Motion Paths: the five PowerPoint families in captioned
   columns, sharing the preset gallery's capped/scrollable box so the ribbon
   keeps its single-row height. */
.pptxv-motion-path-gallery {
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
.pptxv-motion-path-gallery-column { display: grid; gap: 1px; }
.pptxv-motion-path-gallery-caption {
	font-size: 9px;
	line-height: 1.2;
	font-weight: 600;
	color: var(--pptx-muted-foreground);
}
.pptxv-motion-path-gallery-items { display: flex; flex-wrap: wrap; gap: 1px; max-width: 150px; }
.pptxv-btn.pptxv-motion-path-preset {
	width: auto;
	height: auto;
	padding: 1px 4px;
	font-size: 9px;
	line-height: 1.3;
	white-space: nowrap;
}
/* Inspector > Animation > Motion Path row (same look as .pptxv-anim-field,
   under its own class so the panel's positional field lookups still hold). */
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
