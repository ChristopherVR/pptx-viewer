/** React's ribbon presentation, isolated from inspector and dialog selects. */
export const SELECT_RIBBON_STYLES = `
:host([variant^="ribbon-"][disabled]) { opacity: .4; }
:host([variant^="ribbon-"]) button {
	height: 28px; min-height: 28px; padding: 4px 8px; gap: 4px;
	border: 1px solid color-mix(in oklab, var(--pptx-border) 60%, transparent);
	border-radius: 3px; font-size: 12px; line-height: 18px;
	background: color-mix(in oklab, var(--pptx-background) 60%, transparent);
	color: var(--pptx-foreground);
}
:host([variant^="ribbon-"]) .value { flex: 1; min-width: 0; }
:host([variant^="ribbon-"]) .chevron {
	width: 16px; height: 16px; margin: 0; border: 0; transform: none;
}
:host([variant^="ribbon-"]) .chevron svg { display: block; width: 16px; height: 16px; }
:host([variant="ribbon-font"]) .chevron { color: var(--pptx-muted-foreground); }
:host([variant="ribbon-font"][data-font-picker="size"]) button { padding-inline: 6px; }
:host([variant="ribbon-icon"]) button {
	width: 36px; gap: 6px; padding: 6px 10px; border: 0; font-size: 12px; line-height: 16px;
	background: var(--pptx-muted); justify-content: center;
}
:host([variant="ribbon-icon"]) :is(.value, .chevron) { display: none; }
::slotted(svg[slot="icon"]) { display: block; width: 16px; height: 16px; flex: none; }
:host([variant^="ribbon-"]) button:hover:not(:disabled) { background: var(--pptx-accent); }
:host([variant^="ribbon-"]) .menu {
	width: 192px; padding: 4px 0; border-radius: 8px; font-size: 12px; line-height: 16px;
}
:host([data-font-picker="family"]) .menu { width: 256px; }
:host([variant^="ribbon-"]) .option {
	display: flex; justify-content: space-between; gap: 12px; padding: 6px 12px; border-radius: 0;
}
:host([variant^="ribbon-"]) .option[aria-selected="true"] {
	background: transparent; color: var(--pptx-foreground);
}
:host([variant^="ribbon-"]) .option:hover,
:host([variant^="ribbon-"]) .option[data-active] { background: var(--pptx-muted); filter: none; }
:host([variant^="ribbon-"]) .group {
	padding: 8px 12px 4px; text-transform: uppercase; letter-spacing: .25px;
	font-size: 10px; line-height: 15px;
}
@media (max-width: 767px) {
  :host([variant^="ribbon-"]) button { height: 44px; min-height: 44px; }
}
.description { flex: none; color: var(--pptx-muted-foreground); font-size: 10px; line-height: 15px; }
`;
