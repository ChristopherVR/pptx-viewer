export const RIBBON_COMMAND_STYLES = `
:host { display: inline-flex; flex: none; }
:host([hidden]) { display: none !important; }
.badge { position:absolute; top:0; right:0; border-radius:99px; padding:0 3px; background:var(--pptx-primary,#6366f1); color:var(--pptx-primary-foreground,#fff); font-size:9px; }
.badge[hidden] { display:none; }
span[hidden],.caret[hidden] { display:none; }
/* The chevron trails the last line of a large command's label, as PowerPoint draws it. */
.caret { display:inline-block; width:10px; height:10px; margin-inline-start:2px; vertical-align:-1px; color:var(--pptx-muted-foreground,#94a3b8); fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
/* Large command: Office draws a 32px glyph above a two-line label. */
button {
	box-sizing: border-box; position:relative; display: inline-flex; flex-direction: column; align-items: center;
	justify-content: flex-start; gap: 2px; min-width: 48px; max-width: 80px; height: 66px;
	padding: 3px 4px; border: 0; border-radius: 4px; background: transparent;
	color: var(--pptx-foreground, #f9fafb); cursor: pointer; font: inherit;
	font-size: 12px; line-height: 15px; text-align: center;
}
svg { width: 32px; height: 32px; flex: none; color: var(--pptx-primary, #6366f1);
	fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
:host([compact]) button { flex-direction: row; align-items: center; justify-content: flex-start;
	gap: 6px; min-width: 0; max-width: none; height: 24px; padding: 0 6px; font-size: 12px; line-height: 16px; text-align: left; }
:host([compact]) svg { width: 16px; height: 16px; stroke-width: 1.5; }
:host([icon-only]) button { min-width:28px; max-width:none; height:28px; padding:4px; }
:host([icon-only]) svg { width: 18px; height: 18px; }
/* Drawing tools: a tall, label-less button like Office's pen and eraser tiles. */
:host([icon-only][tall]) button { min-width:40px; max-width:none; height:62px; padding:4px; }
:host([icon-only][tall]) svg { width:30px; height:30px; }
:host([icon-only][tall][active]) button { background: color-mix(in srgb, var(--pptx-primary, #6366f1) 22%, transparent); box-shadow: inset 0 0 0 1px var(--pptx-primary, #6366f1); }
button:hover:not(:disabled) { background: var(--pptx-accent, #33334d); }
button:active:not(:disabled) { background: color-mix(in srgb, var(--pptx-accent, #33334d) 70%, var(--pptx-primary, #6366f1)); }
:host([active]) button { background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent); color: var(--pptx-primary, #6366f1); }
button:disabled { opacity: .35; cursor: not-allowed; }
button:focus-visible { outline: 2px solid var(--pptx-ring, #6366f1); outline-offset: 2px; }
@media (pointer: coarse), (max-width: 767px) { :host([compact]) button { min-height: 44px; } :host([icon-only]) button { min-width:44px; } }
@media (forced-colors: active) {
	button { color: ButtonText; } svg { color: ButtonText; }
	button:disabled { color: GrayText; opacity: 1; }
	button:focus-visible { outline-color: Highlight; }
	:host([active]) button { border: 1px solid Highlight; }
}
`;
